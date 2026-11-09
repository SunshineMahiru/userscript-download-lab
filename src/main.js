// 入口：选中适配器、装配引擎、接上界面。只在顶层文档运行。
// Entry: pick an adapter, wire the engine, attach the panel. Top document only.

import { createEngine } from "./engine.js";
import { createFixtureAdapter } from "./adapters/fixture.js";
import { createManagerTransport } from "./transport.js";
import { mountPanel } from "./ui.js";
import { buildPdf, countSeries, createSlideFetcher, rasterize, saveBlob } from "./slides.js";
import { sanitizeFileName } from "./filename.js";
import { ToolkitError } from "./errors.js";

const FIXTURE_ORIGIN = "http://127.0.0.1:8080";

function collectContext() {
  return {
    url: location.href,
    document,
    inlinePayloads: Array.from(document.scripts).map((script) => script.textContent || ""),
    // 部分受限上下文没有 Resource Timing，此时只依赖 DOM。
    // Some restricted contexts lack Resource Timing; fall back to the DOM alone.
    entries: typeof performance.getEntriesByType === "function" ? performance.getEntriesByType("resource") : [],
  };
}

function jsPdfNamespace() {
  const namespace = typeof jspdf !== "undefined" ? jspdf : window.jspdf;
  if (!namespace || typeof namespace.jsPDF !== "function") {
    throw new ToolkitError("dependency-missing", "jsPDF 未加载", "脚本管理器可能拦截了 @require 的地址。");
  }
  return namespace.jsPDF;
}

function guard(panel, action) {
  Promise.resolve()
    .then(action)
    .catch((error) => {
      console.error("[用户脚本下载实验]", error);
      const message = error instanceof ToolkitError ? error.message : String((error && error.message) || error);
      const hint = error instanceof ToolkitError ? error.hint : "";
      panel.setStatus(hint ? `${message} ${hint}` : message, "error");
    });
}

export function boot() {
  if (window.top !== window.self) return;

  const adapter = createFixtureAdapter({ origin: FIXTURE_ORIGIN });
  const transport = createManagerTransport();
  const engine = createEngine({ adapter, transport });

  let resources = [];
  let panel;

  panel = mountPanel({
    onParse({ setBusy }) {
      guard(panel, async () => {
        setBusy(true);
        panel.setStatus("正在读取本章资源…");
        try {
          const { items, failures } = await engine.resolveAll(collectContext());
          resources = items.map((item) => ({ ...item, selected: true }));
          panel.setResources(resources);
          if (failures.length) {
            panel.setStatus(`已解析 ${items.length} 项，${failures.length} 项不可用。`, "warning");
          } else {
            panel.setStatus(`已解析 ${items.length} 项资源。`, "success");
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
        panel.setStatus(`正在下载 ${selected.length} 项…`);
        try {
          const outcome = await engine.downloadAll(selected, {
            onItem: ({ index, total, name }) => panel.setStatus(`正在下载 ${index + 1}/${total}：${name}`),
          });
          if (!outcome.failed.length) {
            panel.setStatus(`已提交 ${outcome.saved} 个文件到浏览器下载。`, "success");
            return;
          }
          const first = outcome.failed[0];
          panel.setStatus(`${outcome.failed.length} 项失败，首个原因：${first.code} ${first.hint}`, "warning");
        } finally {
          panel.setBusy(false);
        }
      });
    },

    onPdf() {
      guard(panel, async () => {
        const series = adapter.readSeries(collectContext());
        if (!series) {
          throw new ToolkitError("series-missing", "当前页面没有幻灯片序列", "该章节可能使用文档或视频阅览器。");
        }
        panel.setSeries(series);
        panel.setPdfBusy(true);
        try {
          panel.setStatus("正在统计页数…");
          const total = await countSeries(transport, series);
          const fetcher = createSlideFetcher(transport, series, { headers: { Referer: location.href } });
          const pages = [];
          for (let page = 1; page <= total; page += 1) {
            panel.setStatus(`正在合成 ${page}/${total}`);
            const blob = await fetcher.fetchPage(page);
            pages.push(await rasterize(blob));
            fetcher.release(page);
          }
          panel.setStatus("正在写入 PDF…");
          const pdfBlob = buildPdf(jsPdfNamespace(), pages);
          saveBlob(pdfBlob, sanitizeFileName(document.title || "章节", "", "pdf"));
          panel.setStatus(`已保存 ${total} 页，约 ${(pdfBlob.size / 1048576).toFixed(1)} MB。`, "success");
        } finally {
          panel.setPdfBusy(false);
        }
      });
    },
  });
}

boot();
