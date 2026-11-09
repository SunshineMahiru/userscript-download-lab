// 参考适配器：只针对仓库自带的合成站点，真实站点的适配器不进入本仓库。
// Reference adapter for the bundled fixture site; real-site adapters stay out of this repo.

import { inferKind } from "../filename.js";
import { readObjectAfter } from "../json.js";

const PAYLOAD_ANCHOR = /__LAB__\s*=/;

function readChapterPayload(payloads) {
  for (const text of payloads) {
    const payload = readObjectAfter(text, PAYLOAD_ANCHOR);
    if (payload && payload.chapter) return payload;
  }
  return null;
}

export function createFixtureAdapter({ origin }) {
  if (!origin) throw new Error("createFixtureAdapter 需要 origin");

  return {
    id: "fixture",
    version: 1,
    match: [`${origin}/*`],

    capabilities: {
      listing: true,
      paging: true,
      status: true,
      series: true,
    },

    readChapter(context) {
      const payload = readChapterPayload(context.inlinePayloads || []);
      if (!payload) return null;
      return { id: payload.chapter, title: payload.title || "未命名章节", context: {} };
    },

    listingRequest(chapter, cursor) {
      const query = new URLSearchParams({ chapter: chapter.id, cursor: cursor ?? "0" });
      return { url: `${origin}/api/listing?${query}`, responseType: "text" };
    },

    parseListing(text) {
      const body = JSON.parse(text);
      return { refs: body.refs || [], nextCursor: body.nextCursor ?? null };
    },

    statusRequest(chapter, ref) {
      return {
        url: `${origin}/api/status/${encodeURIComponent(ref.id)}`,
        responseType: "json",
        headers: { Referer: `${origin}/chapter/${chapter.id}` },
      };
    },

    parseStatus(payload, ref) {
      // 候选优先级与架构文档一致：原件、预览、直链。
      // Candidate priority follows the architecture document: original, preview, direct.
      const url = payload.download || payload.pdf || payload.http || "";
      if (!url) return null;
      return {
        refId: ref.id,
        name: ref.name,
        url,
        mimeType: "",
        kind: inferKind(ref.name, url, ref.type),
        expiresAt: typeof payload.expires === "number" ? payload.expires : undefined,
      };
    },

    readSeries(context) {
      // 合成站点的序列固定在 /slides/N.png，页数由已加载的记录推断。
      // The fixture series is fixed at /slides/N.png; the page count comes from loaded entries.
      const pattern = new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/slides/\\d+\\.png$`);
      const numbers = new Set();
      for (const entry of context.entries || []) {
        if (!pattern.test(entry.name)) continue;
        const matched = entry.name.match(/\/(\d+)\.png$/);
        if (matched) numbers.add(Number(matched[1]));
      }
      for (const image of context.document ? context.document.querySelectorAll("img") : []) {
        const matched = String(image.src || "").match(/\/slides\/(\d+)\.png$/);
        if (matched) numbers.add(Number(matched[1]));
      }
      if (numbers.size < 2) return null;
      return { prefix: `${origin}/slides/`, extension: "png", query: "", count: numbers.size };
    },
  };
}
