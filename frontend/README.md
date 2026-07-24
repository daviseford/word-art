# Word Art frontend

The static browser client for the Word Art generator. It preprocesses text, submits SVG-generation requests, starts PNG conversion, and displays public S3 results.

This path-local project is the browser component of the canonical
[`word-art`](https://github.com/daviseford/word-art) repository. The SVG API is
in [`../api/`](../api/), and the original algorithm reference is in
[`../cli-reference/`](../cli-reference/). The public gallery remains in the
separate `daviseford-landing-page` repository.

Start with [the system architecture](../docs/SYSTEM_ARCHITECTURE.md), then read
[the revival audit](../docs/REVIVAL_AUDIT.md) before modernization or admin
work.

## Local development

Use Node.js 24.11 or newer.

```sh
npm ci
npm test
npm run build
npm start
```

`npm start` builds once and serves `dist/` at `http://127.0.0.1:8080/`. Set `WORD_ART_PORT` to use another port. It intentionally does not submit anything until the form is used.

The build uses Webpack 5, Babel 8, and jQuery 4. The committed lockfile installs with no known npm audit findings. The dependency-free local server remains separate from the production build toolchain.

The form requires at least 20 distinct sentences before submitting. The production SVG Lambda independently rejects requests with fewer than 20 rendered segments. The local redesign uses `src/app.css`; Webpack copies it into `dist/app.css` during the build.

The configured APIs are production services. Loading the page locally is safe; submitting the form can create public S3 objects and incur AWS cost.

## Deployment

The canonical deployment command is a safe-by-default PowerShell script:

```powershell
# Install, test, build, and preview the S3 changes. Production is not mutated.
.\deploy.ps1

# Repeat those checks, upload to S3, invalidate CloudFront, wait, and smoke-test.
.\deploy.ps1 -Apply
```

Production deployment requires explicit approval and correctly scoped AWS credentials. The compatibility wrapper `bash ./upload.sh` delegates to the same PowerShell script and accepts `-Apply`.

Read the [frontend deployment runbook](../docs/FRONTEND_DEPLOYMENT.md) for
prerequisites, exact behavior, manual recovery commands, verification, and
rollback.

## Known boundary

The SVG API source is in `../api/`. The configured PNG endpoint is a separate
deployed service whose source is not present in this repository. The gallery is
owned by `daviseford-landing-page`, not this checkout.
