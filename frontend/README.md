# Word Art frontend

The static browser client for the Word Art generator. It preprocesses text, submits SVG-generation requests, starts PNG conversion, and displays public S3 results.

## Repository family

- [`word-art`](https://github.com/daviseford/word-art): original Python CLI prototype
- [`word-art-frontend`](https://github.com/daviseford/word-art-frontend): this browser client
- [`word-art-serverless`](https://github.com/daviseford/word-art-serverless): SVG-generation Lambda
- `../daviseford-landing-page`: public gallery page and its paginated S3 browser

Start with [the system architecture](docs/SYSTEM_ARCHITECTURE.md), then read [the revival audit](docs/REVIVAL_AUDIT.md) before modernization or admin work.

## Local development

```sh
npm ci
npm test
npm run build
npm start
```

`npm start` builds once and serves `dist/` at `http://127.0.0.1:8080/`. Set `WORD_ART_PORT` to use another port. It intentionally does not submit anything until the form is used.

The current lockfile still installs and the test/build baseline passes, but the Webpack 3/Babel dependency tree is obsolete and reports many security advisories. Keep dependency modernization separate from behavior changes. The former Webpack Dev Server 2 startup was removed because it crashes on current Node releases.

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

Read the [frontend deployment runbook](docs/FRONTEND_DEPLOYMENT.md) for prerequisites, exact behavior, manual recovery commands, verification, and rollback.

## Known boundary

The SVG API source is in `word-art-serverless`. The configured PNG endpoint is a separate deployed service whose source is not present in the known repositories. The gallery source is `../daviseford-landing-page/pages/word-art-gallery.html`, not this checkout.
