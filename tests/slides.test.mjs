import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createFixtureServer } from "../tools/serve.mjs";
import { createNodeTransport } from "../tools/node-transport.mjs";
import { buildPdf, countByProbe, countSeries, rasterize, slideAddress } from "../src/slides.js";
import { ToolkitError } from "../src/errors.js";

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

function dataUrlOf(fileName) {
  const bytes = readFileSync(new URL(`./fixtures/${fileName}`, import.meta.url));
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

const server = createFixtureServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const transport = createNodeTransport();

try {
  await check("slideAddress 拼接页号与查询串", () => {
    assert.equal(
      slideAddress({ prefix: "https://example.test/slides/", extension: "png", query: "" }, 7),
      "https://example.test/slides/7.png",
    );
    assert.equal(
      slideAddress({ prefix: "https://example.test/a/", extension: "jpeg", query: "?token=abc" }, 12),
      "https://example.test/a/12.jpeg?token=abc",
    );
  });

  await check("对合成站点数出六页", async () => {
    const series = { prefix: `${origin}/slides/`, extension: "png", query: "" };
    assert.equal(await countSeries(transport, series), 6);
  });

  await check("序列不存在时报告为空", async () => {
    const series = { prefix: `${origin}/slides-missing/`, extension: "png", query: "" };
    await assert.rejects(
      () => countSeries(transport, series),
      (error) => error instanceof ToolkitError && error.code === "empty",
    );
  });

  await check("探测次数远低于线性扫描", async () => {
    const rows = [];
    for (const total of [10, 100, 500, 1000, 1500]) {
      let calls = 0;
      const counted = await countByProbe(async (page) => {
        calls += 1;
        return page <= total;
      }, 1500);
      assert.equal(counted, total);
      rows.push({ total, calls, linear: total });
      // 指数加二分在 1500 页以内不超过 25 次探测，线性扫描需要等于页数。
      assert.ok(calls <= 25, `总页数 ${total} 时探测 ${calls} 次`);
    }
    process.stdout.write(`     页数 / 本实现探测次数 / 线性扫描次数\n`);
    for (const row of rows) {
      process.stdout.write(`     ${String(row.total).padStart(4)} / ${String(row.calls).padStart(2)} / ${row.linear}\n`);
    }
  });

  await check("空序列不探测", async () => {
    let calls = 0;
    assert.equal(
      await countByProbe(async () => {
        calls += 1;
        return false;
      }),
      0,
    );
    assert.equal(calls, 1, "第一页不存在时应立即返回");
  });

  await check("位图真实解码并重编码为 JPEG", async () => {
    const bytes = readFileSync(new URL("../fixtures/site/slides/3.png", import.meta.url));
    const page = await rasterize(new Blob([bytes]), {
      // 注入解码与画布实现，让重编码这一步真的跑一遍。
      // Inject decoding and canvas so the re-encode step actually runs.
      decode: async (blob) => loadImage(Buffer.from(await blob.arrayBuffer())),
      makeCanvas: (width, height) => createCanvas(width, height),
    });
    assert.equal(page.width, 320);
    assert.equal(page.height, 180);
    assert.ok(page.dataUrl.startsWith("data:image/jpeg;base64,"), "应重编码为 JPEG");
    // 只校验编码后的体积位于合理区间：编码器坏掉时要么接近空，要么异常膨胀。
    // Only the encoded size is checked; a broken encoder yields either near-zero or huge output.
    const encoded = Buffer.from(page.dataUrl.split(",")[1], "base64").length;
    assert.ok(encoded > 200 && encoded < 40_000, `编码后 ${encoded} 字节`);
  });

  await check("序列图片一路合成到 PDF", async () => {
    const pages = [];
    for (const index of [1, 2, 3]) {
      const bytes = readFileSync(new URL(`../fixtures/site/slides/${index}.png`, import.meta.url));
      pages.push(
        await rasterize(new Blob([bytes]), {
          decode: async (blob) => loadImage(Buffer.from(await blob.arrayBuffer())),
          makeCanvas: (width, height) => createCanvas(width, height),
        }),
      );
    }
    const pdf = Buffer.from(await buildPdf(jsPDF, pages).arrayBuffer()).toString("latin1");
    assert.equal((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 3);
    assert.deepEqual(
      [...pdf.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((m) => [Number(m[1]), Number(m[2])])[0],
      [960, 540],
    );
  });

  await check("PDF 写出三页并保持页面尺寸", async () => {    const pages = [
      { width: 160, height: 120, dataUrl: dataUrlOf("landscape.jpg") },
      { width: 100, height: 200, dataUrl: dataUrlOf("portrait.jpg") },
      { width: 160, height: 120, dataUrl: dataUrlOf("landscape.jpg") },
    ];
    const blob = buildPdf(jsPDF, pages);
    assert.ok(blob instanceof Blob, "应返回 Blob");
    assert.ok(blob.size > 1000, `体积过小：${blob.size}`);

    const text = Buffer.from(await blob.arrayBuffer()).toString("latin1");
    assert.ok(text.startsWith("%PDF-"), "缺少 PDF 文件头");
    assert.equal((text.match(/\/Type\s*\/Page[^s]/g) || []).length, 3, "页数不符");

    const boxes = [...text.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)].map((matched) => [
      Number(matched[1]),
      Number(matched[2]),
    ]);
    assert.deepEqual(boxes[0], [960, 720], "横向页尺寸");
    assert.deepEqual(boxes[1], [960, 1920], "纵向页尺寸");
  });

  await check("没有页面时拒绝写 PDF", () => {
    assert.throws(() => buildPdf(jsPDF, []), (error) => error instanceof ToolkitError && error.code === "empty");
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
