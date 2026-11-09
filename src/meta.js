// 元数据块。构建时置于产物首行，源文件里不重复出现。
// The metadata block; the build places it at the top of the artifact.

export const VERSION = "1.0.0";
const REPO = "SunshineMahiru/userscript-download-lab";
const HOME = `https://github.com/${REPO}`;

// 不声明 @updateURL 与 @downloadURL：脚本只在本地合成站点上运行，
// 装机方式是克隆仓库后自行构建，更新走 git pull，没有需要轮询更新地址的分发渠道。
// No @updateURL or @downloadURL: the script only runs against the local fixture site and is
// installed by cloning and building, so updates come from git rather than a polling URL.
export const META = `// ==UserScript==
// @name         用户脚本下载实验
// @namespace    ${HOME}
// @version      ${VERSION}
// @description  在合成站点上实验用户脚本的取址与下载可靠性；仓库不含任何真实站点实现。
// @match        http://127.0.0.1:8080/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @homepageURL  ${HOME}
// @supportURL   ${HOME}/issues
// @require      https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js
// ==/UserScript==`;
