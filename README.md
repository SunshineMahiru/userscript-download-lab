<h1 align="center">userscript-download-lab</h1>

<p align="center">A userscript engineering lab: an adapter interface, a site-agnostic download engine, and a synthetic course site to run experiments against.</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> · <a href="README.md">English</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"></a>
</p>

## What this is

A userscript that resolves chapter resources — documents, videos, slide image sequences — and hands them to the script manager's downloader. Everything it knows about a site lives in a small adapter; the engine itself has no site knowledge.

The repository ships one adapter, and it only matches `http://127.0.0.1:8080/*`, which is the synthetic site included in `fixtures/`. There is no adapter for any real platform here. When no adapter is supplied, the engine refuses to start with a message saying so rather than failing silently.

The point is the engineering, not the tool: a documented interface, a fixture-driven test suite, and six written-up experiments with numbers you can reproduce.

## What it is not

- It does not talk to any real course platform. No domain, endpoint, field name or session detail from any real site appears in this repository.
- It does not decrypt, merge segments, or bypass access control. Those capabilities are deliberately absent from the interface, not just unused.
- It is not a download manager. One chapter at a time, resources the current session can already see.

## Highlights

- Six-member adapter interface, five required and one optional, each returning plain data.
- Transport injection: production wraps `GM_xmlhttpRequest` / `GM_download`, tests wrap `node:http` backed by real HTTP against the fixture server. No behaviour is faked to make a test pass.
- 73 assertions across eight test files, covering filename rules, the fixture server, the engine, slide probing, the panel, the entry wiring, error mapping, and the built artifact.
- Page counting by exponential-then-binary probe: 1500 slides cost 20 requests instead of 1500.
- Six experiment records in `docs/experiments/`, each with a reproducible command and the numbers it produced.

## Architecture

```text
┌──────────────────────────────┐
│  script manager (GM_*)       │
└──────────────┬───────────────┘
               │ host API
┌──────────────▼───────────────┐
│  panel · engine · adapter    │
└──────────────┬───────────────┘
               │ HTTP
┌──────────────▼───────────────┐
│  fixture site (serve.mjs)    │
└──────────────────────────────┘
```

The engine talks to the manager through a transport object and to the site through an adapter. The adapter never sends requests and never touches the DOM; it turns page context into addresses and response payloads into resource records. The fixture site is a plain `node:http` server reading its responses from `fixtures/site/*.json`.

## Quick Start

Requires Node 20 or newer; `jsdom` and the global `fetch` used by the tests both need it.

```bash
git clone git@github.com:SunshineMahiru/userscript-download-lab.git
cd userscript-download-lab
npm ci
npm run serve          # serves the synthetic site on http://127.0.0.1:8080
npm run build          # regenerates userscript-download-lab.user.js
```

The repository already contains a built `userscript-download-lab.user.js`, so `npm run build` is only needed after changing `src/`.

Install that file in a manager that provides `GM_xmlhttpRequest` and `GM_download` — Tampermonkey, ScriptCat and Violentmonkey all do — then open `http://127.0.0.1:8080/chapter/ch-1`. A panel appears on the left edge: parse the chapter to list five resources, select the ones you want, download them, or compose the slide sequence into a PDF.

`npm run serve` and `npm run build` run in separate shells; the script only matches port 8080, so the fixture server must be on that port.

## Adapter interface

Six functions plus a capability block. Full definitions and data shapes are in [`docs/architecture.md`](docs/architecture.md).

| Member | Responsibility |
| --- | --- |
| `readChapter(context)` | Identify the chapter, or return `null` when the page is not one |
| `listingRequest(chapter, cursor)` | Build the listing request for a page |
| `parseListing(text, cursor)` | Turn a listing response into refs plus the next cursor |
| `statusRequest(chapter, ref)` | Build the per-resource status request |
| `parseStatus(payload, ref)` | Extract the final URL, or return `null` |
| `readSeries(context)` | Recognise a slide sequence, optionally |

The interface has no reserved members. Anything the engine cannot drive is simply absent, so the document and the code describe the same six functions.

## Tests

`npm test` runs all eight files in one command.

| File | Assertions | Covers |
| --- | --- | --- |
| `filename.test.mjs` | 9 | Extension resolution, Windows reserved names, byte truncation |
| `server.test.mjs` | 12 | Fixture routes, 302 signing, expiry, slide bounds |
| `engine.test.mjs` | 8 | Pagination, resolution, batch download, capability checks |
| `slides.test.mjs` | 7 | Address building, probe cost, PDF page geometry |
| `errors.test.mjs` | 11 | Status-code mapping, manager callbacks, missing capabilities |
| `panel.test.mjs` | 13 | Rendering, escaping, selection state, drag and position memory |
| `boot.test.mjs` | 5 | Entry wiring end to end with injected host APIs |
| `artifact.test.mjs` | 8 | Metadata block, byte-level sync with sources, forbidden strings |

The artifact test rebuilds the bundle and compares it byte for byte with the tracked file, so a source change without a rebuild fails the suite. CI runs `npm ci` and `npm test` on every push and pull request.

## Experiments

| Record | Headline result |
| --- | --- |
| `01-page-counting.md` | 1500 pages: 20 probes instead of 1500 |
| `02-pdf-page-geometry.md` | Fixed 960 pt width; `/MediaBox` verified as 960×720 and 960×1920 |
| `03-filename-boundaries.md` | Reserved names, trailing dots, 168-byte limit below the filesystem ceiling |
| `04-error-code-taxonomy.md` | Four error sources; fourteen codes exercised by tests, the rest listed with reasons |
| `05-signed-url-redirect.md` | 302 into a signed address; tampered and expired signatures return distinct 403 bodies |
| `06-cursor-pagination.md` | Five refs in two requests, request count asserted rather than assumed |

Data in every record comes from the fixture site or from local computation, and the records say so.

## Project layout

```text
src/          engine, adapter, panel, slides, transport, filename, errors, request, json, meta, entry
fixtures/     synthetic site data and slide images
tools/        fixture server, bundler, node transport
tests/        eight test files plus shared jsdom helpers
docs/         architecture, decisions (adr), experiments
```

`docs/PROJECT.md` and `docs/repositioning.md` are working notes and stay out of the repository.

## License

MIT. See [LICENSE](LICENSE).
