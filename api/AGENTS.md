# AGENTS.md

## Repository role

This path-local project implements the deployed SVG-generation API. It
receives normalized text or precomputed path data from `../frontend/`, renders
SVG XML, deduplicates by exact S3 object key, and writes public objects to the
`word-art-svgs` bucket. The original algorithm reference is in
`../cli-reference/`.

Read `../docs/SYSTEM_ARCHITECTURE.md` before changing the request/response
contract, checksum handling, public URL shape, or storage behavior.

## Runtime and commands

- Runtime: Python 3.13
- Create environment: `python -m venv .venv`
- Install development dependencies: `python -m pip install -r requirements-dev.txt`
- Test: `python -m pytest`
- Install deployment tooling: `npm ci`
- Build deployment artifact: `npm run package` (requires Docker for Lambda-compatible native wheels)

Serverless Framework v4 provides Python requirement packaging directly. Do not reintroduce `serverless-python-requirements` or `unzip_requirements`.

## Source boundaries

- `handler.py`: API Gateway parsing, validation, CORS, and response contract
- `s3.py`: exact-key lookup, public URL construction, and upload metadata
- `parse_sentences.py`: legacy server-side text fallback
- `quality.py`: shared quality threshold and SVG segment counting
- `scripts/cleanup_low_quality.py`: dry-run-first production inventory, backup, and pair deletion
- `svg_simple.py`: single-color rendering path
- `svg_split.py`: highlighted-segment rendering path
- `colors.py`: API defaults
- `custom_svg.py` and `custom_drawing.py`: vendored/adapted SVG serialization
- `serverless.yml`: AWS runtime, API Gateway event, IAM, and packaging
- `tests/`: handler/storage/rendering contract tests using fake S3 only

Keep the frontend-precomputed `simple_path` and `split_pre_parsed` paths
compatible. If a contract field changes, update `../contract/`, both active
component test suites, and `../docs/SYSTEM_ARCHITECTURE.md` together.

## Safety

- Tests must never use real AWS. Install or inject the fake client from `tests/conftest.py`.
- Never run `serverless deploy`, `serverless remove`, or a live Lambda invocation without explicit user approval.
- Do not POST diagnostic probes to the production endpoint; a request can create a public object and incur cost.
- Preserve least-privilege IAM. The function needs object-level read, write, and ACL permissions; it does not need `s3:*`.
- Treat submitted text and payloads as private. Do not log full request or response bodies.
- Public-read objects are retained for compatibility. Any change to bucket visibility requires coordinated frontend and PNG-service work.

## Verification

Run `python -m pytest` for every Python behavior change. The suite must cover at least one real simple render and one real split render through fake S3. Run `npm run package` after dependency or `serverless.yml` changes when Docker and Serverless authentication are available; packaging is not permission to deploy.
