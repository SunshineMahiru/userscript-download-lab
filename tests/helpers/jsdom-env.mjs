// jsdom 测试环境补丁。集中放这里，避免每个测试文件各写一份。
// jsdom environment shims, kept in one place so test files do not repeat them.

import { JSDOM } from "jsdom";

export const TAB_STORAGE_KEY = "udl-tab-ratio-v1";

// jsdom 既没有布局也没有指针捕获。这里补的是缺失的宿主接口，并且装在原型上，
// 使面板挂载时就能读到几何值；几何从元素自身的 style.top 读回，与浏览器对固定
// 定位元素的行为一致，拖拽位移因此可验，而不是一组预先编好的数字。
// jsdom has neither layout nor pointer capture. These shims supply the missing host
// interfaces on the prototype so geometry exists at mount time; the value is read back
// from the element's own style.top, mirroring how a browser lays out a fixed element.
export function installLayout(dom, { viewportHeight = 800, elementHeight = 200 } = {}) {
  const { window } = dom;
  Object.defineProperty(window, "innerHeight", { value: viewportHeight, configurable: true });

  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.id === "udl-root" ? elementHeight : 0;
    },
  });

  window.Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const height = this.id === "udl-root" ? elementHeight : 0;
    const top = Number.parseFloat(this.style.top) || 0;
    return { top, bottom: top + height, height, left: 0, right: 52, width: 52, x: 0, y: top };
  };

  window.Element.prototype.setPointerCapture = function setPointerCapture(pointerId) {
    this.__capture = pointerId;
  };
  window.Element.prototype.hasPointerCapture = function hasPointerCapture(pointerId) {
    return this.__capture === pointerId;
  };
  window.Element.prototype.releasePointerCapture = function releasePointerCapture() {
    this.__capture = null;
  };

  return dom;
}

// 建一个带布局补丁的文档，并把 window、document、localStorage 挂到全局，
// 供按需 import 的模块读取。传入 html 时可以复现服务端返回的真实页面。
// Create a document with the layout shims installed and expose the usual globals.
// Passing html lets a test reproduce exactly what the server returned.
export function bootScene({
  storage = null,
  url = "http://127.0.0.1:8080/chapter/ch-1",
  html = "<!doctype html><html><body><h1>示例章节</h1></body></html>",
  ...layout
} = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.location = dom.window.location;
  installLayout(dom, layout);
  if (storage !== null) dom.window.localStorage.setItem(TAB_STORAGE_KEY, String(storage));
  return dom;
}

// jsdom 没有 PointerEvent 构造器，用 MouseEvent 补上 pointerId 即可驱动监听器。
// jsdom lacks a PointerEvent constructor; a MouseEvent carrying pointerId is enough.
export function firePointer(dom, target, type, clientY, pointerId = 1) {
  const event = new dom.window.MouseEvent(type, { clientY, bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  target.dispatchEvent(event);
}

export function mountPanelInto(dom, mountPanel, handlers = {}) {
  const panel = mountPanel({
    onParse: handlers.onParse || (() => {}),
    onDownload: handlers.onDownload || (() => {}),
    onPdf: handlers.onPdf || (() => {}),
  });
  // 多次挂载会留下多个根节点，取最后一个。
  // Repeated mounts leave several roots behind; take the last one.
  const roots = dom.window.document.querySelectorAll("#udl-root");
  return { panel, root: roots[roots.length - 1] };
}
