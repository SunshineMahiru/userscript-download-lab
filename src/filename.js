// 资源类型判定与文件名规整。本模块不涉及任何站点知识。
// Resource kind detection and file name normalisation; no site knowledge here.

export const KIND_BY_EXTENSION = {
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
  "7z": "archive",
};

export const KIND_LABEL = {
  pdf: "PDF",
  ppt: "PPT",
  word: "WORD",
  sheet: "表格",
  video: "视频",
  audio: "音频",
  archive: "压缩包",
  file: "文件",
};

export const DEFAULT_NAME_BYTE_LIMIT = 168;

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function fileExtension(value) {
  const path = String(value || "").split("?")[0].split("#")[0];
  const matched = path.match(/\.([a-z0-9]{1,8})$/i);
  return matched ? matched[1].toLowerCase() : "";
}

// 名称后缀优先，其次地址后缀，最后按站点自报的类型推断。
// Prefer the name suffix, then the address suffix, and fall back to the declared type.
export function inferKind(name, url, declaredType) {
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

// 按 UTF-8 字节截断，中文不会被切成半个字。
// Truncate by UTF-8 bytes so a multi-byte character is never split.
export function truncateByBytes(text, maxBytes) {
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

export function sanitizeFileName(raw, url, kind, limit = DEFAULT_NAME_BYTE_LIMIT) {
  const cleaned = String(raw || "文件")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  const nameExtension = fileExtension(cleaned);
  const urlExtension = fileExtension(url);
  // 后缀以真实地址为准：转码预览的地址与附件原名常常不一致。
  // Trust the address suffix; transcoded previews rarely match the original name.
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
