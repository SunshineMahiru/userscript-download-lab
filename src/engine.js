// 引擎：调度请求、归一错误、执行下载。它不知道任何具体站点的存在。
// Engine: schedules requests, normalises errors and runs downloads. It knows no site.

import { ToolkitError, contentError } from "./errors.js";
import { requestJson, requestText } from "./request.js";
import { inferKind, sanitizeFileName } from "./filename.js";

// 只实现脚本管理器 match 语义的常用子集：整串匹配，`*` 通配任意字符。
// Implements the common subset of match semantics: whole-string match, `*` as wildcard.
export function patternMatches(pattern, url) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`).test(url);
}

export function selectAdapter(adapters, url) {
  return adapters.find((adapter) => adapter.match.some((pattern) => patternMatches(pattern, url))) || null;
}

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

  async function exportChapter(context) {
    const chapter = await readChapter(context);
    const refs = await listRefs(chapter);
    const failures = [];
    let saved = 0;

    for (const ref of refs) {
      // 单条资源失败不中断整批，失败原因按条记录并回报，不隐藏。
      // One failing item does not abort the batch; each reason is recorded and reported.
      try {
        const { resource, spec } = await resolveRef(chapter, ref);
        const kind = resource.kind || inferKind(ref.name, resource.url, ref.type);
        const name = sanitizeFileName(resource.name || ref.name, resource.url, kind);
        // 下载沿用状态请求的请求头，同一资源的请求上下文保持一致。
        // Reuse the status request headers so one resource keeps one request context.
        await transport.download({ url: resource.url, name, headers: spec.headers || {} });
        saved += 1;
      } catch (error) {
        failures.push({ name: ref.name, code: error.code || "error", hint: error.hint || "" });
      }
    }

    return { saved, failed: failures };
  }

  return { readChapter, listRefs, resolveRef, exportChapter };
}
