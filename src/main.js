// 入口：选中适配器、装配引擎、接上界面。只在顶层文档运行。
// Entry: pick an adapter, wire the engine, attach the panel. Top document only.

import { createEngine } from "./engine.js";
import { createFixtureAdapter } from "./adapters/fixture.js";
import { createManagerTransport } from "./transport.js";
import { mountPanel } from "./ui.js";
import { buildPdf, countSeries, createSlideFetcher, rasterize, saveBlob } from "./slides.js";
import { sanitizeFileName } from "./filename.js";
import { ToolkitError } from "./errors.js";
import { createMessages, format } from "./messages.js";

const messages = createMessages();

// 合成站点的地址取自当前页面。生产环境里它就是 127.0.0.1:8080，测试里可以是任意端口。
// The fixture origin comes from the current page: fixed in production, arbitrary in tests.
const FIXTURE_ORIGIN = location.origin;

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
    throw new ToolkitError("dependency-missing", messages.dependencyMissing, messages.dependencyHint);
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
        panel.setStatus(messages.reading);
        try {
          const { items, failures } = await engine.resolveAll(collectContext());
          resources = items.map((item) => ({ ...item, selected: true }));
          panel.setResources(resources);
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
            onItem: ({ index, total, name }) =>
              panel.setStatus(format(messages.downloadProgress, { index: index + 1, total, name })),
          });
          if (!outcome.failed.length) {
            panel.setStatus(format(messages.downloadDone, { count: outcome.saved }), "success");
            return;
          }
          const first = outcome.failed[0];
          // 面板只放首条原因，逐条细节留给控制台，排查时不用猜是哪一条。
          // The panel shows the first reason; per-item detail goes to the console.
          for (const failure of outcome.failed) {
            console.warn("[下载失败]", failure.name, failure.code, failure.url, failure.hint);
          }
          panel.setStatus(
            format(messages.downloadSomeFailed, { count: outcome.failed.length, code: first.code, hint: first.hint }),
            "warning",
          );
        } finally {
          panel.setBusy(false);
        }
      });
    },

    onPdf() {
      guard(panel, async () => {
        // 序列能力是可选的，缺失时说明不可用即可，不把它当成异常路径。
        // Series support is optional; when absent, say so instead of failing hard.
        if (!adapter.capabilities.series || typeof adapter.readSeries !== "function") {
          throw new ToolkitError("capability-missing", messages.seriesUnsupported, messages.seriesUnsupportedHint);
        }
        const series = adapter.readSeries(collectContext());
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
            format(messages.pdfSaved, { total, size: (pdfBlob.size / 1048576).toFixed(1) }),
            "success",
          );
        } finally {
          panel.setPdfBusy(false);
        }
      });
    },
  });
}

boot();
