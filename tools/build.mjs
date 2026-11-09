// 构建：把 src 下的模块打成单个 .user.js，元数据置于首行。
// Build: bundle src modules into one .user.js with the metadata block on top.

import { build } from "esbuild";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { META } from "../src/meta.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const ARTIFACT = join(root, "dist", "userscript-download-lab.user.js");

export async function buildUserscript() {
  mkdirSync(dirname(ARTIFACT), { recursive: true });
  await build({
    entryPoints: [join(root, "src", "main.js")],
    outfile: ARTIFACT,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    banner: { js: META },
    charset: "utf8",
    legalComments: "none",
    logLevel: "silent",
  });
  return ARTIFACT;
}

const invokedDirectly = Boolean(process.argv[1]) && process.argv[1].replaceAll("\\", "/").endsWith("tools/build.mjs");

if (invokedDirectly) {
  const artifact = await buildUserscript();
  const size = readFileSync(artifact).length;
  console.log(`产物已生成：${artifact}（${size} 字节）`);
}
