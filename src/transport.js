// 传输层：把「怎么发请求」与「发什么」分开。见 docs/adr/0002。
// Transport separates how a request is sent from what is requested. See docs/adr/0002.

import { ToolkitError, managerError } from "./errors.js";

export function createManagerTransport(scope) {
  const xmlhttpRequest = scope.GM_xmlhttpRequest;
  const managerDownload = scope.GM_download;
  const registerMenuCommand = scope.GM_registerMenuCommand;

  // 缺少请求能力时立刻抛出，不做退让。
  // Fail at once when the manager lacks request capability.
  if (typeof xmlhttpRequest !== "function") {
    throw new ToolkitError("transport-missing", "脚本管理器没有提供 GM_xmlhttpRequest", "启用该接口后刷新页面。");
  }

  return {
    request(spec) {
      return new Promise((resolve, reject) => {
        xmlhttpRequest({
          method: spec.method || "GET",
          url: spec.url,
          headers: spec.headers || {},
          responseType: spec.responseType || "text",
          timeout: spec.timeout || 30_000,
          onload: (response) => resolve({ status: response.status, body: response.response }),
          onerror: () => reject(new ToolkitError("network", "网络请求失败", "检查网络连接后重试。")),
          ontimeout: () => reject(new ToolkitError("timeout", "请求超时", "稍后重试。")),
        });
      });
    },

    download(spec) {
      if (typeof managerDownload !== "function") {
        throw new ToolkitError("not_enabled", "脚本管理器没有提供 GM_download", "在管理器里启用下载权限后刷新页面。");
      }
      return new Promise((resolve, reject) => {
        managerDownload({
          url: spec.url,
          name: spec.name,
          saveAs: false,
          headers: spec.headers || {},
          timeout: spec.timeout || 180_000,
          onload: () => resolve(),
          onerror: (info) => reject(managerError(info)),
          ontimeout: () => reject(new ToolkitError("timeout", "下载超时", "资源较大或网络不稳定，稍后重试。")),
        });
      });
    },

    registerMenu(label, handler) {
      if (typeof registerMenuCommand !== "function") return;
      registerMenuCommand(label, handler);
    },
  };
}
