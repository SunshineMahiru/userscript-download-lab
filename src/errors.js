// 错误类型与错误码。四类来源见 docs/architecture.md 第六节。
// Error type and codes; the four sources are described in docs/architecture.md section 6.

import { createMessages, format } from "./messages.js";

export class ToolkitError extends Error {
  constructor(code, message, hint = "") {
    super(message);
    this.name = "ToolkitError";
    this.code = code;
    this.hint = hint;
  }
}

// 管理器对下载途中遇到的 4xx/5xx 不给内部码，直接给状态短语，这里归一成传输码。
// Managers report HTTP status phrases for failed downloads instead of internal codes.
const HTTP_PHRASES = {
  forbidden: "http-403",
  unauthorized: "http-403",
  "not found": "http-404",
  "internal server error": "http-5xx",
  "bad gateway": "http-5xx",
  "service unavailable": "http-5xx",
  "gateway timeout": "http-5xx",
};

// 管理器给出的码沿用原值，不自造同义词；提示文案按码查表。
// Manager codes are kept verbatim; hints are looked up by code.
export function managerError(info) {
  const messages = createMessages();
  const raw = typeof info === "string" ? info : String((info && (info.error || info.code)) || "error");
  const lowered = raw.toLowerCase();
  const code = HTTP_PHRASES[lowered] || lowered;
  const hint = messages.managerHints[code] || messages.transportHints[code] || messages.unknownManagerHint;
  return new ToolkitError(code, format(messages.downloadFailed, { code }), hint);
}

export function transportError(status) {
  const messages = createMessages();
  const code = status === 403 ? "http-403" : status === 404 ? "http-404" : status >= 500 ? "http-5xx" : `http-${status}`;
  return new ToolkitError(code, format(messages.requestFailed, { status }), messages.transportHints[code] || "");
}

export function contentError(code, message, hint = "") {
  return new ToolkitError(code, message, hint);
}
