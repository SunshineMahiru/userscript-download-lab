# Changelog

Notable changes are recorded here. The format follows Keep a Changelog, and versions follow Semantic Versioning.

## [1.0.0] - 2026-11-09

### Added

- Adapter interface with six members, plus four capability flags. The engine drives the adapter and never learns a site name.
- Site-agnostic engine: chapter resolution, cursor pagination, per-resource resolution, batch download with per-item failure records.
- Transport injection so the same engine runs on `GM_xmlhttpRequest` / `GM_download` in production and on real HTTP in tests.
- Synthetic course site on `node:http` covering inline payloads, pagination, signed redirects, expiry, and slide sequences.
- Floating panel with resource selection, download progress, slide-to-PDF composition, and drag-to-reposition with stored position.
- Filename normalisation handling extension precedence, Windows reserved names, trailing dots, and UTF-8 byte truncation.
- Page counting by exponential-then-binary probe; 1500 slides cost 20 requests.
- Eight test files, 73 assertions, plus a byte-level check that the committed bundle matches its sources.
- Six experiment records with reproducible commands and the numbers they produced.
- GitHub Actions workflow running `npm ci` and `npm test` on every push and pull request.
