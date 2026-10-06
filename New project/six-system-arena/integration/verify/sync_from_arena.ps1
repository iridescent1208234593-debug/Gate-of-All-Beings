# =============================================================================
# sync_from_arena.ps1 - refresh integration copies from the arena single source
# -----------------------------------------------------------------------------
# Arena is the single source of truth:
#   ..\ui\six-system-icons.js   -> js\six-system-icons.js
#   ..\ui\settlement.js         -> js\settlement.js
#   ..\data\*.json (selected)   -> data\*.json
# Writes ONLY inside the six-system-arena project. Never touches zszm / shared-ui.
#
# This script is a copy helper, so -Apply is the default; use -DryRun to preview.
# English output only (PS 5.1 parses BOM-less .ps1 as ANSI).
# =============================================================================
[CmdletBinding()]
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$root    = Split-Path -Parent $PSScriptRoot          # integration\
$arena   = Split-Path -Parent $root                  # six-system-arena\
$jsSrc   = Join-Path $arena 'ui'
$dataSrc = Join-Path $arena 'data'
$jsDst   = Join-Path $root 'js'
$dataDst = Join-Path $root 'data'

$jsFiles   = @('six-system-icons.js', 'settlement.js')
$dataFiles = @('character_stats.json', 'decks.json', 'achievements.json', 'six-systems.json', 'stat-model.json')

$apply = -not $DryRun
Write-Host "[sixsys] sync mode: $(if ($apply) { 'APPLY' } else { 'DRY-RUN' })"
Write-Host "[sixsys] arena root: $arena"

if ($apply) {
  New-Item -ItemType Directory -Force -Path $jsDst   | Out-Null
  New-Item -ItemType Directory -Force -Path $dataDst | Out-Null
}

$rows = @()
foreach ($f in $jsFiles) {
  $src = Join-Path $jsSrc $f
  $dst = Join-Path $jsDst $f
  if (-not (Test-Path -LiteralPath $src)) { Write-Warning "missing source: $src"; continue }
  if ($apply) { Copy-Item -LiteralPath $src -Destination $dst -Force }
  $rows += [pscustomobject]@{ kind='js';   file=$f; bytes=(Get-Item -LiteralPath $src).Length; target=$dst }
}
foreach ($f in $dataFiles) {
  $src = Join-Path $dataSrc $f
  $dst = Join-Path $dataDst $f
  if (-not (Test-Path -LiteralPath $src)) { Write-Warning "missing source: $src"; continue }
  if ($apply) { Copy-Item -LiteralPath $src -Destination $dst -Force }
  $rows += [pscustomobject]@{ kind='data'; file=$f; bytes=(Get-Item -LiteralPath $src).Length; target=$dst }
}

$rows | Format-Table -AutoSize
Write-Host "[sixsys] $(if ($apply) { 'synced' } else { 'planned' }) $($rows.Count) file(s)."
Write-Host '[sixsys] verify drift with: python verify_integration.py'
