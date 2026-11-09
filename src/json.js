// 从页面内联脚本里定位一段 JSON 对象。只负责找出边界，不解读字段含义。
// Locates a JSON object inside inline page scripts; it does not interpret fields.

export function locateJsonObject(text, fromIndex) {
  // 按括号配对定位边界，字符串内的括号与转义不参与配对。
  // Brace matching that skips braces inside strings and after backslashes.
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

// 页面里可能先出现空声明再出现真实对象，调用方可以传入最后一个匹配位置逐个尝试。
// A page may declare the variable empty first, so callers can retry from the last match.
export function readObjectAfter(text, anchor) {
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
    // 该锚点不是合法 JSON，交由调用方尝试下一个候选。
    // Not valid JSON at this anchor; the caller tries the next candidate.
    return null;
  }
}
