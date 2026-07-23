# Word Art CLI

The original Word Art prototype turns each sentence into a line segment whose length is the sentence's word count, rotating 90 degrees after every segment. This repository is now an algorithm/history reference; the deployed web flow lives in the sibling frontend and serverless repositories.

## Repository family

- [`word-art`](https://github.com/daviseford/word-art): this Python CLI prototype
- [`word-art-frontend`](https://github.com/daviseford/word-art-frontend): static browser client and system documentation
- [`word-art-serverless`](https://github.com/daviseford/word-art-serverless): deployed SVG-generation Lambda

## Legacy runtime

The code targets Python 2.7 and pins packages from 2017. Use an isolated legacy environment; do not install these packages into a current Python environment.

```powershell
py -2.7 -m pip install -r requirements.txt
py -2.7 -m nltk.downloader punkt
py -2.7 svg.py -f txt/purple_cow.txt -c purple
```

Generated SVGs are written to `output/`. The conversion script additionally expects legacy Inkscape CLI flags and `optipng`.

## Verification

There is no automated test suite. A dependency-free syntax check is available:

```powershell
py -2.7 -m py_compile parse_text.py parse_text_split.py svg.py svg_split.py
```

See the frontend repository's `docs/SYSTEM_ARCHITECTURE.md` and `docs/REVIVAL_AUDIT.md` for the multi-repository map, current status, and known defects.
