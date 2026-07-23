# Frontend deployment

The Word Art frontend is a static site. Deployment builds `dist/`, synchronizes it to the `word-art/` prefix of the `daviseford.com` S3 bucket, invalidates the matching CloudFront path, and checks the public page and assets.

Merging to GitHub does not deploy this repository automatically.

## Production targets

| Resource | Value |
| --- | --- |
| S3 destination | `s3://daviseford.com/word-art/` |
| CloudFront distribution | `EOV559H6J3O6V` |
| Invalidation path | `/word-art/*` |
| Public URL | `https://daviseford.com/word-art/` |

## Prerequisites

- Run from Windows PowerShell in this repository.
- Install Node.js, npm, and AWS CLI v2.
- Authenticate AWS CLI with an identity that can synchronize the Word Art S3 prefix and invalidate the listed CloudFront distribution.
- Start from the commit intended for production with a reviewed working tree.

Confirm the active identity before planning or applying a deployment:

```powershell
aws sts get-caller-identity
```

## Preview

The default mode is non-production:

```powershell
cd D:\Projects\word-art-frontend
.\deploy.ps1
```

The script:

1. Checks that `npm` and `aws` are available.
2. Prints the active AWS identity.
3. Runs `npm ci`, `npm test`, and `npm run build`.
4. Requires `dist/index.html`, `dist/app.bundle.js`, and `dist/app.css`.
5. Runs `aws s3 sync` with `--delete --dryrun`.
6. Stops without uploading or invalidating CloudFront.

Review the dry-run output carefully. Unexpected deletions are a stop condition.

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

Redeploy a known-good frontend commit from a temporary worktree:

```powershell
git worktree add ..\word-art-frontend-rollback <known-good-commit>
cd ..\word-art-frontend-rollback
.\deploy.ps1
.\deploy.ps1 -Apply
```

Review the rollback dry run before applying it. After verification, return to the main checkout and remove the temporary worktree:

```powershell
git worktree remove ..\word-art-frontend-rollback
```
