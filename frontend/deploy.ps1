[CmdletBinding()]
param(
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$SiteS3 = 's3://daviseford.com/word-art/'
$DistributionId = 'EOV559H6J3O6V'
$InvalidationPath = '/word-art/*'
$SiteUrl = 'https://daviseford.com/word-art/'
$DistPath = Join-Path $PSScriptRoot 'dist'
$verificationFiles = @()

function Assert-Command {
  param([Parameter(Mandatory)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found on PATH."
  }
}

function Invoke-External {
  param(
    [Parameter(Mandatory)][string]$Command,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "'$Command $($Arguments -join ' ')' failed with exit code $LASTEXITCODE."
  }
}

Push-Location $PSScriptRoot
try {
  Assert-Command npm
  Assert-Command aws

  Write-Host 'Checking the active AWS identity...'
  Invoke-External aws @('sts', 'get-caller-identity')

  Write-Host 'Installing the locked dependency tree...'
  Invoke-External npm @('ci')

  Write-Host 'Running frontend tests...'
  Invoke-External npm @('test')

  Write-Host 'Building dist/...'
  Invoke-External npm @('run', 'build')

  foreach ($artifact in @('index.html', 'app.bundle.js', 'app.css')) {
    $artifactPath = Join-Path $DistPath $artifact
    if (-not (Test-Path -LiteralPath $artifactPath -PathType Leaf)) {
      throw "Build artifact is missing: $artifactPath"
    }
  }

  $syncArguments = @('s3', 'sync', $DistPath, $SiteS3, '--delete')

  Write-Host 'Previewing the production S3 synchronization...'
  Invoke-External aws ($syncArguments + @('--dryrun'))

  if (-not $Apply) {
    Write-Host ''
    Write-Host 'Dry run complete. No production files were changed.'
    Write-Host 'Run .\deploy.ps1 -Apply after reviewing the preview.'
    return
  }

  Write-Host 'Uploading dist/ to production S3...'
  Invoke-External aws $syncArguments

  Write-Host 'Creating the CloudFront invalidation...'
  $invalidationOutput = & aws cloudfront create-invalidation `
    --distribution-id $DistributionId `
    --paths $InvalidationPath `
    --query 'Invalidation.Id' `
    --output text
  if ($LASTEXITCODE -ne 0) {
    throw "CloudFront invalidation creation failed with exit code $LASTEXITCODE."
  }

  $invalidationId = ($invalidationOutput | Out-String).Trim()
  if (-not $invalidationId -or $invalidationId -eq 'None') {
    throw 'CloudFront did not return an invalidation ID.'
  }

  Write-Host "Waiting for CloudFront invalidation $invalidationId..."
  Invoke-External aws @(
    'cloudfront',
    'wait',
    'invalidation-completed',
    '--distribution-id',
    $DistributionId,
    '--id',
    $invalidationId
  )

  Write-Host 'Checking deployed asset hashes...'
  foreach ($artifact in @('index.html', 'app.bundle.js', 'app.css')) {
    $url = if ($artifact -eq 'index.html') { $SiteUrl } else { "${SiteUrl}${artifact}" }
    $download = New-TemporaryFile
    $verificationFiles += $download.FullName
    Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30 -OutFile $download.FullName

    $localHash = (Get-FileHash (Join-Path $DistPath $artifact) -Algorithm SHA256).Hash
    $deployedHash = (Get-FileHash $download.FullName -Algorithm SHA256).Hash
    if ($localHash -ne $deployedHash) {
      throw "Deployed content does not match dist/$artifact after invalidation."
    }
  }

  Write-Host ''
  Write-Host "Deployment complete: $SiteUrl"
}
finally {
  foreach ($verificationFile in $verificationFiles) {
    if (Test-Path -LiteralPath $verificationFile) {
      Remove-Item -LiteralPath $verificationFile -Force
    }
  }
  Pop-Location
}
