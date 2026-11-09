import assert from "node:assert/strict";
import { fileExtension, inferKind, sanitizeFileName, truncateByBytes } from "../src/filename.js";

let passed = 0;
const failures = [];

function check(name, run) {
  try {
    run();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failures.push({ name, error });
    process.stdout.write(`FAIL ${name} -> ${error.message}\n`);
  }
}

check("fileExtension 取小写后缀", () => {
  assert.equal(fileExtension("讲义.PPTX"), "pptx");
  assert.equal(fileExtension("https://x/y.pdf?token=1#p2"), "pdf");
  assert.equal(fileExtension("无后缀"), "");
});

check("inferKind 依后缀与声明类型判定", () => {
  assert.equal(inferKind("第3章.pptx", "https://x/a.bin", ""), "ppt");
  assert.equal(inferKind("notice", "https://x/a.pdf", ""), "pdf");
  assert.equal(inferKind("clip", "https://x/a.mp4", ""), "video");
  assert.equal(inferKind("sound", "https://x/a.mp3", ""), "audio");
  assert.equal(inferKind("misc", "https://x/a.bin", "video/mp4"), "video");
});

check("sanitizeFileName 让后缀跟随真实地址", () => {
  assert.equal(sanitizeFileName("第3章 绪论.pptx", "https://x/origin/abc.pdf", "ppt"), "第3章 绪论.pdf");
});

check("sanitizeFileName 地址无后缀时保留原名后缀", () => {
  assert.equal(sanitizeFileName("讲义.zip", "https://x/job/download?flag=1", "archive"), "讲义.zip");
});

check("sanitizeFileName 不把 png 当作文件后缀", () => {
  assert.equal(sanitizeFileName("讲义.pptx", "https://x/1.png", "ppt"), "讲义.pptx");
});

check("sanitizeFileName 处理 Windows 保留名与结尾点", () => {
  assert.equal(sanitizeFileName("CON", "", "file"), "_CON");
  assert.equal(sanitizeFileName("报告.", "", "file"), "报告");
});

check("sanitizeFileName 替换非法字符", () => {
  assert.equal(sanitizeFileName("a:b*c?.pdf", "https://x/a.pdf", "pdf"), "a_b_c_.pdf");
});

check("sanitizeFileName 按字节截断且保留后缀", () => {
  const name = sanitizeFileName("课".repeat(200) + ".pdf", "https://x/a.pdf", "pdf");
  const bytes = new TextEncoder().encode(name).length;
  assert.ok(bytes <= 172, `实际 ${bytes} 字节`);
  assert.ok(name.endsWith(".pdf"));
});

check("truncateByBytes 不截断半个汉字", () => {
  const text = truncateByBytes("课件工具", 7);
  assert.equal(text, "课件");
  assert.ok(new TextEncoder().encode(text).length <= 7);
});

process.stdout.write(`\n通过 ${passed} 项，失败 ${failures.length} 项\n`);
if (failures.length) {
  for (const failure of failures) {
    process.stdout.write(`\n${failure.name}\n${failure.error.stack}\n`);
  }
  process.exitCode = 1;
}
