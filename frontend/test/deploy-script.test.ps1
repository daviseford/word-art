$ErrorActionPreference = 'Stop'

$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$global:WordArtDeployTestEvents = [System.Collections.Generic.List[string]]::new()

function npm {
  [void]$global:WordArtDeployTestEvents.Add("npm $($args -join ' ')")
  $global:LASTEXITCODE = 0
}

function aws {
  [void]$global:WordArtDeployTestEvents.Add("aws $($args -join ' ')")
  if ($args[0] -eq 'cloudfront' -and $args[1] -eq 'create-invalidation') {
    Write-Output 'I-FAKE-123'
  }
  $global:LASTEXITCODE = 0
}

function Invoke-WebRequest {
  param(
    [string]$Uri,
    [switch]$UseBasicParsing,
    [int]$TimeoutSec,
    [string]$OutFile
  )

  [void]$global:WordArtDeployTestEvents.Add("web $Uri")
  $artifact = if ($Uri.EndsWith('/')) { 'index.html' } else { $Uri.Split('/')[-1] }
  Copy-Item -LiteralPath (Join-Path $RepositoryRoot "dist\$artifact") -Destination $OutFile
}

function Assert-Count {
  param(
    [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$Matches,
    [Parameter(Mandatory)][int]$Expected,
    [Parameter(Mandatory)][string]$Message
  )

  if ($Matches.Count -ne $Expected) {
    throw "$Message Expected $Expected, observed $($Matches.Count)."
  }
}

function Assert-BuildOutputRejected {
  $global:WordArtDeployTestEvents.Clear()
  $RejectedBuildOutput = $false

  try {
    & (Join-Path $RepositoryRoot 'deploy.ps1')
  }
  catch {
    if ($_.Exception.Message -like 'Build output differs from the deployment allowlist:*') {
      $RejectedBuildOutput = $true
    }
    else {
      throw
    }
  }

  if (-not $RejectedBuildOutput) {
    throw 'Unexpected build output must stop deployment.'
  }
  Assert-Count @(
    $global:WordArtDeployTestEvents | Where-Object { $_ -like 'aws s3 sync *' }
  ) 0 'Rejected build output must not reach S3 synchronization.'
}

& (Join-Path $RepositoryRoot 'deploy.ps1')
$DryRunEvents = @($global:WordArtDeployTestEvents)

Assert-Count @(
  $DryRunEvents | Where-Object { $_ -like 'aws s3 sync *--dryrun' }
) 1 'Dry-run mode must preview exactly once.'
Assert-Count @(
  $DryRunEvents | Where-Object { $_ -like 'aws s3 sync *' -and $_ -notlike '*--dryrun' }
) 0 'Dry-run mode must not upload.'
Assert-Count @(
  $DryRunEvents | Where-Object { $_ -like 'aws cloudfront *' }
) 0 'Dry-run mode must not invalidate CloudFront.'

$global:WordArtDeployTestEvents.Clear()
& (Join-Path $RepositoryRoot 'deploy.ps1') -Apply
$ApplyEvents = @($global:WordArtDeployTestEvents)

Assert-Count @(
  $ApplyEvents | Where-Object { $_ -like 'aws s3 sync *--dryrun' }
) 1 'Apply mode must preview before upload.'
Assert-Count @(
  $ApplyEvents | Where-Object { $_ -like 'aws s3 sync *' -and $_ -notlike '*--dryrun' }
) 1 'Apply mode must upload exactly once.'
Assert-Count @(
  $ApplyEvents | Where-Object { $_ -like 'aws cloudfront create-invalidation *' }
) 1 'Apply mode must create one invalidation.'
Assert-Count @(
  $ApplyEvents | Where-Object { $_ -like 'aws cloudfront wait invalidation-completed *' }
) 1 'Apply mode must wait for its invalidation.'
Assert-Count @(
  $ApplyEvents | Where-Object { $_ -like 'web *' }
) 3 'Apply mode must verify all deployed artifacts.'

$UnexpectedArtifact = Join-Path $RepositoryRoot 'dist\unexpected.txt'
try {
  Set-Content -LiteralPath $UnexpectedArtifact -Value 'not deployable'
  Assert-BuildOutputRejected
}
finally {
  if (Test-Path -LiteralPath $UnexpectedArtifact) {
    Remove-Item -LiteralPath $UnexpectedArtifact -Force
  }
}

$CanonicalBundle = Join-Path $RepositoryRoot 'dist\app.bundle.js'
$CaseVariantBundle = Join-Path $RepositoryRoot 'dist\APP.BUNDLE.JS'
$IntermediateBundle = Join-Path $RepositoryRoot 'dist\app.bundle.case-test'
try {
  Move-Item -LiteralPath $CanonicalBundle -Destination $IntermediateBundle
  Move-Item -LiteralPath $IntermediateBundle -Destination $CaseVariantBundle
  Assert-BuildOutputRejected
}
finally {
  if (Test-Path -LiteralPath $IntermediateBundle) {
    Move-Item -LiteralPath $IntermediateBundle -Destination $CanonicalBundle
  }
  elseif (Test-Path -LiteralPath $CaseVariantBundle) {
    Move-Item -LiteralPath $CaseVariantBundle -Destination $IntermediateBundle
    Move-Item -LiteralPath $IntermediateBundle -Destination $CanonicalBundle
  }
}

Write-Output 'deploy.ps1 behavior OK'
