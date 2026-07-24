const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');


describe('frontend deployment scripts', function () {
  const repositoryRoot = path.resolve(__dirname, '..');
  const workspaceRoot = path.resolve(repositoryRoot, '..');
  const deployScript = fs.readFileSync(path.join(repositoryRoot, 'deploy.ps1'), 'utf8');
  const shellWrapper = fs.readFileSync(path.join(repositoryRoot, 'upload.sh'), 'utf8');
  const deploymentWorkflow = fs.readFileSync(
    path.join(workspaceRoot, '.github', 'workflows', 'deploy-frontend.yml'),
    'utf8'
  );
  const deploymentRoles = fs.readFileSync(
    path.join(workspaceRoot, 'infra', 'github-actions-deploy-roles.yml'),
    'utf8'
  );

  it('requires an explicit apply flag and previews S3 changes first', function () {
    expect(deployScript).to.contain('[switch]$Apply');
    expect(deployScript).to.contain('[switch]$BuildOnly');
    expect(deployScript).to.contain('[switch]$UseExistingBuild');
    expect(deployScript).to.contain("'--dryrun'");
    expect(deployScript).to.not.contain('--size-only');
    expect(deployScript).to.contain('$ExpectedArtifacts');
    expect(deployScript).to.contain('Compare-Object');
    expect(deployScript).to.contain('-CaseSensitive');
  });

  it('verifies the app before uploading and waits for CloudFront', function () {
    expect(deployScript).to.contain("@('ci')");
    expect(deployScript).to.contain("@('test')");
    expect(deployScript).to.contain("@('run', 'build')");
    expect(deployScript).to.contain("'invalidation-completed'");
    expect(deployScript).to.contain('Invoke-WebRequest');
    expect(deployScript).to.contain('Get-FileHash');
  });

  it('keeps build tooling outside the credential-bearing upload phase', function () {
    expect(deployScript).to.contain('if (-not $UseExistingBuild)');
    expect(deployScript).to.contain('if ($BuildOnly)');
    expect(deployScript.indexOf("Assert-Command npm")).to.be.lessThan(
      deployScript.indexOf("Assert-Command aws")
    );
  });

  it('grants OIDC only to the gated deployment job', function () {
    const workflowHeader = deploymentWorkflow.slice(
      0,
      deploymentWorkflow.indexOf('\njobs:')
    );

    expect(workflowHeader).to.not.contain('id-token: write');
    expect(deploymentWorkflow).to.match(
      /\n  deploy:\n[\s\S]*?    permissions:\n      contents: read\n      id-token: write/
    );
    expect(deploymentWorkflow).to.contain('actions/upload-artifact@');
    expect(deploymentWorkflow).to.contain('actions/download-artifact@');
  });

  it('allows the deployment role to wait for its CloudFront invalidation', function () {
    expect(deploymentRoles).to.contain('cloudfront:CreateInvalidation');
    expect(deploymentRoles).to.contain('cloudfront:GetInvalidation');
  });

  it('keeps upload.sh as a thin compatibility wrapper', function () {
    expect(shellWrapper).to.contain('deploy.ps1');
    expect(shellWrapper).to.not.contain('aws s3 sync');
  });

  it('keeps dry-run and apply side effects separated', function () {
    if (process.platform !== 'win32') this.skip();

    const result = childProcess.spawnSync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', path.join(__dirname, 'deploy-script.test.ps1'),
    ], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    });

    expect(result.status, result.stderr || result.stdout).to.equal(0);
    expect(result.stdout).to.contain('deploy.ps1 behavior OK');
  });
});
