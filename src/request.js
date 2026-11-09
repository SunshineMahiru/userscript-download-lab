// 请求调度：统一超时、状态码归一与响应类型。见 docs/architecture.md 第六节。
// Request helpers normalising status codes and response types.

import { transportError } from "./errors.js";

const DEFAULT_TIMEOUT = 30_000;

function isFailure(status) {
  return status < 200 || status >= 300;
}

export async function requestText(transport, spec) {
  const response = await transport.request({ ...spec, responseType: "text", timeout: spec.timeout || DEFAULT_TIMEOUT });
  if (isFailure(response.status)) throw transportError(response.status);
  return response.body;
}

export async function requestJson(transport, spec) {
  const response = await transport.request({ ...spec, responseType: "json", timeout: spec.timeout || DEFAULT_TIMEOUT });
  // 204 这类无正文响应按空对象处理，调用方自行判断字段。
  // Bodyless responses are treated as an empty object; callers check fields.
  if (response.status === 204) return {};
  if (isFailure(response.status)) throw transportError(response.status);
  return response.body;
}

export async function requestBlob(transport, spec) {
  const response = await transport.request({ ...spec, responseType: "blob", timeout: spec.timeout || DEFAULT_TIMEOUT });
  if (isFailure(response.status)) throw transportError(response.status);
  return response.body;
}
