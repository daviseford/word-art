# Frontend deployment

The Word Art frontend is a path-local static project under `frontend/`.
Deployment builds `dist/`, synchronizes it to the `word-art/` prefix of the
`daviseford.com` S3 bucket, invalidates the matching CloudFront path, and
checks the public page and assets.

GitHub Actions can deploy frontend runtime changes merged to `master`, but only
after the staged rollout in
[`GITHUB_ACTIONS_DEPLOYMENT.md`](GITHUB_ACTIONS_DEPLOYMENT.md) has passed and
the `WORD_ART_FRONTEND_AUTO_DEPLOY` repository variable is `true`. Without that
gate, merging only runs verification.

## Production targets

| Resource | Value |
| --- | --- |
| S3 destination | `s3://daviseford.com/word-art/` |
| CloudFront distribution | `EOV559H6J3O6V` |
| Invalidation path | `/word-art/*` |
| Public URL | `https://daviseford.com/word-art/` |

## Prerequisites

- Run from Windows PowerShell in the consolidated repository's `frontend/`
  directory.
- Install Node.js 24.11 or newer, npm, and AWS CLI v2.
- Authenticate AWS CLI with an identity that can synchronize the Word Art S3 prefix and invalidate the listed CloudFront distribution.
- Start from the commit intended for production with a reviewed working tree.

Confirm the active identity before planning or applying a deployment:

```powershell
aws sts get-caller-identity
```

## Preview

The default mode is non-production:

```powershell
cd frontend
.\deploy.ps1
```

The script:

1. Checks that `npm` is available.
2. Runs `npm ci`, `npm test`, and `npm run build`.
3. Requires the exact `dist/index.html`, `dist/app.bundle.js`, and
   `dist/app.css` allowlist.
4. Checks that `aws` is available and prints the active AWS identity.
5. Runs `aws s3 sync` with `--delete --dryrun`.
6. Stops without uploading or invalidating CloudFront.

Review the dry-run output carefully. Unexpected deletions are a stop condition.

The script also exposes two CI-oriented modes:

- `-BuildOnly` installs, tests, builds, and validates the exact artifact
  allowlist without requiring AWS.
- `-UseExistingBuild` validates the existing `dist/` tree and performs only the
  dry-run/apply deployment phase. It never reruns npm while AWS credentials are
  available.

`-BuildOnly` cannot be combined with `-Apply` or `-UseExistingBuild`.

If local execution policy blocks the script, use a process-scoped bypass rather than changing machine policy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1
```

## Deploy

Production mutation is available only with the explicit `-Apply` flag:

```powershell
.\deploy.ps1 -Apply
```

Apply mode repeats the full install, test, build, and dry-run sequence before it:

1. Synchronizes `dist/` to the production S3 prefix with `--delete`.
2. Creates a CloudFront invalidation for `/word-art/*`.
3. Waits for the invalidation to complete.
4. Downloads the page, JavaScript bundle, and stylesheet and requires their SHA-256 hashes to match the local build.

The older shell entry point remains available for Git Bash or WSL and delegates to the same script:

```bash
bash ./upload.sh          # dry run
bash ./upload.sh -Apply   # production
```

## Manual commands

Use these only when diagnosing or recovering the script:

```powershell
npm ci
npm test
npm run build
aws s3 sync .\dist\ s3://daviseford.com/word-art/ --delete --dryrun
aws s3 sync .\dist\ s3://daviseford.com/word-art/ --delete
aws cloudfront create-invalidation --distribution-id EOV559H6J3O6V --paths "/word-art/*"
```

Do not add `--size-only`; a changed asset can keep the same byte length.

## Verification

After the script succeeds:

```powershell
Invoke-WebRequest https://daviseford.com/word-art/ -UseBasicParsing
Invoke-WebRequest https://daviseford.com/word-art/app.bundle.js -UseBasicParsing
Invoke-WebRequest https://daviseford.com/word-art/app.css -UseBasicParsing
```

Then open the public page in a private browser window and verify:

- The redesigned generator loads without horizontal scrolling.
- The sentence counter requires 20 distinct sentences.
- A 19-sentence prompt is rejected locally without submitting.
- A 20-sentence prompt reaches the ready state.

Do not submit a production generation probe solely for deployment verification; it creates public bucket data and can incur AWS cost.

## Rollback

Redeploy a known-good canonical commit from a temporary worktree:

```powershell
git worktree add ..\word-art-rollback <known-good-commit>
cd ..\word-art-rollback\frontend
.\deploy.ps1
.\deploy.ps1 -Apply
```

Review the rollback dry run before applying it. After verification, return to the main checkout and remove the temporary worktree:

```powershell
git worktree remove ..\word-art-rollback
```
