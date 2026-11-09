// 引擎：调度请求、归一错误、执行下载。它不知道任何具体站点的存在。
// Engine: schedules requests, normalises errors and runs downloads. It knows no site.

import { ToolkitError, contentError } from "./errors.js";
import { requestJson, requestText } from "./request.js";
import { inferKind, sanitizeFileName } from "./filename.js";

export function createEngine({ adapter, transport }) {
  if (!adapter) {
    throw new ToolkitError("adapter-missing", "当前页面没有可用适配器", "在适配器列表里补齐匹配规则。");
  }
  if (!adapter.capabilities.listing || !adapter.capabilities.status) {
    throw new ToolkitError("capability-missing", "适配器缺少必需能力", "listing 与 status 必须为 true。");
  }

  async function readChapter(context) {
    const chapter = adapter.readChapter(context);
    if (!chapter) {
      throw new ToolkitError("chapter-not-found", "当前页面不是章节页", "进入具体章节后再试。");
    }
    return chapter;
  }

  async function listRefs(chapter) {
    const refs = [];
    let cursor = null;
    // 游标为空或适配器未声明分页能力时停止，不做猜测性的二次请求。
    // Stop when the cursor is empty or paging is not declared.
    for (;;) {
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
      throw contentError("not-a-file", `未取到可下载地址：${ref.name}`, "状态响应里没有可用字段。");
    }
    return { resource, spec };
  }

  // 取址与下载分开：界面可以先列出结果，用户挑选后再下载。
  // Resolution and download are separate so the panel can list first and fetch later.
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
          headers: spec.headers || {},
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
      // 单条失败不中断整批，原因按条记录并回报。
      // One failing item does not abort the batch; each reason is recorded.
      try {
        await transport.download({ url: item.url, name: item.name, headers: item.headers || {} });
        saved += 1;
      } catch (error) {
        failures.push({ name: item.name, code: error.code || "error", hint: error.hint || "" });
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
