import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

let passed = 0;
const failures = [];

async function check(name, run) {
  try {
    await run();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failures.push({ name, error });
    process.stdout.write(`FAIL ${name} -> ${error.message}\n`);
  }
}

// jsdom 既没有布局也没有指针捕获。这里补的是缺失的宿主接口，并且装在原型上，
// 使面板挂载时就能读到几何值；几何从元素自身的 style.top 读回，与浏览器对固定
// 定位元素的行为一致，拖拽位移因此可验，而不是一组预先编好的数字。
// jsdom has neither layout nor pointer capture. These shims supply the missing host
// interfaces on the prototype so geometry exists at mount time; the value is read back
// from the element's own style.top, mirroring how a browser lays out a fixed element.
function installLayout(dom, { viewportHeight = 800, elementHeight = 200 } = {}) {
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
}

const STORAGE_KEY = "udl-tab-ratio-v1";

function bootScene({ storage = null } = {}) {
  const dom = new JSDOM("<!doctype html><html><body><h1>示例章节</h1></body></html>", {
    url: "http://127.0.0.1:8080/chapter/ch-1",
    pretendToBeVisual: true,
  });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  installLayout(dom);
  if (storage !== null) dom.window.localStorage.setItem(STORAGE_KEY, String(storage));
  return dom;
}

function firePointer(dom, target, type, clientY) {
  const event = new dom.window.MouseEvent(type, { clientY, bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: 1 });
  target.dispatchEvent(event);
}

const { mountPanel } = await import("../src/ui.js");

function mount() {
  const panel = mountPanel({ onParse() {}, onDownload() {}, onPdf() {} });
  const roots = globalThis.document.querySelectorAll("#udl-root");
  return { panel, root: roots[roots.length - 1] };
}

const scene = bootScene();
const { panel, root } = mount();

await check("初次挂载渲染空状态", () => {
  assert.ok(root, "面板根节点未创建");
  assert.match(root.querySelector("#udl-list").textContent, /解析后在此列出本章资源/);
  assert.equal(root.querySelector("#udl-count").textContent, "0 项");
});

await check("条目名称中的尖括号被转义", () => {
  panel.setResources([{ name: "<img src=x onerror=alert(1)>.pdf", kind: "pdf", url: "#", selected: true }]);
  const list = root.querySelector("#udl-list");
  assert.equal(list.querySelectorAll("img").length, 0, "不得插入原始标签");
  assert.equal(list.querySelector(".udl-name").textContent, "<img src=x onerror=alert(1)>.pdf");
});

await check("类型标签按 kind 呈现", () => {
  panel.setResources([
    { name: "a.pdf", kind: "pdf", url: "#", selected: true },
    { name: "b.pptx", kind: "ppt", url: "#", selected: true },
    { name: "c.mp4", kind: "video", url: "#", selected: true },
  ]);
  const labels = [...root.querySelectorAll(".udl-kind")].map((node) => node.textContent);
  assert.deepEqual(labels, ["PDF", "PPT", "视频"]);
});

await check("取消勾选后计数与按钮同步", () => {
  panel.setResources([
    { name: "a.pdf", kind: "pdf", url: "#", selected: true },
    { name: "b.pdf", kind: "pdf", url: "#", selected: true },
  ]);
  const button = root.querySelector("#udl-download");
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "下载选中（2）");

  const first = root.querySelectorAll(".udl-check")[0];
  first.checked = false;
  first.dispatchEvent(new scene.window.Event("change", { bubbles: true }));

  assert.equal(root.querySelector("#udl-download").textContent, "下载选中（1）");
  assert.equal(root.querySelector("#udl-download").disabled, false);
});

await check("全部取消勾选后按钮禁用", () => {
  for (const checkbox of root.querySelectorAll(".udl-check")) {
    checkbox.checked = false;
    checkbox.dispatchEvent(new scene.window.Event("change", { bubbles: true }));
  }
  const button = root.querySelector("#udl-download");
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "下载选中（0）");
});

