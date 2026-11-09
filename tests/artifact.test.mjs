import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARTIFACT, buildUserscript } from "../tools/build.mjs";

// 产物纳入版本库，因此必须与源码同步。先记录提交在库里的内容，再构建一次，
// 两者不一致就说明有人改了源码却没重新构建。
// The artifact is tracked, so it has to match the sources. Capture the committed bytes,
// rebuild, and fail when they differ.
const committed = readFileSync(ARTIFACT);
await buildUserscript();
const built = readFileSync(ARTIFACT);
const text = built.toString("utf8");

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

// 禁用词以转义形式书写，避免本仓库自身命中扫描。
// Forbidden terms are written as escapes so this repository does not match its own scan.
const FORBIDDEN = [
  "\u0063\u0068\u0061\u006f\u0078\u0069\u006e\u0067",
  "\u5b66\u4e60\u901a",
  "\u8d85\u661f",
  "\u0078\u0075\u0065\u0078\u0069\u0074\u006f\u006e\u0067",
];

check("产物与源码同步", () => {
  assert.deepEqual(
    built,
    committed,
    "根目录产物与源码不一致，请运行 npm run build 后重新提交",
  );
});

check("产物以元数据块开头", () => {
  assert.ok(text.startsWith("// ==UserScript=="), `实际开头：${text.slice(0, 40)}`);
});

check("产物以立即执行函数结尾", () => {
  assert.ok(text.trimEnd().endsWith("})();"), `实际结尾：${text.slice(-40)}`);
});

check("元数据块只出现一次", () => {
  const count = text.split("// ==UserScript==").length - 1;
  assert.equal(count, 1, `出现 ${count} 次`);
});

check("元数据声明了匹配范围、仓库地址与依赖", () => {
  assert.match(text, /\/\/ @match\s+http:\/\/127\.0\.0\.1:8080\/\*/);
  assert.match(text, /\/\/ @namespace\s+https:\/\/github\.com\/SunshineMahiru\/userscript-download-lab/);
  assert.match(text, /\/\/ @updateURL\s+https:\/\/cdn\.jsdelivr\.net\/gh\/SunshineMahiru\/userscript-download-lab@v1\.0\.0\//);
  assert.match(text, /\/\/ @downloadURL\s+https:\/\/cdn\.jsdelivr\.net\/gh\/SunshineMahiru\/userscript-download-lab@v1\.0\.0\//);
  assert.match(text, /\/\/ @require\s+https:\/\/cdn\.jsdelivr\.net\/npm\/jspdf@4\.2\.1\//);
});

check("更新地址与下载地址一致", () => {
  const update = text.match(/\/\/ @updateURL\s+(\S+)/)[1];
  const download = text.match(/\/\/ @downloadURL\s+(\S+)/)[1];
  assert.equal(update, download, "两者应指向同一个产物");
});

check("产物不含平台字样", () => {
  const hits = FORBIDDEN.filter((term) => text.toLowerCase().includes(term));
  assert.equal(hits.length, 0, `命中 ${hits.length} 个禁用词`);
});

check("产物包含界面与引擎的入口", () => {
  assert.match(text, /function mountPanel/);
  assert.match(text, /function createEngine/);
  assert.match(text, /createFixtureAdapter/);
});

process.stdout.write(`\n通过 ${passed} 项，失败 ${failures.length} 项\n`);
if (failures.length) {
  for (const failure of failures) {
    process.stdout.write(`\n${failure.name}\n${failure.error.stack}\n`);
  }
  process.exitCode = 1;
}
