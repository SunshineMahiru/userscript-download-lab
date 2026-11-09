// 悬浮面板：只负责呈现与交互，业务规则来自调用方。
// Floating panel: presentation and interaction only; business rules come from the caller.

import { KIND_LABEL } from "./filename.js";
import { createMessages, format } from "./messages.js";

const BRAND_COLOR = "#2f6fd0";
const TAB_MARGIN = 10;
const TAB_SNAP = 16;
const STORAGE_KEY = "udl-tab-ratio-v1";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const STYLE = `
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

// 隐私模式或第三方上下文会拒绝存储访问。存储不可用时退化为默认位置与不记忆，
// 而不是让挂载抛错。
// Private modes and third-party contexts can deny storage access. Degrade to a default
// position instead of letting the mount throw.
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
    // 写不进去只影响下次挂载的位置，不影响本次拖拽。
    // A failed write only costs the next mount its position; the drag still works.
  }
}

export function mountPanel({ onParse, onDownload, onPdf }) {
  const messages = createMessages();
  const root = document.createElement("aside");
  root.id = "udl-root";
  root.innerHTML = `
    <style>${STYLE}</style>
    <button id="udl-tab" type="button" aria-expanded="false" aria-label="${messages.tabLabel}">
      <span class="udl-tab-text">${messages.tabChars.map((char) => `<span>${char}</span>`).join("")}</span>
    </button>
    <section id="udl-panel" aria-label="${messages.panelTitle}">
      <div class="udl-head"><span>${messages.panelTitle}</span><small>${messages.collapseHint}</small></div>
      <button id="udl-parse" class="udl-action" type="button">${messages.parse}</button>
      <div class="udl-sub"><span>${messages.resultLabel}</span><span id="udl-count">${format(messages.countUnit, { count: 0 })}</span></div>
      <div id="udl-list"><p class="udl-empty">${messages.emptyList}</p></div>
      <button id="udl-download" class="udl-action udl-download" type="button" disabled>${format(messages.download, { count: 0 })}</button>
      <div class="udl-section">
        <button id="udl-pdf" class="udl-action" type="button">${messages.composePdf}</button>
        <p id="udl-hint" class="udl-hint">${messages.seriesMissing}</p>
      </div>
      <p id="udl-status" class="udl-status">${messages.initialStatus}</p>
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
    count.textContent = format(messages.countUnit, { count: resources.length });
    button.disabled = busy || selected().length === 0;
    button.textContent = busy
      ? messages.downloading
      : format(messages.download, { count: selected().length });

    if (!resources.length) {
      list.innerHTML = `<p class="udl-empty">${messages.emptyList}</p>`;
      return;
    }
    list.innerHTML = resources
      .map(
        (item, index) => `
      <label class="udl-item" title="${escapeHtml(item.name)}">
        <input class="udl-check" type="checkbox" data-index="${index}" ${item.selected ? "checked" : ""}>
        <span class="udl-kind">${KIND_LABEL[item.kind] || "文件"}</span>
        <span class="udl-name">${escapeHtml(item.name)}</span>
      </label>`,
      )
      .join("");
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
    button.textContent = pdfBusy ? messages.composing : messages.composePdf;
    hint.textContent = series
      ? format(messages.seriesFound, { count: series.count })
      : messages.seriesMissing;
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
      true,
    );
    // iframe 内部点击不会冒泡到顶层文档，只能借助焦点转移判断。
    // Clicks inside an iframe never bubble here; watch for focus moving into one.
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
  parseButton.addEventListener("click", () => onParse({ setBusy: (value) => (parseButton.disabled = value) }));

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
    },
  };
}
