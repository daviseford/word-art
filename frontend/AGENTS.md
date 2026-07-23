# AGENTS.md

## Repository role

This is the static browser client for Word Art. It normalizes text, computes sentence lengths and SVG path data, posts a generation request to the SVG Lambda, and then asks a separate PNG service to rasterize the result.

Sibling repositories are normally checked out beside this one:

- `../word-art`: original Python command-line prototype
- `../word-art-serverless`: SVG Lambda and S3 persistence

Read `docs/SYSTEM_ARCHITECTURE.md` before changing request fields, checksums, result URLs, or storage behavior. Read `docs/REVIVAL_AUDIT.md` before modernization or admin work.

## Runtime and commands

- Install: `npm ci`
- Test: `npm test`
- Build: `npm run build`
- Local server: `npm start` (builds once, then serves `dist/` on `http://127.0.0.1:8080`)
- Alternate port: set `WORD_ART_PORT` before running `npm start`

The build works with the current local Node runtime but uses an obsolete Webpack 3/Babel toolchain. Dependency modernization should be isolated from product changes.

## Source boundaries

- `src/word-art.js`: page behavior and API orchestration
- `src/form.js`: form-to-request contract
- `src/util.js`: text normalization, path preprocessing, and checksum logic
- `src/components.js`: generated result markup
- `src/config.js`: deployed endpoints and public bucket URLs
- `src/colors.js`: presets
- `src/index.html`: page template
- `deploy.ps1`: canonical dry-run-first production deployment
- `upload.sh`: compatibility wrapper around `deploy.ps1`
- `serve.js`: dependency-free local static server; never proxy production APIs through it
- `test/test.js`: Mocha coverage for utilities
- `test/deploy.test.js` and `test/deploy-script.test.ps1`: deployment safety and control-flow coverage
- `test/server.test.js`: local-server path safety and smoke coverage
- `dist/`: tracked generated deployment output; never hand-edit it
- `src/word-art.min.js`: historical artifact, not the Webpack entry point

Edit `src/`, test, then rebuild `dist/` when a source change is intended for deployment.

## Cross-repository contract

- The SVG request is consumed by `../word-art-serverless/handler.py`.
- The frontend's `simple_path`, `split_pre_parsed`, `checksum`, colors, and split fields are part of a shared wire contract.
- The PNG endpoint and its source are not present in these three repositories. Do not invent its behavior; preserve the observed `{ url, bg_color }` request and `svg_url` response until its implementation is found or replaced.
- If a contract field changes, update the serverless handler, tests, and `docs/SYSTEM_ARCHITECTURE.md` together.

## Safety

- `deploy.ps1` is dry-run-only unless `-Apply` is supplied. Never run `deploy.ps1 -Apply` or `upload.sh -Apply` without explicit user approval.
- Do not POST probes to the production generation endpoints during diagnosis: generation can create public S3 objects and incur AWS cost.
- Never put AWS credentials in browser code. A future local admin must call S3 from a trusted local backend or CLI.
- Treat bucket objects as user submissions. Default all cleanup tools to dry-run and require explicit confirmation for deletion.

## Verification

Run `npm test` for utility, request-shaping, or local-server changes and `npm run build` for any frontend source change. Smoke-test `npm start` after build-tool changes. For UI changes, also exercise the form locally at desktop and mobile widths without submitting to production unless the user authorizes it.

For deployment-script changes, run `npm test`, parse `deploy.ps1` with the PowerShell parser, and exercise only the default dry-run path unless production deployment is explicitly approved.
