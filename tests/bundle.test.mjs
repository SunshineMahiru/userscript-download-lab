import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { ARTIFACT } from "../tools/build.mjs";
import { createFixtureServer } from "../tools/serve.mjs";

// 其余测试跑的是源码，用户装的却是打包产物。这一条直接执行构建好的文件，
// 拦的是「打包后与源码行为不一致」这类只在产物上出现的问题。
// Other tests run the sources; users install the bundle. This one executes the built
// file, catching problems that only exist after bundling.

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

const downloads = [];
window.GM_xmlhttpRequest = ({ url, method = "GET", headers, responseType, onload, onerror }) => {
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
window.GM_download = (spec) => {
  downloads.push({ name: spec.name, url: spec.url });
  spec.onload();
};

try {
  await check("产物可直接执行并挂载面板", () => {
    window.eval(bundle);
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
    // esbuild leaves `// src/xxx.js` breadcrumbs; they are comments, not references,
    // so the check targets real import statements and the node: prefix.
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
