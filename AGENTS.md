# AGENTS.md

## Repository role

This is the canonical Word Art product repository. The active browser client
and SVG API remain independent projects under `frontend/` and `api/`. The
Python 2 prototype under `cli-reference/` is an algorithm and history reference
only.

The PNG-conversion service is an external black box, and the public gallery is
owned by the separate `daviseford-landing-page` repository. Do not infer that
either service is implemented here.

Read `docs/SYSTEM_ARCHITECTURE.md` before changing request fields, checksums,
result URLs, persistence behavior, or external boundaries. Read
`docs/REVIVAL_AUDIT.md` before modernization or production administration.

## Component commands

- Frontend: from `frontend/`, run `npm ci`, `npm test`, and `npm run build`.
- API: from `api/`, use Python 3.13, install `requirements-dev.txt` in an
  isolated environment, and run `python -m pytest`.
- API package: from `api/`, run `npm ci` and `npm run package` only when Docker
  and authorized Serverless authentication are available. Packaging is not
  deployment permission.
- CLI reference: from `cli-reference/`, run
  `py -2.7 -m py_compile parse_text.py parse_text_split.py svg.py svg_split.py`.

Follow the nested `AGENTS.md` before working in a component.

## Change rules

- Keep `frontend/` and `api/` path-local. Do not add a root package workspace,
  shared virtual environment, root deployment command, or cross-component
  runtime import.
- The canonical JSON contract under `contract/` is consumed by tests, not
  production runtime modules.
- Coordinate changes to shared request fields, palettes, quality thresholds,
  parsing examples, or turtle-path behavior across the contract and both active
  component test suites.
- Treat `cli-reference/` as read-only unless a task explicitly changes the
  historical algorithm. Active code must not import, build, or execute it.
- Keep sample texts as fixtures; do not add copyrighted or private submissions.

## Safety

- Never run `frontend/deploy.ps1 -Apply`, `frontend/upload.sh -Apply`,
  `serverless deploy`, `serverless remove`, a live Lambda invocation, or a
  successful production generation probe without explicit approval.
- Tests must not use real AWS. Treat generated objects as user submissions and
  keep cleanup tooling dry-run-first with recoverable backups.
- Do not delete superseded source repositories. Redirect or archive operations
  require explicit approval after canonical clean-clone verification.

## Verification

For cross-component changes, run the affected component suites from their own
directories. Contract changes require both active suites. Documentation changes
require local Markdown-link checks and the component command/path audit. Any
unavailable packaging, credential, or legacy-runtime prerequisite remains an
unmet gate rather than permission to skip or deploy.
