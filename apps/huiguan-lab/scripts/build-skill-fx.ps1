# Rebuilds build/skill-fx (the PixelFX skill effects served at /fx/) from the read-only asset copy.
#   1. copies the pixelfx-godot Godot project into a work folder (the asset library is never written to)
#   2. bakes every effect to a sprite sheet, one Godot process per effect (one crash can't stop the rest;
#      already-baked sheets are kept, so the script can be rerun to resume)
#   3. repacks them for the web (scripts/pack_skill_fx.py) and copies the MIT notice next to them
# Usage: scripts\build-skill-fx.ps1 [-Source <pixelfx-godot\godot>] [-Work <folder>] [-Only fire/torch,ice/freeze]
param(
  [Parameter(Mandatory)][string]$Source,
  [string]$Work = '',
  [string[]]$Only = @()
)
$ErrorActionPreference = 'Stop'
$Lab = Split-Path -Parent $PSScriptRoot
if (-not $Work) { $Work = Join-Path (Split-Path -Parent $Lab) 'zszm-lab-v2-tools' }
$Godot = if ($env:LAB_GODOT) { $env:LAB_GODOT } else { Join-Path (Split-Path -Parent $Lab) 'Godot\Godot_v4.7.2-stable_win64.exe' }
$Py = Join-Path $Lab 'server\.venv\Scripts\python.exe'
$Proj = Join-Path $Work 'pixelfx-godot'
$Sheets = Join-Path $Work 'fx-sheets'
$Out = Join-Path $Lab 'build\skill-fx'
New-Item -ItemType Directory -Force $Work, $Sheets | Out-Null
if (-not (Test-Path (Join-Path $Proj 'project.godot'))) {
  robocopy (Join-Path $Source 'godot') $Proj /E /XD records .parity .godot /NFL /NDL /NJH /NJS /NP | Out-Null
  & $Godot --headless --path $Proj --import 2>&1 | Out-Null
}
$catalog = Join-Path $Source 'godot\docs\CATALOG.md'
$ids = if ($Only.Count) { $Only } else { Select-String -Path $catalog -Pattern '`([a-z]+/[a-z0-9-]+)`' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique }
$log = Join-Path $Work 'bake-log.txt'
foreach ($id in $ids) {
  $png = Join-Path $Sheets ($id + '.png')
  if ((Test-Path $png) -and -not $Only.Count) { continue }
  $t = Get-Date
  & $Godot --headless --no-header --path $Proj -s res://tools/cli.gd -- sheets $id --out $Sheets 2>&1 | Out-Null
  "{0}`t{1}`t{2:N0}s" -f $id, $(if (Test-Path $png) { 'ok' } else { 'FAIL' }), ((Get-Date) - $t).TotalSeconds | Add-Content $log -Encoding utf8
}
& $Py -B (Join-Path $PSScriptRoot 'pack_skill_fx.py') $Sheets $Out
Copy-Item (Join-Path $Source 'LICENSE') (Join-Path $Out 'LICENSE-pixelfx.txt')
Copy-Item (Join-Path $Source 'NOTICE.md') (Join-Path $Out 'NOTICE-pixelfx.md')
& $Py -B (Join-Path $PSScriptRoot 'skill_catalog.py') (Join-Path $Source 'godot\docs\CATALOG.md')
Write-Host "skill fx ready in $Out"
