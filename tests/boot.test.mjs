import assert from "node:assert/strict";
import { bootScene } from "./helpers/jsdom-env.mjs";
import { createFixtureServer } from "../tools/serve.mjs";

// 入口层的集成测试：把 GM_* 注入 globalThis，底层仍打真实服务器。
// 注入的是宿主接口的真实实现，不是伪造行为，与 ADR-0002 对传输层的处理一致。
// Entry-level integration: GM_* are injected as real host implementations backed by
// real HTTP, not as stand-ins for behaviour.

const server = createFixtureServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

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

const chapterHtml = await fetch(`${base}/chapter/ch-1`).then((response) => response.text());
const dom = bootScene({ html: chapterHtml, url: `${base}/chapter/ch-1` });

const downloads = [];
const failuresFromManager = new Set([".m3u8"]);

globalThis.GM_xmlhttpRequest = ({ url, method = "GET", headers, responseType, onload, onerror }) => {
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

globalThis.GM_download = (spec) => {
  const suffix = spec.url.slice(spec.url.lastIndexOf("."));
  if (failuresFromManager.has(suffix)) {
    spec.onerror({ error: "not_supported" });
    return;
  }
  downloads.push({ name: spec.name, url: spec.url });
  spec.onload();
};

// 入口在加载时即挂载，因此必须在上面的全局就绪之后再动态引入。
// The entry mounts on load, so import it only after the globals above are ready.
await import("../src/main.js");

const root = dom.window.document.querySelector("#udl-root");
const status = () => root.querySelector("#udl-status").textContent;

await check("入口在顶层页面挂载面板", () => {
  assert.ok(root, "面板根节点未创建");
  assert.equal(root.querySelector("#udl-count").textContent, "0 项");
});

await check("点击解析后列出本章五项资源", async () => {
  root.querySelector("#udl-parse").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => root.querySelectorAll(".udl-item").length > 0);
  assert.equal(root.querySelectorAll(".udl-item").length, 5);
  assert.match(status(), /已解析 5 项/);
  assert.match(root.querySelector("#udl-status").className, /udl-success/);
});

await check("解析后按钮从禁用变为可用", () => {
  const button = root.querySelector("#udl-download");
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "下载选中（5）");
});

await check("下载经管理器接口完成，失败项按条回报", async () => {
  root.querySelector("#udl-download").dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await waitFor(() => /项失败|已提交/.test(status()));

  // 五条里有一条是 m3u8，脚本管理器对该类型报 not_supported。
  assert.equal(downloads.length, 4, `实际提交 ${downloads.length} 次下载`);
  assert.match(status(), /1 项失败/);
  assert.match(root.querySelector("#udl-status").className, /udl-warning/);
});

await check("下载的文件名已规整", () => {
  assert.ok(downloads.every((item) => /\.(pdf|pptx|mp4|m3u8)$/i.test(item.name)), "文件名应带后缀");
  assert.ok(downloads.every((item) => !/[/\\:*?"<>|]/.test(item.name)), "文件名不应含非法字符");
});

await new Promise((resolve) => server.close(resolve));

process.stdout.write(`\n通过 ${passed} 项，失败 ${failures.length} 项\n`);
if (failures.length) {
  for (const failure of failures) {
    process.stdout.write(`\n${failure.name}\n${failure.error.stack}\n`);
  }
  process.exitCode = 1;
}
