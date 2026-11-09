import assert from "node:assert/strict";
import { createFixtureServer } from "../tools/serve.mjs";

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

try {
  await check("章节页返回内联数据", async () => {
    const response = await fetch(`${base}/chapter/ch-1`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    const html = await response.text();
    assert.match(html, /window\.__LAB__ = /);
    assert.match(html, /doc-1/);
    assert.match(html, /vid-1/);
  });

  await check("未知章节返回 404", async () => {
    const response = await fetch(`${base}/chapter/nope`);
    assert.equal(response.status, 404);
  });

  await check("列表第一页带下一页游标", async () => {
    const response = await fetch(`${base}/api/listing?chapter=ch-1&cursor=0`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.refs.length, 2);
    assert.equal(body.nextCursor, "1");
  });

  await check("列表第二页游标为 null", async () => {
    const response = await fetch(`${base}/api/listing?chapter=ch-1&cursor=1`);
    const body = await response.json();
    assert.equal(body.refs.length, 3);
    assert.equal(body.nextCursor, null);
  });

  await check("状态响应给出绝对地址与过期时间", async () => {
    const response = await fetch(`${base}/api/status/doc-1`);
    const body = await response.json();
    assert.equal(body.download, `${base}/media/doc-1.pdf`);
    assert.equal(body.pdf, `${base}/media/doc-1-preview.pdf`);
    assert.ok(body.expires > Date.now(), "过期时间应晚于当前");
  });

  await check("媒体地址 302 到带签名的地址", async () => {
    const response = await fetch(`${base}/media/doc-1.pdf`, { redirect: "manual" });
    assert.equal(response.status, 302);
    const location = response.headers.get("location");
    assert.match(location, /^\/media\/blob\/doc-1\.pdf\?exp=\d+&token=[0-9a-f]{32}$/);
  });

  await check("签名有效时返回文件并带正确类型", async () => {
    const response = await fetch(`${base}/media/doc-1.pdf`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    const text = await response.text();
    assert.ok(text.startsWith("%PDF-1.4"));
  });

  await check("签名被篡改时返回 403", async () => {
    const redirect = await fetch(`${base}/media/doc-1.pdf`, { redirect: "manual" });
    const location = redirect.headers.get("location").replace(/token=[0-9a-f]{32}/, "token=00000000000000000000000000000000");
    const response = await fetch(`${base}${location}`);
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "invalid signature");
  });

  await check("签名过期时返回 403", async () => {
    const response = await fetch(`${base}/media/expired.pdf`);
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.error, "signature expired");
  });

  await check("视频清单返回分片清单类型", async () => {
    const response = await fetch(`${base}/media/lecture.m3u8`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/vnd.apple.mpegurl");
    const text = await response.text();
    assert.ok(text.startsWith("#EXTM3U"), "清单首行应为 #EXTM3U");
  });

  await check("幻灯片在页数范围内返回图片", async () => {
    const response = await fetch(`${base}/slides/1.png`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    const buffer = Buffer.from(await response.arrayBuffer());
    assert.ok(buffer.length > 100, `图片过小：${buffer.length}`);
    assert.equal(buffer.subarray(1, 4).toString("ascii"), "PNG");
  });

  await check("幻灯片超出页数返回 404", async () => {
    const response = await fetch(`${base}/slides/7.png`);
    assert.equal(response.status, 404);
  });

  await check("预览页引用全部幻灯片图片", async () => {
    const response = await fetch(`${base}/slides-viewer`);
    assert.equal(response.status, 200);
    const html = await response.text();
    const sources = [...html.matchAll(/<img src="([^"]+)"/g)].map((matched) => matched[1]);
    assert.equal(sources.length, 6);
    assert.equal(sources[0], "/slides/1.png");
    assert.equal(sources[5], "/slides/6.png");
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
