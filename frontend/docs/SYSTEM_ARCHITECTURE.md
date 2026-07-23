# Word Art system architecture

Last verified locally: 2026-07-23

## Repository map

| Repository | Role | Called in production? |
| --- | --- | --- |
| [`word-art`](https://github.com/daviseford/word-art) | Original Python 2 CLI and source of the sentence-to-path idea | No |
| [`word-art-frontend`](https://github.com/daviseford/word-art-frontend) | Static browser UI, text normalization, request construction, and result display | Yes |
| [`word-art-serverless`](https://github.com/daviseford/word-art-serverless) | Python 3.13 Lambda source that validates requests, renders SVG, and stores it in S3 | Yes |
| `daviseford-landing-page` | Public Word Art gallery page and paginated S3 browser | Yes |
| Unknown PNG service | Fetches an SVG and creates the paired PNG | Yes, but its source is not in these repositories |

The original CLI is an ancestor, not a runtime dependency. The frontend and serverless repositories duplicated and then evolved parts of its parsing and path-generation logic.

## Request and storage flow

```text
Browser (`word-art-frontend`)
  1. Normalize text and count words per sentence.
  2. Build `simple_path` or `split_pre_parsed`.
  3. Require at least 20 distinct normalized sentences.
  4. Compute a client-side numeric checksum and POST the JSON request.
                  |
                  v
SVG Lambda (`word-art-serverless`)
  5. Reject fewer than 20 rendered path segments, then look for `<checksum>.svg`.
  6. Render SVG when no duplicate is found.
  7. PUT `<checksum>.svg` in `word-art-svgs` as public-read.
                  |
                  v
Browser
  8. If the SVG was new, POST `{ url, bg_color }` to the PNG API.
                  |
                  v
Unknown PNG service
  9. Create `<checksum>.png` in `word-art-pngs`.
                  |
                  v
Browser displays public SVG and PNG URLs.
```

Deployed values currently live in `src/config.js`:

- SVG API: `https://gy2aa8c57c.execute-api.us-east-1.amazonaws.com/dev/`
- PNG API: `https://x9m83oo0kd.execute-api.us-east-1.amazonaws.com/dev/`
- SVG bucket: `word-art-svgs`
- PNG bucket: `word-art-pngs`

## SVG request contract

The browser sends a subset of these fields:

| Field | Shape | Notes |
| --- | --- | --- |
| `simple_path` | SVG path string | Preferred simple-mode input; lets Lambda skip parsing text |
| `split_pre_parsed` | array of `{ color, length }` | Preferred highlight-mode input |
| `text` | normalized string | Removed by the browser when precomputed data is available; retained as a legacy fallback |
| `color` | hex string | Main line color |
| `bg_color` | hex string | Stored as an SVG background style and forwarded to PNG generation |
| `node_colors` | two-element hex array | Start and end marker colors |
| `split` | `{ words, color }` | Signals highlight mode and documents the requested highlight |
| `version` | number | Currently `2`; sent by the browser but ignored by the Lambda |
| `checksum` | decimal string | Client-derived object identity; not collision resistant and not safe to trust |

The deployed Lambda validates the body and returns HTTP 400 for malformed, incomplete, or under-20-segment requests. The quality response is `{ "err": "Your prompt is too simple. Try at least 20 distinct sentences" }`. It returns a proxy response whose successful JSON body contains:

```json
{
  "arguments": {},
  "duplicate": false,
  "s3_url": "https://s3.amazonaws.com/word-art-svgs/<checksum>.svg"
}
```

## Persistence model

There is no database or submission record in these repositories. S3 object keys are the only durable identity, and SVG/PNG pairs are associated by filename stem.

Production cleanup has run in two backed-up passes. On 2026-07-22, the first pass removed every SVG below 12 parsed path segments plus same-stem PNGs: 668 SVGs and 437 PNGs. On 2026-07-23, after the quality boundary increased to 20, the second pass removed another 96 SVGs and 60 PNGs with 12–19 segments. Every target was copied locally with byte counts and SHA-256 hashes before deletion. The current verified inventory is:

| Bucket | Objects | Approximate bytes | Newest object |
| --- | ---: | ---: | --- |
| `word-art-svgs` | 427 | — | 2026-05-16 |
| `word-art-pngs` | 288 | — | 2026-05-16 |

The cleanup classifier parses every SVG path. The first pass matched all user-labeled bad examples and preserved all seven labeled-good examples. The 20-segment pass intentionally removed the labeled-good 13-segment `306269757` pair while preserving the other six. A post-delete scan found zero remaining SVGs below 20 segments. Recovery bundles are outside the repositories at `D:\Projects\word-art-backups\low-quality-under-12-2026-07-22` and `D:\Projects\word-art-backups\low-quality-under-20-2026-07-23`.

The gallery page lives in `daviseford-landing-page`, fetches the public S3 XML inventory without the legacy AWS SDK/Cognito dependency, sorts it newest-first, and renders only 12 images per page. Gallery images are constrained to their media viewport with `object-fit: contain`.

## Local admin boundary

A local admin should be a trusted local process, not browser-only JavaScript. The safe shape is:

1. Use an explicit AWS profile with narrowly scoped `s3:ListBucket`, `s3:GetObject`, and `s3:DeleteObject` permissions for the two buckets.
2. Inventory and pair objects by exact filename stem.
3. Show previews and missing-counterpart state without copying submitted text into a database.
4. Default deletion to dry-run and show both exact keys.
5. Require an explicit confirmation before deleting either object.
6. Record time, operator, reason, and AWS response locally.
7. Handle partial failure so retrying a pair deletion is safe.

Do not expose AWS credentials or delete permissions to the public frontend. Before building the admin, decide whether public bucket listing is still intentional and whether object versioning or a quarantine prefix is needed for recoverability.

## Deployment state

The existing `word-art-serverless-dev` stack was updated in place. Production now runs Python 3.13 as Lambda version 119 at the original API Gateway URL, with 1,024 MB memory, a 29-second timeout, exact-key lookup, request validation, correct SVG media types, narrower IAM, and explicit POST/CORS configuration. A live 19-segment probe returned the documented 400 message and created no S3 object.

The generator and gallery redesigns are local and uncommitted. Their production upload scripts have not been run.
