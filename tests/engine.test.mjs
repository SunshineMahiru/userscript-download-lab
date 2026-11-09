import assert from "node:assert/strict";
import { createFixtureServer } from "../tools/serve.mjs";
import { createNodeTransport } from "../tools/node-transport.mjs";
import { createEngine } from "../src/engine.js";
import { createFixtureAdapter } from "../src/adapters/fixture.js";
import { ToolkitError } from "../src/errors.js";

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

async function loadContext(chapterId) {
  const response = await fetch(`${origin}/chapter/${chapterId}`);
  const html = await response.text();
  const payloads = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((matched) => matched[1]);
  return { url: `${origin}/chapter/${chapterId}`, document: null, inlinePayloads: payloads, entries: [] };
}

const adapter = createFixtureAdapter({ origin });

try {
  await check("读到章节标识与标题", async () => {
    const engine = createEngine({ adapter, transport: createNodeTransport() });
    const chapter = await engine.readChapter(await loadContext("ch-1"));
    assert.equal(chapter.id, "ch-1");
    assert.equal(chapter.title, "示例章节");
  });

  await check("页面没有内联数据时报告章节不存在", async () => {
    const engine = createEngine({ adapter, transport: createNodeTransport() });
    await assert.rejects(
      () => engine.readChapter({ url: origin, document: null, inlinePayloads: [], entries: [] }),
      (error) => error instanceof ToolkitError && error.code === "chapter-not-found",
    );
  });

  await check("按游标取全两页共五条引用", async () => {
    const transport = createNodeTransport();
    const engine = createEngine({ adapter, transport });
    const refs = await engine.listRefs(await engine.readChapter(await loadContext("ch-1")));
    assert.equal(refs.length, 5);
    assert.equal(transport.log.filter((item) => item.kind === "request").length, 2);
  });

  await check("导出四件成功、一件因签名过期失败", async () => {
    const transport = createNodeTransport();
    const engine = createEngine({ adapter, transport });
    const outcome = await engine.exportChapter(await loadContext("ch-1"));
    assert.equal(outcome.saved, 4);
    assert.equal(outcome.failed.length, 1);
    assert.equal(outcome.failed[0].code, "http-403");
    assert.match(outcome.failed[0].name, /过期资料/);
  });

  await check("下载经过 302 后抵达带签名的地址", async () => {
    const transport = createNodeTransport();
    const engine = createEngine({ adapter, transport });
    await engine.exportChapter(await loadContext("ch-1"));
    const downloads = transport.log.filter((item) => item.kind === "download");
    assert.equal(downloads.length, 5);
    assert.ok(downloads.every((item) => item.url.includes("/media/")));
  });

  await check("取址结果已规整文件名并带上请求头", async () => {
    const transport = createNodeTransport();
    const engine = createEngine({ adapter, transport });
    const { items, failures } = await engine.resolveAll(await loadContext("ch-1"));
    assert.equal(items.length, 5);
    assert.equal(failures.length, 0);
    assert.ok(items.every((item) => item.name.length > 0), "每条都应有文件名");
    assert.ok(items.every((item) => item.headers && item.headers.Referer), "每条都应带上请求头");
    assert.ok(items.some((item) => item.name.endsWith(".pdf")));
    assert.ok(items.some((item) => item.kind === "video"));
  });

  await check("下载只处理给定条目并逐条回报进度", async () => {
    const transport = createNodeTransport();
    const engine = createEngine({ adapter, transport });
    const { items } = await engine.resolveAll(await loadContext("ch-1"));
    const picked = items.filter((item) => item.kind === "video");
    const progress = [];
    const outcome = await engine.downloadAll(picked, { onItem: (step) => progress.push(step) });
    assert.equal(outcome.saved, picked.length);
    assert.equal(outcome.failed.length, 0);
    assert.equal(progress.length, picked.length, "每条都应回报一次进度");
    assert.equal(progress[0].total, picked.length);
  });

  await check("缺少必需能力时构造引擎即报错", () => {
    const broken = { ...adapter, capabilities: { ...adapter.capabilities, status: false } };
    assert.throws(() => createEngine({ adapter: broken, transport: createNodeTransport() }), /必需能力/);
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
