import assert from "node:assert/strict";
import { createFixtureServer } from "../tools/serve.mjs";
import { createEngine } from "../src/engine.js";
import { createFixtureAdapter } from "../src/adapters/fixture.js";
import { createManagerTransport } from "../src/transport.js";
import { requestJson } from "../src/request.js";
import { ToolkitError } from "../src/errors.js";

// 错误映射的覆盖：注入的是传输实现，不是伪造业务行为。
// Error-mapping coverage: the transport is injected, business behaviour is not faked.

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

function isCode(code) {
  return (error) => error instanceof ToolkitError && error.code === code;
}

function transportReturningStatus(status) {
  return {
    async request(spec) {
      return { status, body: spec.responseType === "json" ? {} : "" };
    },
  };
}

await check("404 归一为 http-404", async () => {
  await assert.rejects(() => requestJson(transportReturningStatus(404), { url: "https://example.test/x" }), isCode("http-404"));
});

await check("500 归一为 http-5xx", async () => {
  await assert.rejects(() => requestJson(transportReturningStatus(500), { url: "https://example.test/x" }), isCode("http-5xx"));
});

await check("502 同样归一为 http-5xx", async () => {
  await assert.rejects(() => requestJson(transportReturningStatus(502), { url: "https://example.test/x" }), isCode("http-5xx"));
});

await check("其他状态码保留原值", async () => {
  await assert.rejects(() => requestJson(transportReturningStatus(418), { url: "https://example.test/x" }), isCode("http-418"));
});

await check("超时映射为 timeout", async () => {
  const transport = createManagerTransport({ GM_xmlhttpRequest: (options) => options.ontimeout() });
  await assert.rejects(() => transport.request({ url: "https://example.test/x" }), isCode("timeout"));
});

await check("连接失败映射为 network", async () => {
  const transport = createManagerTransport({ GM_xmlhttpRequest: (options) => options.onerror() });
  await assert.rejects(() => transport.request({ url: "https://example.test/x" }), isCode("network"));
});

await check("缺少请求能力时构造即失败", () => {
  assert.throws(() => createManagerTransport({}), isCode("transport-missing"));
});

await check("缺少下载能力时调用即失败", () => {
  const transport = createManagerTransport({ GM_xmlhttpRequest: () => {} });
  assert.throws(() => transport.download({ url: "https://example.test/x", name: "a.pdf" }), isCode("not_enabled"));
});

await check("管理器拒绝下载时保留原错误码", async () => {
  const transport = createManagerTransport({
    GM_xmlhttpRequest: () => {},
    GM_download: (options) => options.onerror({ error: "not_permitted" }),
  });
  await assert.rejects(
    () => transport.download({ url: "https://example.test/x", name: "a.pdf" }),
    (error) => error.code === "not_permitted" && error.hint.length > 0,
  );
});

const server = createFixtureServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  await check("状态有返回但无可下载地址时报告 not-a-file", async () => {
    const adapter = createFixtureAdapter({ origin });
    const engine = createEngine({
      adapter,
      transport: {
        async request(spec) {
          const response = await fetch(spec.url);
          const text = await response.text();
          return { status: response.status, body: spec.responseType === "json" ? JSON.parse(text) : text };
        },
        async download() {},
      },
    });
    const chapter = { id: "ch-1", title: "示例章节", context: {} };
    await assert.rejects(
      () => engine.resolveRef(chapter, { id: "empty-1", name: "空资源.pdf" }),
      isCode("not-a-file"),
    );
  });

  await check("缺少必需能力时报告 capability-missing", () => {
    const adapter = createFixtureAdapter({ origin });
    const broken = { ...adapter, capabilities: { ...adapter.capabilities, listing: false } };
    assert.throws(() => createEngine({ adapter: broken, transport: { request: async () => ({}) } }), isCode("capability-missing"));
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}

process.stdout.write(`\n通过 ${passed} 项，失败 ${failures.length} 项\n`);
if (failures.length) {
  for (const failure of failures) {
    process.stdout.write(`\n${failure.name}\n${failure.error.stack}\n`);
  }
  process.exitCode = 1;
}
