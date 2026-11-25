# Apply only the reviewed LAB files after installing the matching Godot Android template.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$android = Join-Path $root 'client\android'
$marker = Join-Path $android '.build_version'
$expected = '4.7.2.stable'
if (!(Test-Path -LiteralPath $marker) -or (Get-Content -LiteralPath $marker -Raw).Trim() -cne $expected -or
    !(Test-Path -LiteralPath (Join-Path $android 'build\gradlew.bat'))) {
    throw "Install the official Godot $expected Android build template before applying the LAB overlay."
}
$overlay = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot 'android-overlay\src\main')).Path
$destination = Join-Path $android 'build\src\main'
foreach ($f in (Get-ChildItem -LiteralPath $overlay -File -Recurse)){
    $rel = [IO.Path]::GetRelativePath($overlay,$f.FullName)
    $target = Join-Path $destination $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath $f.FullName -Destination $target
}
Write-Host 'LAB Android overlay applied.'
