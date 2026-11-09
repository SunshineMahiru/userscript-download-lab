// 幻灯片序列：地址拼接、页数探测、位图转 JPEG、PDF 合成。
// Slide series: address building, page counting, rasterising and PDF assembly.

import { ToolkitError } from "./errors.js";
import { requestBlob } from "./request.js";
import { createMessages } from "./messages.js";

export const DEFAULT_MAX_PAGES = 1500;
export const DEFAULT_PAGE_WIDTH = 960;
export const DEFAULT_JPEG_QUALITY = 0.92;

export function slideAddress(series, page) {
  return `${series.prefix}${page}.${series.extension}${series.query || ""}`;
}

// 指数加二分：先翻倍找到上界，再在区间内二分，探测次数与页数成对数关系。
// Exponential then binary search: the probe count grows logarithmically with the page count.
export async function countByProbe(probe, maxPages = DEFAULT_MAX_PAGES) {
  if (!(await probe(1))) return 0;
  let low = 1;
  let high = 2;
  while (high <= maxPages && (await probe(high))) {
    low = high;
    high *= 2;
  }
  high = Math.min(high, maxPages + 1);
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (await probe(middle)) low = middle;
    else high = middle;
  }
  return low;
}

export async function countSeries(transport, series, { maxPages = DEFAULT_MAX_PAGES } = {}) {
  const counted = await countByProbe(async (page) => {
    // 页数探测只关心「这一页在不在」，因此不把 404 当作错误。
    // The probe only asks whether a page exists, so a 404 is an answer, not a failure.
    const response = await transport.request({ url: slideAddress(series, page), responseType: "blob" });
    return response.status >= 200 && response.status < 300;
  }, maxPages);

  if (!counted) {
    const messages = createMessages();
    throw new ToolkitError("empty", messages.emptySeries, messages.emptySeriesHint);
  }
  return counted;
}

export function createSlideFetcher(transport, series, { headers = {}, timeout } = {}) {
  const cache = new Map();

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

// 解码与画布创建可注入：浏览器用全局实现，测试用 node 的实现，
// 这样重编码这一步能真实跑一遍而不是被跳过。
// Decoding and canvas creation are injectable so the re-encode step can run for real
// in tests instead of being skipped.
function defaultDecode(blob) {
  return createImageBitmap(blob);
}

function defaultMakeCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// 画布重编码为 JPEG，避免直接把 PNG 塞进 PDF 造成体积膨胀。
// Re-encode to JPEG so a PNG does not bloat the PDF.
export async function rasterize(
  blob,
  { quality = DEFAULT_JPEG_QUALITY, decode = defaultDecode, makeCanvas = defaultMakeCanvas } = {},
) {
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

// jsPDF 由调用方注入：浏览器里来自 @require，测试里来自 npm 包。
// jsPDF is injected by the caller: from @require in the browser, from the npm package in tests.
export function buildPdf(jsPDF, pages, { pageWidth = DEFAULT_PAGE_WIDTH } = {}) {
  if (!pages.length) {
    const messages = createMessages();
    throw new ToolkitError("empty", messages.emptyPages, messages.emptyPagesHint);
  }
  const heightOf = (page) => Math.round((pageWidth * page.height) / page.width);
  const orientationOf = (page) => (heightOf(page) >= pageWidth ? "portrait" : "landscape");
  const first = pages[0];
  const pdf = new jsPDF({
    unit: "pt",
    format: [pageWidth, heightOf(first)],
    orientation: orientationOf(first),
    compress: true,
  });
  pages.forEach((page, index) => {
    const height = heightOf(page);
    if (index > 0) pdf.addPage([pageWidth, height], orientationOf(page));
    pdf.addImage(page.dataUrl, "JPEG", 0, 0, pageWidth, height, undefined, "FAST");
  });
  return pdf.output("blob");
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
