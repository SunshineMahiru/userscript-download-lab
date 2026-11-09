import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { ARTIFACT } from "../tools/build.mjs";
import { createFixtureServer } from "../tools/serve.mjs";

// 其余测试跑的是源码，用户装的却是打包产物；而管理器又把 GM_* 注入脚本作用域，
// 既不挂 window 也不挂 globalThis。这一条按同样的方式执行产物：GM_* 只作为函数参数
// 传进去，全局对象上没有它们。脚本若按 window 或 globalThis 取接口，这里就会失败。
// Other tests run the sources; users install the bundle. Managers also inject GM_* into
// the script scope only — not on window or globalThis. This test runs the bundle the same
// way: GM_* arrive as parameters and nowhere else.

const bundle = readFileSync(ARTIFACT, "utf8");
const server = createFixtureServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

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

async function waitFor(predicate, { timeout = 5000, interval = 20 } = {}) {
  const started = Date.now();
  for (;;) {
    const value = predicate();
    if (value) return value;
    if (Date.now() - started > timeout) throw new Error("等待超时");
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

const chapterHtml = await fetch(`${origin}/chapter/ch-1`).then((response) => response.text());
const dom = new JSDOM(chapterHtml, { url: `${origin}/chapter/ch-1`, runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
Object.defineProperty(window.navigator, "language", { value: "zh-CN", configurable: true });
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });

const downloads = [];
const GM_xmlhttpRequest = ({ url, method = "GET", headers, responseType, onload, onerror }) => {
  fetch(url, { method, headers })
    .then(async (response) => {
      const text = await response.text();
      let body = text;
      if (responseType === "json") {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      onload({ status: response.status, response: body });
    })
    .catch((error) => onerror(error));
};
const GM_download = (spec) => {
  downloads.push({ name: spec.name, url: spec.url });
  spec.onload();
};

// 只通过参数注入，不污染 window 与 globalThis。
// Injected as parameters only; window and globalThis stay clean.
const runInSandbox = new Function("GM_xmlhttpRequest", "GM_download", "window", "document", "location", bundle);

try {
  await check("沙箱作用域下产物能取到接口并挂载面板", () => {
    assert.equal(window.GM_xmlhttpRequest, undefined, "window 上不应有接口");
    assert.equal(globalThis.GM_download, undefined, "globalThis 上不应有接口");
    runInSandbox(GM_xmlhttpRequest, GM_download, window, window.document, window.location);
    const root = window.document.querySelector("#udl-root");
    assert.ok(root, "打包产物没有创建面板");
    assert.equal(root.querySelector("#udl-count").textContent, "0 项");
  });

  const root = window.document.querySelector("#udl-root");

  await check("产物经入口装配后能解析出五项资源", async () => {
    root.querySelector("#udl-parse").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await waitFor(() => root.querySelectorAll(".udl-item").length > 0);
    assert.equal(root.querySelectorAll(".udl-item").length, 5);
    assert.match(root.querySelector("#udl-status").textContent, /已解析 5 项/);
  });

  await check("产物经管理器接口完成下载", async () => {
    root.querySelector("#udl-download").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    await waitFor(() => /已提交|项失败/.test(root.querySelector("#udl-status").textContent));
    assert.equal(downloads.length, 5);
    assert.ok(
      downloads.every((item) => /\.(pdf|pptx|mp4|m3u8)$/i.test(item.name)),
      "文件名应带真实后缀",
    );
  });

  await check("产物自包含且不引用 node 内置模块", () => {
    // esbuild 会在模块交界处留下 `// src/xxx.js` 的注释，那只是面包屑，
    // 不是运行时引用，因此这里检查的是真的 import 与 node: 前缀。
    assert.ok(!/\bfrom\s+["']node:/.test(bundle), "产物不应从 node 内置模块导入");
    assert.ok(!/\brequire\(["']node:/.test(bundle), "产物不应请求 node 内置模块");
    assert.ok(!/(^|\n)\s*import\s+[^(]/.test(bundle), "产物不应留下未打包的 import 语句");
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
