// 构建：把 src 下的模块打成单个 .user.js，元数据置于首行。
// Build: bundle src modules into one .user.js with the metadata block on top.

import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { META } from "../src/meta.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// 产物放在仓库根目录并纳入版本库：脚本管理器与 jsDelivr 都按仓库路径取文件，
// 放进被忽略的目录会让 @updateURL 指向一个取不到东西的地址。
// The artifact lives at the repository root and is tracked: managers and jsDelivr fetch
// it by repository path, so an ignored directory would make @updateURL dead.
export const ARTIFACT = join(root, "userscript-download-lab.user.js");

export async function buildUserscript(outfile = ARTIFACT) {
  await build({
    entryPoints: [join(root, "src", "main.js")],
    outfile,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    banner: { js: META },
    charset: "utf8",
    legalComments: "none",
    logLevel: "silent",
  });
  return outfile;
}

const invokedDirectly = Boolean(process.argv[1]) && process.argv[1].replaceAll("\\", "/").endsWith("tools/build.mjs");

if (invokedDirectly) {
  const artifact = await buildUserscript();
  const size = readFileSync(artifact).length;
  console.log(`产物已生成：${artifact}（${size} 字节）`);
}
