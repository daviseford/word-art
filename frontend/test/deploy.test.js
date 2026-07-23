const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const expect = require('chai').expect;


describe('frontend deployment scripts', function () {
  const repositoryRoot = path.resolve(__dirname, '..');
  const deployScript = fs.readFileSync(path.join(repositoryRoot, 'deploy.ps1'), 'utf8');
  const shellWrapper = fs.readFileSync(path.join(repositoryRoot, 'upload.sh'), 'utf8');

  it('requires an explicit apply flag and previews S3 changes first', function () {
    expect(deployScript).to.contain('[switch]$Apply');
    expect(deployScript).to.contain("'--dryrun'");
    expect(deployScript).to.not.contain('--size-only');
  });

  it('verifies the app before uploading and waits for CloudFront', function () {
    expect(deployScript).to.contain("@('ci')");
    expect(deployScript).to.contain("@('test')");
    expect(deployScript).to.contain("@('run', 'build')");
    expect(deployScript).to.contain("'invalidation-completed'");
    expect(deployScript).to.contain('Invoke-WebRequest');
    expect(deployScript).to.contain('Get-FileHash');
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
