// 元数据块。构建时置于产物首行，源文件里不重复出现。
// The metadata block; the build places it at the top of the artifact.

export const META = `// ==UserScript==
// @name         用户脚本下载实验
// @namespace    userscript-download-lab
// @version      1.0.0
// @description  在合成站点上实验用户脚本的取址与下载可靠性；仓库不含任何真实站点实现。
// @match        http://127.0.0.1:8080/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @require      https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js
// ==/UserScript==`;
