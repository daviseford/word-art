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

Write-Output 'deploy.ps1 behavior OK'
