# Revival audit

Audit date: 2026-07-22

## Production update

The audit's deployment caveats describe the pre-revival state. On 2026-07-22, the existing backend stack was successfully upgraded in place from Python 2.7 to Python 3.13. On 2026-07-23, the quality boundary increased to 20 rendered segments and Lambda version 119 was deployed at the original endpoint. Malformed and under-threshold requests return 400 without writing S3.

The public data set was classified twice by parsed SVG segment count. The first pass backed up and deleted 668 SVGs and 437 paired PNGs below 12 segments. The 20-segment pass backed up and deleted another 96 SVGs and 60 paired PNGs with 12–19 segments. No S3 deletion errors occurred; 427 SVGs and 288 PNGs remain, with zero SVGs below the 20-segment boundary.

This is a confirmed-state inventory, not a claim that every production path was invoked. One deliberate under-threshold production POST verified the live 400 quality gate and created no S3 object; no successful generation probe was sent because that path creates a public object and incurs AWS cost.

## What still works

- The deployed static page at `https://daviseford.com/word-art/` returns HTTP 200 and serves a bundle containing the same SVG and PNG endpoint IDs as this checkout.
- `word-art-frontend` installs from its lockfile, passes its Mocha tests, builds, and serves the built page with the current local Node runtime.
- `word-art-serverless` runs on local Python 3.13 and passes 34 tests, including real simple/split SVG serialization through an in-memory fake S3 client, cleanup safety checks, and an IAM configuration check.
- The original `word-art` CLI still compiles with the locally installed Python 2.7 interpreter.
- Both public buckets are readable and listable. Matching SVG and PNG objects were written as recently as 2026-05-16.
- The PNG API answered an `OPTIONS` request with HTTP 200.

## Reproduced or directly evidenced defects

### High: generation still has no trustworthy submission identity

The browser checksum is a small weighted integer, is easy to collide, and is fully supplied by the caller. The Lambda still uses it for duplicate lookup and the final S3 key. The revived checkout now validates the checksum as decimal and checks the exact `<checksum>.svg` key, eliminating the separate prefix-match bug.

Impact: unrelated requests can resolve to the wrong existing image, callers can choose object names, and an admin cannot assume a filename uniquely proves content.

### High: the public API and buckets still expose an abuse/cost surface

The SVG route remains unauthenticated, allows broad CORS, and both buckets permit unauthenticated object listing. The production revival reduced the Lambda to 1,024 MB/29 seconds, added a 1 MB request limit and shape validation, and narrowed IAM to object-level read/write/ACL actions, but it did not add authentication, throttling, or a submission quota.

Impact: avoidable AWS spend, unbounded submissions, and enumerable user artifacts remain possible.

### High: the deployed SVG route mishandled preflight (fixed in production)

An `OPTIONS` request to the configured SVG endpoint returned HTTP 500 during the audit. `serverless.yml` declares `ANY /` while also setting `method: post`, and `handler.endpoint` assumes `event['body']` exists.

The deployed stack now declares an explicit POST event with CORS and handles OPTIONS without touching storage.

### High: the deployed runtime was retired (fixed in production)

[AWS Lambda blocks creation and updates for runtimes after their end-of-support lifecycle](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html), and Python 2.7 is long past that lifecycle. The checkout pins 2017-era Python libraries and `serverless-python-requirements@3.3.0`, and it does not declare the Serverless CLI dependency needed by its historical deployment commands.

The stack now runs Python 3.13, pins current compatible libraries, and uses Serverless Framework 4.40.0. Local tests and Docker packaging are reproducible. The inspected artifact is about 65.3 MB compressed and 207.8 MB unpacked, below Lambda's 250 MiB unpacked limit but with limited growth headroom.

### Medium: duplicate SVGs can produce broken PNG links

When the SVG API reports `duplicate: true`, the browser skips PNG generation and immediately renders a PNG URL with the same stem. The post-cleanup bucket inventory contains 139 SVG stems with no PNG counterpart.

Impact: revisiting one of those SVG requests can show a broken PNG download and preview indefinitely.

### Medium: rendering failures were returned as successful URLs (fixed in production)

`save_simple_xml_to_s3` and `save_split_xml_to_s3` catch exceptions and return strings beginning with `Error building xml_string`. The handler places that string in `s3_url` and returns HTTP 200. The frontend treats any truthy `s3_url` as success and forwards it to PNG generation.

The revived handler now lets rendering/storage exceptions reach one HTTP 500 boundary and returns a generic error body. Contract tests cover an S3 failure.

### Medium: backend fallback parsing disagreed with the frontend (geometry fixed in production)

`parse_sentences.split_into_sentence_lengths` counts the empty segment after a trailing period as one word. In split mode, `svg_split.get_sentences` uses `len(sentence_string)`, which counts characters rather than words. Highlight matching also uses substring containment rather than word equality.

