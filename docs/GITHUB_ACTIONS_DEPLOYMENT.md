# GitHub Actions deployment

Word Art has separate GitHub Actions workflows for the static frontend and the
Serverless API:

| Component | Workflow | Automatic production trigger |
| --- | --- | --- |
| Frontend | `.github/workflows/deploy-frontend.yml` | A deployable `frontend/` path changes on `master` and `WORD_ART_FRONTEND_AUTO_DEPLOY=true` |
| API | `.github/workflows/deploy-api.yml` | A deployable `api/` path changes on `master` and `WORD_ART_API_AUTO_DEPLOY=true` |

Both workflows also support manual dispatches whose `dry_run` input defaults to
`true`. Keep the automatic-deploy variables unset until the one-time rollout
below is complete.

## Security model

GitHub receives no long-lived AWS access keys. Each deployment uses GitHub OIDC
to request a short-lived session for a separate IAM role:

- `gha-deploy-word-art-frontend` can synchronize only
  `s3://daviseford.com/word-art/` and invalidate the one CloudFront
  distribution.
- `gha-deploy-word-art-api` can update only the existing
  `word-art-serverless-dev` stack and its named Lambda, API Gateway, execution
  role, log group, and deployment bucket.

The role trust policy accepts only this repository's `master` branch. It lists
both the legacy repository-name OIDC subject and GitHub's immutable
owner/repository-ID subject.

Build and test jobs cannot request OIDC tokens. The frontend passes its exact
verified `dist/` tree to a separate deployment job, which is the only job that
can request the frontend role. The API is the exception at the packaging
boundary: Serverless Framework v4 requires AWS credentials even for
`serverless package`, so its separate deployment job restores the locked npm
tree with lifecycle scripts disabled, requests the short-lived API role, and
then packages. Python dependency installation, the full API tests, and the
ordinary locked npm install already ran in the OIDC-free verification job.

Serverless Framework itself also needs one GitHub repository secret:
`SERVERLESS_ACCESS_KEY`. Create a dedicated CI access key in the Serverless
Dashboard rather than copying a developer login token.

## One-time AWS and GitHub setup

These commands change IAM and repository configuration. Run them only from an
admin shell after reviewing
[`infra/github-actions-deploy-roles.yml`](../infra/github-actions-deploy-roles.yml).

First validate and deploy the IAM bootstrap stack:

```powershell
aws cloudformation validate-template `
  --template-body file://infra/github-actions-deploy-roles.yml `
  --region us-east-1

aws cloudformation deploy `
  --stack-name word-art-github-actions-deploy `
  --template-file infra/github-actions-deploy-roles.yml `
  --capabilities CAPABILITY_NAMED_IAM `
  --region us-east-1
```

Read the role outputs without exposing credentials:

```powershell
$frontendRole = aws cloudformation describe-stacks `
  --stack-name word-art-github-actions-deploy `
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDeployRoleArn'].OutputValue" `
  --output text

$apiRole = aws cloudformation describe-stacks `
  --stack-name word-art-github-actions-deploy `
  --query "Stacks[0].Outputs[?OutputKey=='ApiDeployRoleArn'].OutputValue" `
  --output text

gh variable set WORD_ART_FRONTEND_DEPLOY_ROLE_ARN `
  --repo daviseford/word-art --body $frontendRole
gh variable set WORD_ART_API_DEPLOY_ROLE_ARN `
  --repo daviseford/word-art --body $apiRole
```

Create a CI access key using the
[Serverless Framework CI/CD instructions](https://www.serverless.com/framework/docs/guides/dashboard/cicd/running-in-your-own-cicd),
then store it without putting the value in shell history:

```powershell
gh secret set SERVERLESS_ACCESS_KEY --repo daviseford/word-art
```

Do not create either automatic-deploy variable yet.

## Go/no-go rollout

Run each component separately and stop on any unexpected output.

### 1. Frontend dry run

```powershell
gh workflow run deploy-frontend.yml `
  --repo daviseford/word-art --ref master -f dry_run=true
```

Require all of the following:

- The frontend installs, tests, builds, and emits exactly `index.html`,
  `app.bundle.js`, and `app.css`.
- OIDC reports AWS account `885954027390`.
- The S3 preview is limited to `s3://daviseford.com/word-art/`.
- No upload or CloudFront invalidation runs.

### 2. API dry run

```powershell
gh workflow run deploy-api.yml `
  --repo daviseford/word-art --ref master -f dry_run=true
```

Require all of the following:

- The complete API test suite passes without AWS credentials.
- Serverless packages successfully using the short-lived API role.
- The package-size gate reports one ZIP below Lambda's 250 MiB unpacked limit.
- The workflow explicitly reports that CloudFormation was not changed.

### 3. First real deployments

These commands mutate production. Run them only after reviewing both dry runs:

```powershell
gh workflow run deploy-frontend.yml `
  --repo daviseford/word-art --ref master -f dry_run=false

gh workflow run deploy-api.yml `
  --repo daviseford/word-art --ref master -f dry_run=false
```

Run them sequentially. The frontend workflow waits for CloudFront and verifies
the three public SHA-256 hashes. The API workflow reports Serverless stack
information but deliberately does not invoke the public Lambda or submit a
generation probe.

For 30 minutes after each deploy:

- Frontend: watch the public page and browser console; check desktop/mobile load
  and the 19/20 sentence boundary without submitting.
- API: watch Lambda errors, timeouts, duration, and API Gateway 5xx responses.
  Confirm the stack is `UPDATE_COMPLETE`.

### 4. Enable automatic deploys

Only after both real dispatches are green:

```powershell
gh variable set WORD_ART_FRONTEND_AUTO_DEPLOY `
  --repo daviseford/word-art --body true
gh variable set WORD_ART_API_AUTO_DEPLOY `
  --repo daviseford/word-art --body true
```

From then on, deployable changes merged to `master` trigger the corresponding
production workflow. Documentation, tests, admin scripts, and workflow-only
changes do not deploy production.

## Emergency stop and rollback

Disable automatic deployment without editing code:

```powershell
gh variable set WORD_ART_FRONTEND_AUTO_DEPLOY `
  --repo daviseford/word-art --body false
gh variable set WORD_ART_API_AUTO_DEPLOY `
  --repo daviseford/word-art --body false
```

For a bad release, leave the gate disabled, revert the offending commit on a
reviewed branch, merge the revert, and manually dispatch the corresponding
workflow with `dry_run=false`. A frontend rollback restores the exact
three-file build. An API rollback creates a new Lambda version from the reverted
source; it does not reuse or invoke an older version directly.

Never use `serverless remove` as rollback.
