// 测试用传输层：用真实 HTTP 请求打真实服务器，只替换传输手段。见 docs/adr/0002。
// Test transport: real HTTP against a real server; only the transport is swapped.

import { transportError } from "../src/errors.js";

export function createNodeTransport({ log = [] } = {}) {
  return {
    log,
    async request(spec) {
      const response = await fetch(spec.url, { headers: spec.headers || {} });
      const text = await response.text();
      log.push({ kind: "request", url: spec.url, status: response.status });
      let body = text;
      if (spec.responseType === "json" && text) {
        // 错误响应不一定是 JSON，解析失败时保留原文由调用方判断。
        // Error responses are not always JSON; keep the raw text when parsing fails.
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      return { status: response.status, body };
    },
    async download(spec) {
      const response = await fetch(spec.url, { headers: spec.headers || {} });
      log.push({ kind: "download", url: spec.url, status: response.status });
      if (!response.ok) throw transportError(response.status);
      const buffer = Buffer.from(await response.arrayBuffer());
      return { size: buffer.length, type: response.headers.get("content-type") };
    },
    registerMenu() {},
  };
}
