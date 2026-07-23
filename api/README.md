# Word Art serverless SVG API

The AWS Lambda/API Gateway backend for Word Art SVG generation. It validates the browser request, renders SVG XML, deduplicates by exact object key, and stores the result in the public `word-art-svgs` bucket.

## Repository family

- [`word-art`](https://github.com/daviseford/word-art): original CLI prototype
- [`word-art-frontend`](https://github.com/daviseford/word-art-frontend): browser client and cross-repository architecture docs
- [`word-art-serverless`](https://github.com/daviseford/word-art-serverless): this SVG backend

Read the frontend repository's `docs/SYSTEM_ARCHITECTURE.md` before changing request fields, checksums, result URLs, or storage behavior.

## Local setup

Python 3.13 is the deployment target. Node 18.17 or newer is needed only for Serverless packaging.

```sh
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements-dev.txt
npm ci
python -m pytest
```

The tests use an in-memory fake S3 client. They exercise request validation, exact-key deduplication, both rendering modes, SVG metadata, and failure responses without reading or writing AWS.

## API contract

The frontend normally sends either `simple_path` or the pair `split` and `split_pre_parsed`, plus colors and a decimal `checksum`. Normalized `text` remains available as a legacy fallback. Successful responses retain the historical shape:

```json
{
  "arguments": {},
  "duplicate": false,
  "s3_url": "https://s3.amazonaws.com/word-art-svgs/123456.svg"
}
```

Invalid requests return 400 with `{ "err": "..." }`. Requests with fewer than 20 rendered segments are rejected with `Your prompt is too simple. Try at least 20 distinct sentences`. Unexpected rendering or storage failures return 500 with a generic error. Uploaded objects use `image/svg+xml`.

## Packaging

```sh
npm run package
```

Serverless Framework v4 has built-in Python dependency packaging. Native NumPy/SciPy wheels are built in Docker for Lambda's Linux environment, so Docker must be running. Packaging writes only to `.serverless/`; it does not deploy. Serverless v4 may require a Serverless account or access key even for local commands.

The verified Python 3.13 artifact is about 65.3 MB compressed and 207.8 MB unpacked. It fits Lambda's 250 MiB unpacked limit, but the NumPy/SciPy dependency tree leaves limited room for future growth.

Production was upgraded in place and currently runs Lambda version 119 on Python 3.13 at the original API Gateway endpoint. Do not run another `serverless deploy`, `serverless remove`, or live handler invocation without explicit production approval and appropriately scoped credentials.

## Low-quality cleanup

`scripts/cleanup_low_quality.py` inventories every SVG, counts parsed path segments, and pairs same-stem PNGs. It is dry-run by default:

```sh
python -m scripts.cleanup_low_quality --threshold 20
```

Applying cleanup requires a new backup directory. The script downloads and hashes every target, writes `manifest.json`, and only then calls S3 deletion:

```sh
python -m scripts.cleanup_low_quality --threshold 20 --apply --backup-dir /safe/new/path
```

S3 versioning is disabled on both buckets, so never apply without a recoverable backup directory.

## Remaining risks

- The route remains public and the browser-supplied checksum is collision-prone. Exact lookup fixes prefix collisions but does not make the checksum trustworthy.
- Public-read uploads and public bucket listing are inherited production behavior, not a recommended new design.
- The deployment artifact is close enough to Lambda's unpacked size limit that dependency changes must be followed by artifact-size inspection.
- The separate PNG service is not present in the three known repositories.
