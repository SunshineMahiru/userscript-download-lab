// 元数据块。构建时置于产物首行，源文件里不重复出现。
// The metadata block; the build places it at the top of the artifact.

export const VERSION = "1.0.0";
const REPO = "SunshineMahiru/userscript-download-lab";
const HOME = `https://github.com/${REPO}`;
// 更新地址指向固定 tag 而不是分支：分支会让用户静默拿到未审阅的版本。
// Update URLs point at a fixed tag rather than a branch, which would silently ship unreviewed code.
const ARTIFACT_URL = `https://cdn.jsdelivr.net/gh/${REPO}@v${VERSION}/userscript-download-lab.user.js`;

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
// @updateURL    ${ARTIFACT_URL}
// @downloadURL  ${ARTIFACT_URL}
// @require      https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js
// ==/UserScript==`;
