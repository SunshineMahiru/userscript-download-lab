// 传输层：把「怎么发请求」与「发什么」分开。见 docs/adr/0002。
// Transport separates how a request is sent from what is requested. See docs/adr/0002.

import { ToolkitError, managerError } from "./errors.js";
import { createMessages } from "./messages.js";

// 脚本管理器把接口注入脚本作用域，不一定挂在页面 window 上，因此默认从 globalThis 取，
// 同时接受显式传入的作用域，便于测试替换。
// Managers inject these into the script scope rather than the page window, so default to
// globalThis and still accept an explicit scope for tests.
function resolveApi(scope, name) {
  if (scope && typeof scope[name] === "function") return scope[name];
  return undefined;
}

export function createManagerTransport(scope = globalThis) {
  const messages = createMessages();
  const xmlhttpRequest = resolveApi(scope, "GM_xmlhttpRequest");
  const managerDownload = resolveApi(scope, "GM_download");

  // 缺少请求能力时立刻抛出，不做退让。
  // Fail at once when the manager lacks request capability.
  if (typeof xmlhttpRequest !== "function") {
    throw new ToolkitError("transport-missing", messages.transportMissingRequest, messages.transportMissingRequestHint);
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
          onerror: () => reject(new ToolkitError("network", messages.networkFailed, messages.networkFailedHint)),
          ontimeout: () => reject(new ToolkitError("timeout", messages.requestTimeout, messages.requestTimeoutHint)),
        });
      });
    },

    download(spec) {
      if (typeof managerDownload !== "function") {
        throw new ToolkitError("not_enabled", messages.transportMissingDownload, messages.transportMissingDownloadHint);
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
          ontimeout: () => reject(new ToolkitError("timeout", messages.downloadTimeout, messages.downloadTimeoutHint)),
        });
      });
    },
  };
}