await check("下载进行中按钮禁用并显示进度文案", () => {
  panel.setResources([{ name: "a.pdf", kind: "pdf", url: "#", selected: true }]);
  panel.setBusy(true);
  const button = root.querySelector("#udl-download");
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "下载中…");
  panel.setBusy(false);
});

await check("状态行的语气类名随调用变化", () => {
  panel.setStatus("出错了", "error");
  assert.match(root.querySelector("#udl-status").className, /udl-error/);
  panel.setStatus("完成了", "success");
  assert.match(root.querySelector("#udl-status").className, /udl-success/);
  panel.setStatus("中性");
  assert.equal(root.querySelector("#udl-status").className, "udl-status");
});

await check("点击书签展开与收起", () => {
  const tab = root.querySelector("#udl-tab");
  tab.dispatchEvent(new scene.window.MouseEvent("click", { bubbles: true }));
  assert.equal(root.classList.contains("udl-open"), true);
  assert.equal(tab.getAttribute("aria-expanded"), "true");
  tab.dispatchEvent(new scene.window.MouseEvent("click", { bubbles: true }));
  assert.equal(root.classList.contains("udl-open"), false);
  assert.equal(tab.getAttribute("aria-expanded"), "false");
});

await check("挂载后按存储比例还原位置", () => {
  // 可用区间 10..590，比例 0.5 对应 300。
  bootScene({ storage: 0.5 });
  const mounted = mount();
  assert.ok(Math.abs(Number.parseFloat(mounted.root.style.top) - 300) <= 1, `实际 ${mounted.root.style.top}`);
});

await check("拖拽后位移与指针移动一致", () => {
  const dragScene = bootScene();
  const mounted = mount();
  const tab = mounted.root.querySelector("#udl-tab");
  const startTop = Number.parseFloat(mounted.root.style.top);

  firePointer(dragScene, tab, "pointerdown", 400);
  assert.equal(tab.__capture, 1, "应按住并捕获指针");
  firePointer(dragScene, tab, "pointermove", 460);
  firePointer(dragScene, tab, "pointerup", 460);

  const moved = Number.parseFloat(mounted.root.style.top);
  assert.ok(Math.abs(moved - (startTop + 60)) <= 16, `位移 ${moved - startTop}，预期约 60`);
  assert.equal(tab.__capture, null, "抬起后应释放捕获");
});

await check("拖拽把位置写回存储", () => {
  const stored = Number.parseFloat(globalThis.localStorage.getItem(STORAGE_KEY));
  assert.ok(Number.isFinite(stored), "应写入比例");
  assert.ok(stored >= 0 && stored <= 1, `比例应在 0..1，实际 ${stored}`);
});

await check("拖拽后重新挂载恢复到相同位置", () => {
  const saved = Number.parseFloat(globalThis.localStorage.getItem(STORAGE_KEY));
  const before = Number.parseFloat(globalThis.document.querySelector("#udl-root").style.top);

  bootScene({ storage: saved });
  const mounted = mount();
  assert.ok(Math.abs(Number.parseFloat(mounted.root.style.top) - before) <= 1, `${mounted.root.style.top} vs ${before}`);
});

await check("拖拽不会触发一次展开", () => {
  const clickScene = bootScene();
  const mounted = mount();
  const tab = mounted.root.querySelector("#udl-tab");

  firePointer(clickScene, tab, "pointerdown", 400);
  firePointer(clickScene, tab, "pointermove", 440);
  firePointer(clickScene, tab, "pointerup", 440);
  tab.dispatchEvent(new clickScene.window.MouseEvent("click", { bubbles: true }));

  assert.equal(mounted.root.classList.contains("udl-open"), false, "拖拽结束的点击应被吞掉");
});

process.stdout.write(`\n通过 ${passed} 项，失败 ${failures.length} 项\n`);
if (failures.length) {
  for (const failure of failures) {
    process.stdout.write(`\n${failure.name}\n${failure.error.stack}\n`);
  }
  process.exitCode = 1;
}
