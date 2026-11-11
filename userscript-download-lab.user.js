// ==UserScript==
// @name         用户脚本下载实验
// @namespace    https://github.com/SunshineMahiru/userscript-download-lab
// @version      1.0.0
// @description  在合成站点上实验用户脚本的取址与下载可靠性；仓库不含任何真实站点实现。
// @match        http://127.0.0.1/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      127.0.0.1
// @homepageURL  https://github.com/SunshineMahiru/userscript-download-lab
// @supportURL   https://github.com/SunshineMahiru/userscript-download-lab/issues
// @require      https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js
// ==/UserScript==
(() => {
  // src/messages.js
  var TABLES = {
    zh: {
      tabChars: ["实", "验", "面", "板"],
      tabLabel: "展开实验面板",
      panelTitle: "本章资源",
      collapseHint: "点击书签收起",
      parse: "解析本章资源",
      resultLabel: "解析结果",
      countUnit: "{count} 项",
      emptyList: "解析后在此列出本章资源",
      download: "下载选中（{count}）",
      downloading: "下载中…",
      composePdf: "合成幻灯片 PDF",
      composing: "合成中…",
      seriesMissing: "未检测到幻灯片序列",
      seriesFound: "已找到幻灯片序列，至少 {count} 页",
      initialStatus: "只处理当前账号有权访问的资源",
      reading: "正在读取本章资源…",
      parsedSome: "已解析 {ok} 项，{failed} 项不可用。",
      parsedAll: "已解析 {count} 项资源。",
      downloadingCount: "正在下载 {count} 项…",
      downloadProgress: "正在下载 {index}/{total}：{name}",
      downloadDone: "已提交 {count} 个文件到浏览器下载。",
      downloadSomeFailed: "{count} 项失败，首个原因：{code} {hint}",
      countingPages: "正在统计页数…",
      composingPage: "正在合成 {page}/{total}",
      writingPdf: "正在写入 PDF…",
      pdfSaved: "已保存 {total} 页，约 {size}。",
      downloadFailed: "下载失败：{code}",
      requestFailed: "请求失败：HTTP {status}",
      unknownManagerHint: "在控制台查看完整错误对象。",
      managerHints: {
        not_permitted: "脚本管理器未放行该下载域名。在管理器设置里允许访问后重试。",
        not_whitelisted: "目标域名不在 @connect 声明内，或管理器不允许直接下载该类型。播放列表通常属于后者。",
        not_supported: "脚本管理器不支持该资源类型。分片清单通常无法作为单文件下载。",
        not_found: "服务器返回 404，资源可能已被移除。",
        forbidden: "服务器拒绝访问，登录状态可能已过期。",
        not_enabled: "脚本管理器的下载功能处于关闭状态。",
        not_succeeded: "下载被浏览器或管理器中止。"
      },
      transportHints: {
        timeout: "请求超时，稍后重试。",
        network: "网络请求失败，检查连接后重试。",
        "http-403": "服务器拒绝访问，可能需要重新登录。",
        "http-404": "地址不存在，资源可能已下架。",
        "http-5xx": "服务器内部错误，稍后重试。"
      },
      transportMissingRequest: "脚本管理器没有提供 GM_xmlhttpRequest",
      transportMissingRequestHint: "启用该接口后刷新页面。",
      transportMissingDownload: "脚本管理器没有提供 GM_download",
      transportMissingDownloadHint: "在管理器里启用下载权限后刷新页面。",
      networkFailed: "网络请求失败",
      networkFailedHint: "检查网络连接后重试。",
      requestTimeout: "请求超时",
      requestTimeoutHint: "稍后重试。",
      downloadTimeout: "下载超时",
      downloadTimeoutHint: "资源较大或网络不稳定，稍后重试。",
      adapterMissing: "当前页面没有可用适配器",
      adapterMissingHint: "在适配器列表里补齐匹配规则。",
      capabilityMissing: "适配器缺少必需能力",
      capabilityMissingHint: "listing 与 status 必须为 true。",
      chapterNotFound: "当前页面不是章节页",
      chapterNotFoundHint: "进入具体章节后再试。",
      notAFile: "未取到可下载地址：{name}",
      notAFileHint: "状态响应里没有可用字段。",
      seriesUnsupported: "该适配器不支持幻灯片序列",
      seriesUnsupportedHint: "只能下载列表里的资源。",
      notASeries: "当前页面没有幻灯片序列",
      notASeriesHint: "该章节可能使用文档或视频阅览器。",
      emptySeries: "未取到任何幻灯片页面",
      emptySeriesHint: "资源可能需要重新登录后才能访问。",
      emptyPages: "没有可写入的页面",
      emptyPagesHint: "",
      dependencyMissing: "jsPDF 未加载",
      dependencyHint: "脚本管理器可能拦截了 @require 的地址。"
    },
    en: {
      tabChars: ["L", "A", "B"],
      tabLabel: "Open the experiment panel",
      panelTitle: "Chapter resources",
      collapseHint: "Click the tab to hide",
      parse: "Parse this chapter",
      resultLabel: "Results",
      countUnit: "{count} items",
      emptyList: "Resources appear here after parsing",
      download: "Download selected ({count})",
      downloading: "Downloading…",
      composePdf: "Compose slide PDF",
      composing: "Composing…",
      seriesMissing: "No slide sequence detected",
      seriesFound: "Sequence found, at least {count} pages",
      initialStatus: "Only resources this account can already access",
      reading: "Reading this chapter…",
      parsedSome: "Parsed {ok}, {failed} unavailable.",
      parsedAll: "Parsed {count} resources.",
      downloadingCount: "Downloading {count} items…",
      downloadProgress: "Downloading {index}/{total}: {name}",
      downloadDone: "Handed {count} files to the browser.",
      downloadSomeFailed: "{count} failed, first reason: {code} {hint}",
      countingPages: "Counting pages…",
      composingPage: "Composing {page}/{total}",
      writingPdf: "Writing the PDF…",
      pdfSaved: "Saved {total} pages, about {size}.",
      downloadFailed: "Download failed: {code}",
      requestFailed: "Request failed: HTTP {status}",
      unknownManagerHint: "Check the console for the full error object.",
      managerHints: {
        not_permitted: "The manager blocks this download host. Allow it in the manager settings and retry.",
        not_whitelisted: "The host is missing from @connect, or the manager refuses this resource type. Playlists usually fall in the second case.",
        not_supported: "The manager does not support this resource type. Segment playlists usually cannot be saved as one file.",
        not_found: "The server returned 404; the resource may be gone.",
        forbidden: "The server refused access; the session may have expired.",
        not_enabled: "Downloads are disabled in the manager.",
        not_succeeded: "The browser or the manager stopped the download."
      },
      transportHints: {
        timeout: "The request timed out. Try again later.",
        network: "The network request failed. Check the connection and retry.",
        "http-403": "The server refused access; signing in again may help.",
        "http-404": "The address does not exist; the resource may be gone.",
        "http-5xx": "The server reported an internal error. Try again later."
      },
      transportMissingRequest: "The manager does not expose GM_xmlhttpRequest",
      transportMissingRequestHint: "Enable it and reload the page.",
      transportMissingDownload: "The manager does not expose GM_download",
      transportMissingDownloadHint: "Enable download permission in the manager and reload the page.",
      networkFailed: "Network request failed",
      networkFailedHint: "Check the connection and retry.",
      requestTimeout: "Request timed out",
      requestTimeoutHint: "Try again later.",
      downloadTimeout: "Download timed out",
      downloadTimeoutHint: "The resource is large or the network is unstable. Try again later.",
      adapterMissing: "No adapter is available for this page",
      adapterMissingHint: "Add a matching rule to the adapter list.",
      capabilityMissing: "The adapter is missing a required capability",
      capabilityMissingHint: "listing and status must both be true.",
      chapterNotFound: "This page is not a chapter page",
      chapterNotFoundHint: "Open a specific chapter and try again.",
      notAFile: "No downloadable address for {name}",
      notAFileHint: "The status response has no usable field.",
      seriesUnsupported: "This adapter has no slide sequence support",
      seriesUnsupportedHint: "Only listed resources can be downloaded.",
      notASeries: "No slide sequence on this page",
      notASeriesHint: "This chapter may use a document or video viewer.",
      emptySeries: "No slide pages were found",
      emptySeriesHint: "The resource may require signing in again.",
      emptyPages: "There are no pages to write",
      emptyPagesHint: "",
      dependencyMissing: "jsPDF is not loaded",
      dependencyHint: "The manager may be blocking the @require URL."
    }
  };
  function detectLocale(language) {
    return String(language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
  }
  function format(template, values = {}) {
    return String(template).replace(/\{(\w+)\}/g, (_, key) => key in values ? String(values[key]) : `{${key}}`);
  }
  function createMessages(locale) {
    const resolved = locale || detectLocale(globalThis.navigator && globalThis.navigator.language);
    return { locale: resolved, ...TABLES[resolved] };
  }

  // src/errors.js
  var ToolkitError = class extends Error {
    constructor(code, message, hint = "") {
      super(message);
      this.name = "ToolkitError";
      this.code = code;
      this.hint = hint;
    }
  };
  var HTTP_PHRASES = {
    forbidden: "http-403",
    unauthorized: "http-403",
    "not found": "http-404",
    "internal server error": "http-5xx",
    "bad gateway": "http-5xx",
    "service unavailable": "http-5xx",
    "gateway timeout": "http-5xx"
  };
  function managerError(info) {
    const messages2 = createMessages();
    const raw = typeof info === "string" ? info : String(info && (info.error || info.code) || "error");
    const lowered = raw.toLowerCase();
    const code = HTTP_PHRASES[lowered] || lowered;
    const hint = messages2.managerHints[code] || messages2.transportHints[code] || messages2.unknownManagerHint;
    return new ToolkitError(code, format(messages2.downloadFailed, { code }), hint);
  }
  function transportError(status) {
    const messages2 = createMessages();
    const code = status === 403 ? "http-403" : status === 404 ? "http-404" : status >= 500 ? "http-5xx" : `http-${status}`;
    return new ToolkitError(code, format(messages2.requestFailed, { status }), messages2.transportHints[code] || "");
  }
  function contentError(code, message, hint = "") {
    return new ToolkitError(code, message, hint);
  }

  // src/request.js
  var DEFAULT_TIMEOUT = 3e4;
  function isFailure(status) {
    return status < 200 || status >= 300;
  }
  async function requestText(transport, spec) {
    const response = await transport.request({ ...spec, responseType: "text", timeout: spec.timeout || DEFAULT_TIMEOUT });
    if (isFailure(response.status)) throw transportError(response.status);
    return response.body;
  }
  async function requestJson(transport, spec) {
    const response = await transport.request({ ...spec, responseType: "json", timeout: spec.timeout || DEFAULT_TIMEOUT });
    if (response.status === 204) return {};
    if (isFailure(response.status)) throw transportError(response.status);
    return response.body;
  }
  async function requestBlob(transport, spec) {
    const response = await transport.request({ ...spec, responseType: "blob", timeout: spec.timeout || DEFAULT_TIMEOUT });
    if (isFailure(response.status)) throw transportError(response.status);
    return response.body;
  }

  // src/filename.js
  var KIND_BY_EXTENSION = {
    pdf: "pdf",
    ppt: "ppt",
    pptx: "ppt",
    pps: "ppt",
    ppsx: "ppt",
    doc: "word",
    docx: "word",
    wps: "word",
    xls: "sheet",
    xlsx: "sheet",
    csv: "sheet",
    mp4: "video",
    m3u8: "video",
    flv: "video",
    avi: "video",
    mov: "video",
    mkv: "video",
    mp3: "audio",
    m4a: "audio",
    wav: "audio",
    zip: "archive",
    rar: "archive",
    "7z": "archive"
  };
  var KIND_LABEL = {
    pdf: "PDF",
    ppt: "PPT",
    word: "WORD",
    sheet: "表格",
    video: "视频",
    audio: "音频",
    archive: "压缩包",
    file: "文件"
  };
  var DEFAULT_NAME_BYTE_LIMIT = 168;
  var WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  function fileExtension(value) {
    const path = String(value || "").split("?")[0].split("#")[0];
    const matched = path.match(/\.([a-z0-9]{1,8})$/i);
    return matched ? matched[1].toLowerCase() : "";
  }
  function inferKind(name, url, declaredType) {
    const fromName = fileExtension(name);
    const fromUrl = fileExtension(url);
    if (KIND_BY_EXTENSION[fromName]) return KIND_BY_EXTENSION[fromName];
    if (KIND_BY_EXTENSION[fromUrl]) return KIND_BY_EXTENSION[fromUrl];
    const type = String(declaredType || "").toLowerCase();
    if (type.includes("video")) return "video";
    if (type.includes("audio")) return "audio";
    if (type.includes("pdf")) return "pdf";
    if (type.includes("ppt")) return "ppt";
    if (type.includes("word") || type.includes("doc")) return "word";
    if (type.includes("sheet") || type.includes("excel")) return "sheet";
    return "file";
  }
  function truncateByBytes(text, maxBytes) {
    const encoder = new TextEncoder();
    let used = 0;
    let output = "";
    for (const char of text) {
      used += encoder.encode(char).length;
      if (used > maxBytes) return output;
      output += char;
    }
    return output;
  }
  function sanitizeFileName(raw, url, kind, limit = DEFAULT_NAME_BYTE_LIMIT) {
    const cleaned = String(raw || "文件").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim();
    const nameExtension = fileExtension(cleaned);
    const urlExtension = fileExtension(url);
    let extension = nameExtension;
    if (urlExtension && KIND_BY_EXTENSION[urlExtension] && urlExtension !== nameExtension) {
      extension = urlExtension;
    }
    if (!extension) {
      extension = { pdf: "pdf", ppt: "ppt", word: "docx", video: "mp4", audio: "mp3" }[kind] || "";
    }
    let base = nameExtension ? cleaned.slice(0, cleaned.length - nameExtension.length - 1) : cleaned;
    base = base.replace(/[. ]+$/, "").trim();
    base = truncateByBytes(base, limit).replace(/[. ]+$/, "").trim() || "文件";
    if (WINDOWS_RESERVED.test(base)) base = `_${base}`;
    return extension ? `${base}.${extension}` : base;
  }

  // src/engine.js
  function createEngine({ adapter, transport }) {
    const messages2 = createMessages();
    if (!adapter) {
      throw new ToolkitError("adapter-missing", messages2.adapterMissing, messages2.adapterMissingHint);
    }
    if (!adapter.capabilities.listing || !adapter.capabilities.status) {
      throw new ToolkitError("capability-missing", messages2.capabilityMissing, messages2.capabilityMissingHint);
    }
    async function readChapter(context) {
      const chapter = adapter.readChapter(context);
      if (!chapter) {
        throw new ToolkitError("chapter-not-found", messages2.chapterNotFound, messages2.chapterNotFoundHint);
      }
      return chapter;
    }
    async function listRefs(chapter) {
      const refs = [];
      let cursor = null;
      for (; ; ) {
        const spec = adapter.listingRequest(chapter, cursor);
        if (!spec) break;
        const text = await requestText(transport, spec);
        const page = adapter.parseListing(text, cursor);
        refs.push(...page.refs);
        if (!adapter.capabilities.paging || !page.nextCursor) break;
        cursor = page.nextCursor;
      }
      return refs;
    }
    async function resolveRef(chapter, ref) {
      const spec = adapter.statusRequest(chapter, ref);
      const payload = await requestJson(transport, spec);
      const resource = adapter.parseStatus(payload, ref);
      if (!resource) {
        throw contentError(
          "not-a-file",
          format(messages2.notAFile, { name: ref.name }),
          messages2.notAFileHint
        );
      }
      return { resource, spec };
    }
    async function resolveAll(context) {
      const chapter = await readChapter(context);
      const refs = await listRefs(chapter);
      const items = [];
      const failures = [];
      for (const ref of refs) {
        try {
          const { resource, spec } = await resolveRef(chapter, ref);
          const kind = resource.kind || inferKind(ref.name, resource.url, ref.type);
          items.push({
            ...resource,
            kind,
            name: sanitizeFileName(resource.name || ref.name, resource.url, kind),
            // 下载沿用取址时的请求头，保持同一资源的请求上下文。
            // Keep the headers used during resolution so one resource keeps one context.
            headers: spec.headers || {}
          });
        } catch (error) {
          failures.push({ name: ref.name, code: error.code || "error", hint: error.hint || "" });
        }
      }
      return { chapter, items, failures };
    }
    async function downloadAll(items, { onItem } = {}) {
      const failures = [];
      let saved = 0;
      for (const [index, item] of items.entries()) {
        if (onItem) onItem({ index, total: items.length, name: item.name });
        try {
          await transport.download({ url: item.url, name: item.name, headers: item.headers || {} });
          saved += 1;
        } catch (error) {
          failures.push({ name: item.name, url: item.url, code: error.code || "error", hint: error.hint || "" });
        }
      }
      return { saved, failed: failures };
    }
    async function exportChapter(context, options) {
      const { items, failures } = await resolveAll(context);
      const outcome = await downloadAll(items, options);
      return { saved: outcome.saved, failed: [...failures, ...outcome.failed] };
    }
    return { readChapter, listRefs, resolveRef, resolveAll, downloadAll, exportChapter };
  }

  // src/json.js
  function locateJsonObject(text, fromIndex) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = fromIndex; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(fromIndex, index + 1);
      }
    }
    return "";
  }
  function readObjectAfter(text, anchor) {
    const matched = anchor.exec(text);
    if (!matched) return null;
    const start = text.indexOf("{", matched.index);
    if (start < 0) return null;
    const body = locateJsonObject(text, start);
    if (!body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  // src/adapters/fixture.js
  var PAYLOAD_ANCHOR = /__LAB__\s*=/;
  function readChapterPayload(payloads) {
    for (const text of payloads) {
      const payload = readObjectAfter(text, PAYLOAD_ANCHOR);
      if (payload && payload.chapter) return payload;
    }
    return null;
  }
  function createFixtureAdapter({ origin }) {
    if (!origin) throw new Error("createFixtureAdapter 需要 origin");
    return {
      id: "fixture",
      version: 1,
      match: [`${origin}/*`],
      capabilities: {
        listing: true,
        paging: true,
        status: true,
        series: true
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
          headers: { Referer: `${origin}/chapter/${chapter.id}` }
        };
      },
      parseStatus(payload, ref) {
        const url = payload.download || payload.pdf || payload.http || "";
        if (!url) return null;
        return {
          refId: ref.id,
          name: ref.name,
          url,
          mimeType: "",
          kind: inferKind(ref.name, url, ref.type),
          expiresAt: typeof payload.expires === "number" ? payload.expires : void 0
        };
      },
      readSeries(context) {
        const pattern = new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/slides/\\d+\\.png$`);
        const numbers = /* @__PURE__ */ new Set();
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
      }
    };
  }

  // src/transport.js
  var SANDBOX_APIS = {
    GM_xmlhttpRequest: () => typeof GM_xmlhttpRequest === "function" ? GM_xmlhttpRequest : void 0,
    GM_download: () => typeof GM_download === "function" ? GM_download : void 0
  };
  function resolveApi(scope, name) {
    if (scope && typeof scope[name] === "function") return scope[name];
    if (typeof globalThis[name] === "function") return globalThis[name];
    const fromSandbox = SANDBOX_APIS[name];
    return fromSandbox ? fromSandbox() : void 0;
  }
  function createManagerTransport(scope = globalThis) {
    const messages2 = createMessages();
    const xmlhttpRequest = resolveApi(scope, "GM_xmlhttpRequest");
    const managerDownload = resolveApi(scope, "GM_download");
    if (typeof xmlhttpRequest !== "function") {
      throw new ToolkitError("transport-missing", messages2.transportMissingRequest, messages2.transportMissingRequestHint);
    }
    return {
      request(spec) {
        return new Promise((resolve, reject) => {
          xmlhttpRequest({
            method: spec.method || "GET",
            url: spec.url,
            headers: spec.headers || {},
            responseType: spec.responseType || "text",
            timeout: spec.timeout || 3e4,
            onload: (response) => resolve({ status: response.status, body: response.response }),
            onerror: () => reject(new ToolkitError("network", messages2.networkFailed, messages2.networkFailedHint)),
            ontimeout: () => reject(new ToolkitError("timeout", messages2.requestTimeout, messages2.requestTimeoutHint))
          });
        });
      },
      download(spec) {
        if (typeof managerDownload !== "function") {
          throw new ToolkitError("not_enabled", messages2.transportMissingDownload, messages2.transportMissingDownloadHint);
        }
        return new Promise((resolve, reject) => {
          managerDownload({
            url: spec.url,
            name: spec.name,
            saveAs: false,
            headers: spec.headers || {},
            timeout: spec.timeout || 18e4,
            onload: () => resolve(),
            onerror: (info) => reject(managerError(info)),
            ontimeout: () => reject(new ToolkitError("timeout", messages2.downloadTimeout, messages2.downloadTimeoutHint))
          });
        });
      }
    };
  }

  // src/ui.js
  var BRAND_COLOR = "#2f6fd0";
  var TAB_MARGIN = 10;
  var TAB_SNAP = 16;
  var STORAGE_KEY = "udl-tab-ratio-v1";
  function escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  var STYLE = `
  #udl-root { position: fixed; z-index: 2147483000; left: 0; top: 50%; transform: translateY(-50%); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif; color: #26344a; }
  #udl-root *, #udl-root *::before, #udl-root *::after { box-sizing: border-box; }
  #udl-tab { width: 52px; min-height: 104px; border: 0; border-radius: 0 12px 12px 0; background: ${BRAND_COLOR}; color: #fff; box-shadow: 2px 4px 14px rgba(19, 59, 128, .24); cursor: grab; touch-action: none; user-select: none; font: 600 16px/1.35 "Microsoft YaHei", sans-serif; letter-spacing: .1em; }
  #udl-tab:active { cursor: grabbing; }
  .udl-tab-text { display: grid; grid-template-columns: repeat(2, 1em); justify-content: center; gap: 3px 5px; }
  #udl-panel { display: none; position: absolute; left: 64px; top: 50%; width: 386px; transform: translateY(-50%); padding: 16px; border: 1px solid #dbe5f5; border-radius: 14px; background: #fff; box-shadow: 0 12px 32px rgba(23, 57, 101, .17); }
  #udl-root.udl-open #udl-panel { display: block; }
  .udl-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; font-weight: 700; color: #1d3157; }
  .udl-head small { font-weight: 400; color: #7c8aa3; }
  .udl-action { width: 100%; height: 38px; border: 0; border-radius: 8px; background: ${BRAND_COLOR}; color: #fff; cursor: pointer; font: 600 14px "Microsoft YaHei", sans-serif; }
  .udl-action:hover { background: #2560ba; }
  .udl-action:disabled { opacity: .55; cursor: not-allowed; }
  .udl-sub { margin: 14px 0 6px; display: flex; align-items: center; justify-content: space-between; color: #5b6b85; font-size: 12px; }
  #udl-list { height: 190px; overflow-y: auto; margin: 0; border: 1px solid #e1e9f6; border-radius: 9px; background: #f9fbff; }
  .udl-empty { margin: 0; padding: 72px 14px; text-align: center; color: #9ba8ba; }
  .udl-item { display: flex; align-items: center; min-height: 46px; padding: 7px 9px; gap: 8px; border-bottom: 1px solid #e8eef8; cursor: pointer; }
  .udl-item:last-child { border-bottom: 0; }
  .udl-item:hover { background: #eff5ff; }
  .udl-check { width: 15px; height: 15px; margin: 0; accent-color: ${BRAND_COLOR}; cursor: pointer; }
  .udl-kind { min-width: 38px; padding: 2px 4px; border-radius: 4px; background: #e7eefa; color: #4f6b99; text-align: center; font-size: 10px; font-weight: 700; }
  .udl-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #3c4d6b; }
  .udl-status { min-height: 20px; margin: 10px 1px 0; color: #77869c; font-size: 12px; }
  .udl-status.udl-success { color: #16805c; }
  .udl-status.udl-warning { color: #b57616; }
  .udl-status.udl-error { color: #bc3a46; }
  .udl-hint { margin: 4px 0 8px; color: #8794a8; font-size: 12px; }
  .udl-download { margin-top: 12px; background: #1ea876; }
  .udl-download:hover { background: #16895f; }
  .udl-section { margin-top: 14px; padding-top: 12px; border-top: 1px dashed #e2e9f5; }
`;
  function readStoredRatio() {
    try {
      const stored = Number.parseFloat(localStorage.getItem(STORAGE_KEY) || "");
      return Number.isFinite(stored) ? stored : null;
    } catch {
      return null;
    }
  }
  function writeStoredRatio(ratio) {
    try {
      localStorage.setItem(STORAGE_KEY, String(ratio));
    } catch {
    }
  }
  function mountPanel({ onParse, onDownload, onPdf }) {
    const messages2 = createMessages();
    const root = document.createElement("aside");
    root.id = "udl-root";
    root.innerHTML = `
    <style>${STYLE}</style>
    <button id="udl-tab" type="button" aria-expanded="false" aria-label="${messages2.tabLabel}">
      <span class="udl-tab-text">${messages2.tabChars.map((char) => `<span>${char}</span>`).join("")}</span>
    </button>
    <section id="udl-panel" aria-label="${messages2.panelTitle}">
      <div class="udl-head"><span>${messages2.panelTitle}</span><small>${messages2.collapseHint}</small></div>
      <button id="udl-parse" class="udl-action" type="button">${messages2.parse}</button>
      <div class="udl-sub"><span>${messages2.resultLabel}</span><span id="udl-count">${format(messages2.countUnit, { count: 0 })}</span></div>
      <div id="udl-list"><p class="udl-empty">${messages2.emptyList}</p></div>
      <button id="udl-download" class="udl-action udl-download" type="button" disabled>${format(messages2.download, { count: 0 })}</button>
      <div class="udl-section">
        <button id="udl-pdf" class="udl-action" type="button">${messages2.composePdf}</button>
        <p id="udl-hint" class="udl-hint">${messages2.seriesMissing}</p>
      </div>
      <p id="udl-status" class="udl-status">${messages2.initialStatus}</p>
    </section>
  `;
    document.documentElement.appendChild(root);
    let resources = [];
    let busy = false;
    let pdfBusy = false;
    let series = null;
    let open = false;
    let drag = null;
    let swallowClick = false;
    function setStatus(message, tone) {
      const node = root.querySelector("#udl-status");
      node.className = `udl-status${tone ? ` udl-${tone}` : ""}`;
      node.textContent = message;
    }
    function selected() {
      return resources.filter((item) => item.selected);
    }
    function renderList() {
      const list = root.querySelector("#udl-list");
      const count = root.querySelector("#udl-count");
      const button = root.querySelector("#udl-download");
      count.textContent = format(messages2.countUnit, { count: resources.length });
      button.disabled = busy || selected().length === 0;
      button.textContent = busy ? messages2.downloading : format(messages2.download, { count: selected().length });
      if (!resources.length) {
        list.innerHTML = `<p class="udl-empty">${messages2.emptyList}</p>`;
        return;
      }
      list.innerHTML = resources.map(
        (item, index) => `
      <label class="udl-item" title="${escapeHtml(item.name)}">
        <input class="udl-check" type="checkbox" data-index="${index}" ${item.selected ? "checked" : ""}>
        <span class="udl-kind">${KIND_LABEL[item.kind] || "文件"}</span>
        <span class="udl-name">${escapeHtml(item.name)}</span>
      </label>`
      ).join("");
      for (const checkbox of list.querySelectorAll(".udl-check")) {
        checkbox.addEventListener("change", (event) => {
          resources[Number(event.currentTarget.dataset.index)].selected = event.currentTarget.checked;
          renderList();
        });
      }
    }
    function renderPdf() {
      const button = root.querySelector("#udl-pdf");
      const hint = root.querySelector("#udl-hint");
      button.disabled = pdfBusy;
      button.textContent = pdfBusy ? messages2.composing : messages2.composePdf;
      hint.textContent = series ? format(messages2.seriesFound, { count: series.count }) : messages2.seriesMissing;
    }
    function setOpen(next) {
      open = next;
      root.classList.toggle("udl-open", next);
      root.querySelector("#udl-tab").setAttribute("aria-expanded", String(next));
    }
    function clamp(value, minimum, maximum) {
      return Math.min(Math.max(value, minimum), maximum);
    }
    function tabRange() {
      const maximum = Math.max(TAB_MARGIN, window.innerHeight - root.offsetHeight - TAB_MARGIN);
      return { minimum: TAB_MARGIN, maximum };
    }
    function setTop(top, persist) {
      const range = tabRange();
      const safe = clamp(top, range.minimum, range.maximum);
      root.style.top = `${safe}px`;
      root.style.transform = "none";
      if (!persist) return;
      const span = range.maximum - range.minimum;
      writeStoredRatio(span === 0 ? 0 : (safe - range.minimum) / span);
    }
    function restoreTop() {
      const range = tabRange();
      const stored = readStoredRatio();
      const ratio = stored === null ? 0.5 : clamp(stored, 0, 1);
      setTop(range.minimum + (range.maximum - range.minimum) * ratio, false);
    }
    function bindDrag() {
      const tab = root.querySelector("#udl-tab");
      tab.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 && event.pointerType !== "touch") return;
        const rect = root.getBoundingClientRect();
        setTop(rect.top, false);
        drag = { pointerId: event.pointerId, startY: event.clientY, startTop: rect.top, moved: false };
        tab.setPointerCapture(event.pointerId);
      });
      tab.addEventListener("pointermove", (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const offset = event.clientY - drag.startY;
        if (Math.abs(offset) > 4) drag.moved = true;
        if (!drag.moved) return;
        setTop(drag.startTop + offset, false);
        event.preventDefault();
      });
      const finish = (event) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (drag.moved) {
          const range = tabRange();
          const current = root.getBoundingClientRect().top;
          setTop(range.minimum + Math.round((current - range.minimum) / TAB_SNAP) * TAB_SNAP, true);
          swallowClick = true;
        }
        drag = null;
        if (tab.hasPointerCapture(event.pointerId)) tab.releasePointerCapture(event.pointerId);
      };
      tab.addEventListener("pointerup", finish);
      tab.addEventListener("pointercancel", finish);
      window.addEventListener("resize", restoreTop);
    }
    function bindDismiss() {
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (open && !root.contains(event.target)) setOpen(false);
        },
        true
      );
      window.addEventListener("blur", () => {
        window.setTimeout(() => {
          if (open && document.activeElement && document.activeElement.tagName === "IFRAME") setOpen(false);
        }, 0);
      });
    }
    root.querySelector("#udl-tab").addEventListener("click", (event) => {
      if (swallowClick) {
        swallowClick = false;
        event.preventDefault();
        return;
      }
      setOpen(!open);
    });
    const parseButton = root.querySelector("#udl-parse");
    parseButton.addEventListener("click", () => onParse({ setBusy: (value) => parseButton.disabled = value }));
    const downloadButton = root.querySelector("#udl-download");
    downloadButton.addEventListener("click", () => {
      if (busy) return;
      onDownload(selected());
    });
    const pdfButton = root.querySelector("#udl-pdf");
    pdfButton.addEventListener("click", () => {
      if (pdfBusy) return;
      onPdf();
    });
    restoreTop();
    bindDrag();
    bindDismiss();
    renderList();
    renderPdf();
    return {
      setStatus,
      setResources(next) {
        resources = next;
        renderList();
      },
      setBusy(value) {
        busy = value;
        renderList();
      },
      setPdfBusy(value) {
        pdfBusy = value;
        renderPdf();
      },
      setSeries(next) {
        series = next;
        renderPdf();
      },
      isOpen() {
        return open;
      }
    };
  }

  // src/slides.js
  var DEFAULT_MAX_PAGES = 1500;
  var DEFAULT_PAGE_WIDTH = 960;
  var DEFAULT_JPEG_QUALITY = 0.92;
  function slideAddress(series, page) {
    return `${series.prefix}${page}.${series.extension}${series.query || ""}`;
  }
  async function countByProbe(probe, maxPages = DEFAULT_MAX_PAGES) {
    if (!await probe(1)) return 0;
    let low = 1;
    let high = 2;
    while (high <= maxPages && await probe(high)) {
      low = high;
      high *= 2;
    }
    high = Math.min(high, maxPages + 1);
    while (high - low > 1) {
      const middle = low + high >> 1;
      if (await probe(middle)) low = middle;
      else high = middle;
    }
    return low;
  }
  async function countSeries(transport, series, { maxPages = DEFAULT_MAX_PAGES } = {}) {
    const counted = await countByProbe(async (page) => {
      const response = await transport.request({ url: slideAddress(series, page), responseType: "blob" });
      return response.status >= 200 && response.status < 300;
    }, maxPages);
    if (!counted) {
      const messages2 = createMessages();
      throw new ToolkitError("empty", messages2.emptySeries, messages2.emptySeriesHint);
    }
    return counted;
  }
  function createSlideFetcher(transport, series, { headers = {}, timeout } = {}) {
    const cache = /* @__PURE__ */ new Map();
    function fetchPage(page) {
      const key = `${series.prefix}|${page}`;
      if (!cache.has(key)) {
        cache.set(key, requestBlob(transport, { url: slideAddress(series, page), headers, timeout }));
      }
      return cache.get(key);
    }
    function release(page) {
      cache.delete(`${series.prefix}|${page}`);
    }
    return { fetchPage, release };
  }
  function defaultDecode(blob) {
    return createImageBitmap(blob);
  }
  function defaultMakeCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  async function rasterize(blob, { quality = DEFAULT_JPEG_QUALITY, decode = defaultDecode, makeCanvas = defaultMakeCanvas } = {}) {
    const bitmap = await decode(blob);
    const canvas = makeCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, bitmap.width, bitmap.height);
    context.drawImage(bitmap, 0, 0);
    const size = { width: bitmap.width, height: bitmap.height };
    if (typeof bitmap.close === "function") bitmap.close();
    return { ...size, dataUrl: canvas.toDataURL("image/jpeg", quality) };
  }
  function buildPdf(jsPDF, pages, { pageWidth = DEFAULT_PAGE_WIDTH } = {}) {
    if (!pages.length) {
      const messages2 = createMessages();
      throw new ToolkitError("empty", messages2.emptyPages, messages2.emptyPagesHint);
    }
    const heightOf = (page) => Math.round(pageWidth * page.height / page.width);
    const orientationOf = (page) => heightOf(page) >= pageWidth ? "portrait" : "landscape";
    const first = pages[0];
    const pdf = new jsPDF({
      unit: "pt",
      format: [pageWidth, heightOf(first)],
      orientation: orientationOf(first),
      compress: true
    });
    pages.forEach((page, index) => {
      const height = heightOf(page);
      if (index > 0) pdf.addPage([pageWidth, height], orientationOf(page));
      pdf.addImage(page.dataUrl, "JPEG", 0, 0, pageWidth, height, void 0, "FAST");
    });
    return pdf.output("blob");
  }
  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 6e4);
  }

  // src/main.js
  var messages = createMessages();
  var FIXTURE_ORIGIN = location.origin;
  function collectContext() {
    return {
      url: location.href,
      document,
      inlinePayloads: Array.from(document.scripts).map((script) => script.textContent || ""),
      // 部分受限上下文没有 Resource Timing，此时只依赖 DOM。
      // Some restricted contexts lack Resource Timing; fall back to the DOM alone.
      entries: typeof performance.getEntriesByType === "function" ? performance.getEntriesByType("resource") : []
    };
  }
  function formatSize(bytes) {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  function jsPdfNamespace() {
    const namespace = typeof jspdf !== "undefined" ? jspdf : window.jspdf;
    if (!namespace || typeof namespace.jsPDF !== "function") {
      throw new ToolkitError("dependency-missing", messages.dependencyMissing, messages.dependencyHint);
    }
    return namespace.jsPDF;
  }
  function createSeriesProbe(adapter) {
    return function probeSeries() {
      if (!adapter.capabilities.series || typeof adapter.readSeries !== "function") return null;
      try {
        return adapter.readSeries(collectContext());
      } catch (error) {
        console.warn("[序列探测失败]", error);
        return null;
      }
    };
  }
  function guard(panel, action) {
    Promise.resolve().then(action).catch((error) => {
      console.error("[用户脚本下载实验]", error);
      const message = error instanceof ToolkitError ? error.message : String(error && error.message || error);
      const hint = error instanceof ToolkitError ? error.hint : "";
      panel.setStatus(hint ? `${message} ${hint}` : message, "error");
    });
  }
  function boot() {
    if (window.top !== window.self) return;
    const adapter = createFixtureAdapter({ origin: FIXTURE_ORIGIN });
    const transport = createManagerTransport();
    const engine = createEngine({ adapter, transport });
    const probeSeries = createSeriesProbe(adapter);
    let resources = [];
    let panel;
    panel = mountPanel({
      onParse({ setBusy }) {
        guard(panel, async () => {
          setBusy(true);
          panel.setStatus(messages.reading);
          try {
            const { items, failures } = await engine.resolveAll(collectContext());
            resources = items.map((item) => ({ ...item, selected: true }));
            panel.setResources(resources);
            panel.setSeries(probeSeries());
            if (failures.length) {
              panel.setStatus(format(messages.parsedSome, { ok: items.length, failed: failures.length }), "warning");
            } else {
              panel.setStatus(format(messages.parsedAll, { count: items.length }), "success");
            }
          } finally {
            setBusy(false);
          }
        });
      },
      onDownload(selected) {
        guard(panel, async () => {
          if (!selected.length) return;
          panel.setBusy(true);
          panel.setStatus(format(messages.downloadingCount, { count: selected.length }));
          try {
            const outcome = await engine.downloadAll(selected, {
              onItem: ({ index, total, name }) => panel.setStatus(format(messages.downloadProgress, { index: index + 1, total, name }))
            });
            if (!outcome.failed.length) {
              panel.setStatus(format(messages.downloadDone, { count: outcome.saved }), "success");
              return;
            }
            const first = outcome.failed[0];
            for (const failure of outcome.failed) {
              console.warn("[下载失败]", failure.name, failure.code, failure.url, failure.hint);
            }
            panel.setStatus(
              format(messages.downloadSomeFailed, { count: outcome.failed.length, code: first.code, hint: first.hint }),
              "warning"
            );
          } finally {
            panel.setBusy(false);
          }
        });
      },
      onPdf() {
        guard(panel, async () => {
          if (!adapter.capabilities.series || typeof adapter.readSeries !== "function") {
            throw new ToolkitError("capability-missing", messages.seriesUnsupported, messages.seriesUnsupportedHint);
          }
          const series = probeSeries();
          if (!series) {
            throw new ToolkitError("series-missing", messages.notASeries, messages.notASeriesHint);
          }
          panel.setSeries(series);
          panel.setPdfBusy(true);
          try {
            panel.setStatus(messages.countingPages);
            const total = await countSeries(transport, series);
            const fetcher = createSlideFetcher(transport, series, { headers: { Referer: location.href } });
            const pages = [];
            for (let page = 1; page <= total; page += 1) {
              panel.setStatus(format(messages.composingPage, { page, total }));
              const blob = await fetcher.fetchPage(page);
              pages.push(await rasterize(blob));
              fetcher.release(page);
            }
            panel.setStatus(messages.writingPdf);
            const pdfBlob = buildPdf(jsPdfNamespace(), pages);
            saveBlob(pdfBlob, sanitizeFileName(document.title || "章节", "", "pdf"));
            panel.setStatus(
              format(messages.pdfSaved, { total, size: formatSize(pdfBlob.size) }),
              "success"
            );
          } finally {
            panel.setPdfBusy(false);
          }
        });
      }
    });
    panel.setSeries(probeSeries());
  }
  boot();
})();
