# =============================================================================
# install_assets.ps1 - copy official Luoxiaohei assets into the site public dir
# -----------------------------------------------------------------------------
# Red lines (docs/05): official artwork only; NO AI-generated images; NO fan art.
# Copy only. The script never edits, retouches, crops beyond copying, or upscales.
# Default is DRY-RUN. Pass -Apply to actually copy.
#
# Output messages are English on purpose: PowerShell 5.1 parses a BOM-less .ps1
# as ANSI, so non-ASCII literals in the script body would be mangled. All paths
# that contain non-ASCII segments come from assets.source.json (read as UTF-8).
# =============================================================================
[CmdletBinding()]
param(
  [string]$Source = (Join-Path $PSScriptRoot 'assets.source.json'),
  [string]$Dest   = 'D:\Projects\zszm\public\sixsys\official',
  [switch]$Apply
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Source)) { throw "assets.source.json not found: $Source" }
$cfg = Get-Content -LiteralPath $Source -Raw -Encoding UTF8 | ConvertFrom-Json

$imagesRoot = Join-Path (Join-Path $cfg.assets_root $cfg.db_folder) $cfg.images_rel
Write-Host "[sixsys] source images root : $imagesRoot"
Write-Host "[sixsys] destination        : $Dest"
Write-Host "[sixsys] mode               : $(if ($Apply) { 'APPLY (copy)' } else { 'DRY-RUN (no write)' })"
Write-Host ''

$plan  = @()
$missing = @()
foreach ($item in $cfg.whitelist) {
  $src = Join-Path $imagesRoot $item.rel
  $dst = Join-Path $Dest $item.dest
  $exists = Test-Path -LiteralPath $src
  if (-not $exists) { $missing += $src }
  $size = if ($exists) { (Get-Item -LiteralPath $src).Length } else { 0 }
  $plan += [pscustomobject]@{ id = $item.id; source = $src; target = $dst; exists = $exists; bytes = $size }
}

$plan | Format-Table -AutoSize

if ($missing.Count -gt 0) {
  Write-Warning "[sixsys] $($missing.Count) source file(s) missing. Nothing will be copied for those ids."
}

if (-not $Apply) {
  Write-Host '[sixsys] DRY-RUN complete. Re-run with -Apply to copy.'
  exit 0
}

New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$copied = 0
foreach ($row in $plan) {
  if (-not $row.exists) { continue }
  if (Test-Path -LiteralPath $row.target) {
    $same = $false
    try {
      $a = Get-FileHash -LiteralPath $row.source -Algorithm SHA256
      $b = Get-FileHash -LiteralPath $row.target -Algorithm SHA256
      $same = ($a.Hash -eq $b.Hash)
    } catch { $same = $false }
    if ($same) { Write-Host "[skip] identical: $($row.target)"; continue }
  }
  Copy-Item -LiteralPath $row.source -Destination $row.target -Force
  $copied++
}

Write-Host ''
Write-Host "[sixsys] copied $copied file(s) to $Dest"
Write-Host '[sixsys] rollback: delete the destination folder (no source file was modified).'
