# AGENTS.md

## Repository role

This repository is the original command-line prototype for the Word Art system. It turns sentence word counts into a repeatedly turning SVG path. It is useful as an algorithm and history reference; it is not called by the deployed web application.

Sibling repositories are normally checked out beside this one:

- `../word-art-frontend`: browser UI and client-side preprocessing
- `../word-art-serverless`: deployed SVG-generation Lambda

The multi-repository architecture and revival audit live in `../word-art-frontend/docs/`.

## Runtime and commands

- The code targets Python 2.7 and uses Python 2 `print` syntax.
- Pinned libraries in `requirements.txt` are from 2017. Install them only in an isolated legacy environment.
- Syntax check: `py -2.7 -m py_compile parse_text.py parse_text_split.py svg.py svg_split.py`
- Historical example: `py -2.7 svg.py -f txt/purple_cow.txt -c purple`
- Generated files belong in `output/`, which is ignored by Git.

There is no automated test suite. Add focused tests before changing parsing or path-generation behavior.

## Change rules

- Treat `parse_text.py` and `svg.py` as the original simple-rendering pipeline.
- Treat `parse_text_split.py` and `svg_split.py` as the original highlighted-segment experiment.
- Do not assume a fix here changes production. Port intentional behavior changes separately to `word-art-serverless` and `word-art-frontend`.
- Preserve the core visual rule unless a task explicitly changes it: one segment per sentence, segment length equals word count, and SVG direction rotates through left/down/right/up.
- Keep sample texts as fixtures; do not add copyrighted or private submissions.
- Do not run upload or deployment actions from this repository.

## Verification

For documentation-only changes, check Markdown links and run the Python 2 syntax command above. For behavior changes, add a test covering sentence parsing and the resulting SVG path before modifying production code.
