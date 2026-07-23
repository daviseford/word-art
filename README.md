# Word Art

Word Art turns sentence word counts into a repeatedly turning SVG path. This is
the canonical product repository for the browser generator, the SVG-generation
API, and the original command-line prototype.

## Repository layout

| Path | Role | Production component? |
| --- | --- | --- |
| [`frontend/`](frontend/) | Static browser UI, text normalization, request construction, and result display | Yes |
| [`api/`](api/) | Python 3.13 Lambda that validates requests, renders SVG, and stores it in S3 | Yes |
| [`cli-reference/`](cli-reference/) | Original Python 2 algorithm and history reference | No |
| [`docs/`](docs/) | Product architecture, revival findings, deployment guidance, and plans | Documentation |
| [`contract/word-art-contract.json`](contract/word-art-contract.json) | Test-enforced frontend/API behavior contract | Test authority only |

Start with [the system architecture](docs/SYSTEM_ARCHITECTURE.md), then read
[the revival audit](docs/REVIVAL_AUDIT.md) before modernization, production
administration, or contract changes.

## Local verification

Each component remains an independent path-local project. There is no root
workspace, shared runtime environment, or root deployment command.

```powershell
# Browser client
cd frontend
npm ci
npm test
npm run build

# SVG API
cd ..\api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest

# Historical CLI syntax only
cd ..\cli-reference
py -2.7 -m py_compile parse_text.py parse_text_split.py svg.py svg_split.py
```

See the component README and `AGENTS.md` before changing that component.

## External boundaries

The PNG-conversion endpoint is a deployed black box whose source is not present
in this repository. Preserve its observed `{ url, bg_color }` request and
`svg_url` response until the service is recovered or replaced.

The public gallery is owned by the separate `daviseford-landing-page`
repository. It consumes the generated public objects but is not built or
deployed from this checkout.

## Production safety

Cloning, building, testing, packaging, or merging this repository does not
deploy production. Do not submit successful generation probes, upload frontend
artifacts, deploy or remove the Serverless stack, clean up bucket objects, or
change repository archive settings without explicit approval. The frontend
deployment command is dry-run-first; see the
[deployment runbook](docs/FRONTEND_DEPLOYMENT.md).
