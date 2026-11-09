import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 合成站点的全部响应都来自 fixtures/site 下的数据文件。
// Every response is derived from the data files under fixtures/site.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const siteDir = join(root, "fixtures", "site");
const readJson = (name) => JSON.parse(readFileSync(join(siteDir, name), "utf8"));

const chapter = readJson("chapter.json");
const listings = readJson("listings.json");
const statuses = readJson("statuses.json");
const slides = readJson("slides.json");
// 固定夹具值，仅用于让签名在多次请求之间保持一致，不具备任何安全含义。
// Fixed fixture value so signatures stay stable across requests; carries no security meaning.
const SIGNING_KEY = "fixture-signing-key";

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp4": "video/mp4",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".png": "image/png",
};

// 占位内容按后缀给出，足够让下游按响应类型判定是否为文件。
// Placeholder bodies keyed by extension, enough for content-type checks downstream.
const BODIES = {
  ".pdf": Buffer.from("%PDF-1.4\n% fixture document\n"),
  ".pptx": Buffer.from("PK\u0003\u0004fixture presentation"),
  ".mp4": Buffer.from("fixture video body"),
  ".m3u8": Buffer.from("#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10.0,\nsegment-1.ts\n#EXT-X-ENDLIST\n"),
};

function sign(file, expiresAt) {
  return createHash("sha256").update(`${file}:${expiresAt}:${SIGNING_KEY}`).digest("hex").slice(0, 32);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function sendText(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location, "Content-Length": 0 });
  res.end();
}

export function createFixtureServer() {
  return createServer((req, res) => {
    const origin = `http://${req.headers.host}`;
    const url = new URL(req.url, origin);
    const path = url.pathname;
    let matched;

    if (path === "/") {
      const links = [
        `/chapter/${chapter.id}`,
        `/slides-viewer`,
        `/api/listing?chapter=${chapter.id}&cursor=0`,
        `/api/status/doc-1`,
        `/slides/1.png`,
      ].map((href) => `<li><a href="${href}">${href}</a></li>`);
      sendText(res, 200, `<!doctype html><meta charset="utf-8"><h1>合成站点</h1><ul>${links.join("")}</ul>`, "text/html; charset=utf-8");
      return;
    }

    // 幻灯片预览页：只有页面里已经加载了图片，序列识别才有东西可数。
    // Slide viewer: sequence detection needs images that the page actually references.
    if (path === "/slides-viewer") {
      const images = Array.from(
        { length: slides.count },
        (_, index) => `<img src="/slides/${index + 1}.png" alt="第 ${index + 1} 页" width="320" height="180">`,
      ).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>幻灯片预览</title></head><body><h1>幻灯片预览</h1><div>${images}</div></body></html>`;
      sendText(res, 200, html, "text/html; charset=utf-8");
      return;
    }

    matched = path.match(/^\/chapter\/([\w-]+)$/);
    if (matched) {
      if (matched[1] !== chapter.id) {
        sendText(res, 404, "chapter not found");
        return;
      }
      const payload = JSON.stringify({ chapter: chapter.id, title: chapter.title, items: chapter.items });
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${chapter.title}</title></head><body><h1>${chapter.title}</h1><script>window.__LAB__ = ${payload};</script></body></html>`;
      sendText(res, 200, html, "text/html; charset=utf-8");
      return;
    }

    if (path === "/api/listing") {
      const cursor = url.searchParams.get("cursor") || "0";
      const page = listings.pages[cursor];
      if (!page) {
        sendJson(res, 404, { error: "cursor out of range" });
        return;
      }
      sendJson(res, 200, { refs: page.refs, nextCursor: page.nextCursor });
      return;
    }

    matched = path.match(/^\/api\/status\/([\w-]+)$/);
    if (matched) {
      const entry = statuses[matched[1]];
      if (!entry) {
        sendJson(res, 404, { error: "resource not found" });
        return;
      }
      const expiresAt = Date.now() + entry.ttl * 1000;
      const body = { expires: expiresAt };
      for (const [key, file] of Object.entries(entry.candidates)) {
        body[key] = `${origin}/media/${file}`;
      }
      sendJson(res, 200, body);
      return;
    }

    matched = path.match(/^\/media\/([\w.-]+)$/);
    if (matched) {
      const file = matched[1];
      const entry = Object.values(statuses).find((item) => Object.values(item.candidates).includes(file));
      if (!entry) {
        sendText(res, 404, "media not found");
        return;
      }
      const expiresAt = Date.now() + entry.ttl * 1000;
      sendRedirect(res, `/media/blob/${file}?exp=${expiresAt}&token=${sign(file, expiresAt)}`);
      return;
    }

    matched = path.match(/^\/media\/blob\/([\w.-]+)$/);
    if (matched) {
      const file = matched[1];
      const expiresAt = Number(url.searchParams.get("exp"));
      const token = url.searchParams.get("token") || "";
      if (!Number.isFinite(expiresAt) || token !== sign(file, expiresAt)) {
        sendJson(res, 403, { error: "invalid signature" });
        return;
      }
      if (Date.now() > expiresAt) {
        sendJson(res, 403, { error: "signature expired" });
        return;
      }
      const extension = extname(file).toLowerCase();
      const body = BODIES[extension];
      if (!body) {
        sendText(res, 404, "unsupported media type");
        return;
      }
      res.writeHead(200, {
        "Content-Type": CONTENT_TYPES[extension],
        "Content-Length": body.length,
      });
      res.end(body);
      return;
    }

    matched = path.match(/^\/slides\/(\d+)\.png$/);
    if (matched) {
      const page = Number(matched[1]);
      if (page < 1 || page > slides.count) {
        sendText(res, 404, "slide out of range");
        return;
      }
      const body = readFileSync(join(siteDir, "slides", `${page}.png`));
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": body.length });
      res.end(body);
      return;
    }

    sendText(res, 404, "not found");
  });
}

const invokedDirectly = Boolean(process.argv[1]) && process.argv[1].replaceAll("\\", "/").endsWith("tools/serve.mjs");

if (invokedDirectly) {
  const port = Number(process.env.PORT) || 8080;
  const server = createFixtureServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`合成站点已启动：http://127.0.0.1:${port}/`);
  });
}
