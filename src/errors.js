// 错误类型与错误码。四类来源见 docs/architecture.md 第六节。
// Error type and codes; the four sources are described in docs/architecture.md section 6.

export class ToolkitError extends Error {
  constructor(code, message, hint = "") {
    super(message);
    this.name = "ToolkitError";
    this.code = code;
    this.hint = hint;
  }
}

// 管理器给出的码沿用原值，不自造同义词。
// Manager codes are kept verbatim; no invented synonyms.
export const MANAGER_HINT = {
  not_permitted: "脚本管理器未放行该下载域名。在管理器设置里允许访问后重试。",
  not_whitelisted: "目标域名不在 @connect 声明内。补上声明后重新安装脚本。",
  not_supported: "脚本管理器不支持该资源类型。分片清单通常无法作为单文件下载。",
  not_found: "服务器返回 404，资源可能已被移除。",
  forbidden: "服务器拒绝访问，登录状态可能已过期。",
  not_enabled: "脚本管理器的下载功能处于关闭状态。",
  not_succeeded: "下载被浏览器或管理器中止。",
};

export const TRANSPORT_HINT = {
  timeout: "请求超时，稍后重试。",
  network: "网络请求失败，检查连接后重试。",
  "http-403": "服务器拒绝访问，可能需要重新登录。",
  "http-404": "地址不存在，资源可能已下架。",
  "http-5xx": "服务器内部错误，稍后重试。",
};

export function managerError(info) {
  const code = typeof info === "string" ? info : String((info && (info.error || info.code)) || "error");
  return new ToolkitError(code, `下载失败：${code}`, MANAGER_HINT[code] || "在控制台查看完整错误对象。");
}

export function transportError(status) {
  const code = status === 403 ? "http-403" : status === 404 ? "http-404" : status >= 500 ? "http-5xx" : `http-${status}`;
  return new ToolkitError(code, `请求失败：HTTP ${status}`, TRANSPORT_HINT[code] || "");
}

export function contentError(code, message, hint = "") {
  return new ToolkitError(code, message, hint);
}