The revived fallback now ignores empty trailing segments and measures words. Substring highlight matching is intentionally unchanged because the frontend currently uses the same rule.

### Medium: optional highlight input disagreed across the repositories (backend fixed in production)

The frontend labels highlight color as optional and sends `null` when highlight words are present but no color is entered. The first revived validator rejected that request even though the frontend had already used the historical default color. The Lambda now treats a null highlight color as omitted, and the frontend drops blank terms caused by whitespace or trailing commas.

### Medium: required text was not actually required (fixed in production)

`handler.get_default_arguments` supplies `sample. text.` when a valid JSON request omits `text`. It also catches every JSON or nested-shape exception and replaces the whole request with defaults; because that replacement drops the checksum, malformed input can then fail later in S3 lookup rather than returning a clear 4xx validation response.

The revived handler requires a usable precomputed path or fallback text, validates nested shapes/colors/checksums, limits the body to 1 MB, and returns actionable HTTP 400 errors.

### Medium: dependency audit is severely red

- Frontend clean install after removing the incompatible Webpack Dev Server 2 dependency and repairing the lockfile: 85 advisories (3 low, 42 moderate, 31 high, 9 critical).
- Serverless JavaScript tooling after replacing the archived plugin with Serverless Framework 4.40.0: 0 advisories.

These totals come from installing the committed lockfiles. They mostly affect obsolete build/deployment tooling, but modernization should happen before trusting those tools with production credentials.

The original `npm start` also crashed on Node 25 because Webpack Dev Server 2 calls the removed internal `http_parser` binding. This revival pass replaces that startup path with the dependency-free `serve.js` while retaining Webpack for production builds.

### Medium: SVG uploads had no media type (fixed in production)

`s3.upload_svg` does not set `ContentType`. A HEAD request for the newest production SVG returned `binary/octet-stream` rather than `image/svg+xml`.

New uploads from the revived code use `image/svg+xml`; existing production objects retain their current metadata until migrated or replaced.

### Low: request construction depended on DOM order (fixed locally)

`src/form.js` previously indexed `serializeArray()` positions. The local frontend now selects each field by ID, so reordering or adding form controls cannot silently remap request values. This frontend change has not been uploaded yet.

### Low: submissions were logged (fixed in production)

The revived handler logs operation names/checksums and exception traces without logging the full request or successful response body.

## Open security questions

- `src/components.js` embeds a CanvasPop `access_key` in the public bundle and URL. Confirm whether it is intentionally public; rotate or remove it if it grants privileged access.
- The PNG API accepts a caller-supplied `url`, but its source is missing. Recover or replace that service and verify that it cannot fetch private-network or arbitrary remote URLs before relying on it.

## Test gaps

- The CLI has no tests.
- The Lambda now has handler, parsing, storage, cleanup, malformed-path, cross-repository optional-highlight, and real-render contract tests through fake S3. Production has two non-writing under-threshold smoke probes but no separate staging stack or successful end-to-end generation smoke test.
- Frontend tests cover text utilities, the 20-sentence boundary, palette validity, and the local static server, but not form request construction, API orchestration, error rendering, checksum collisions, duplicate-without-PNG behavior, or exact highlight matching.
- No repository owns an end-to-end contract test across the frontend request and Lambda handler.
- The PNG service has no source or contract tests in the known checkout set.

## Recommended revival order

1. Replace client-authoritative checksums with a backend-derived content hash and coordinate the migration across frontend, SVG objects, and PNG pairing.
2. Recover or replace the PNG service, then make PNG creation idempotent for existing SVG-only objects.
3. Add API abuse controls and decide whether public bucket listing/public-read ACLs remain intentional.
4. Deploy and observe the reviewed generator/gallery frontends when explicitly approved.
5. Modernize the static build toolchain separately from UI changes.
6. Build the local, dry-run-first admin described in `SYSTEM_ARCHITECTURE.md`.

## Baseline commands and results

```text
word-art:
  py -2.7 -m py_compile parse_text.py parse_text_split.py svg.py svg_split.py
  PASS (dependencies not installed)

word-art-frontend:
  npm ci
  PASS, with legacy/deprecation warnings
  npm test
  PASS
  npm run build
  PASS
  npm start
  PASS after replacing the incompatible Webpack Dev Server 2 startup

word-art-serverless:
  .venv\Scripts\python.exe -m pytest
  PASS (34 tests on Python 3.13.3; fake S3, no AWS access)
  python -m pip check
  PASS
  npm ci
  PASS (0 advisories)
  npm run package
  PASS after interactive Serverless sign-in (about 65.3 MB compressed / 207.8 MB unpacked)
```
