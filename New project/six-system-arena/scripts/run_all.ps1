#Requires -Version 5.1
<#
================================================================================
 run_all.ps1 — 六系演武一键自动化串联（R2 建立 · R8 扩展端到端联调）
================================================================================
 串联链路：数值生成 → 卡组生成 → 成就校验 → 审计 → JS 语法自检 → 冒烟测试 → 端到端联调

 安全边界（重要）
   · 全部产物只落在本仓库 E:\Projects\New project\six-system-arena 内；
   · 数据库以 mode=ro 只读打开（generate_stats.py 内部保证），不写任何外部仓库；
   · 本脚本**不会**调用 patch_lxh_icons.py --apply（该操作会写外部 shared-ui），
     如需固化六键补丁请单独执行并显式授权。
   · 幂等：所有脚本确定性可重算，重复执行结果一致。

 用法
   powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1"
   powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -Stage checks
   powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -DryRun
   powershell -ExecutionPolicy Bypass -File "scripts\run_all.ps1" -KeepGoing
================================================================================
#>
[CmdletBinding()]
param(
    [ValidateSet('all', 'data', 'checks')]
    [string]$Stage = 'all',

    [ValidateSet('all', 'mainline')]
    [string]$Scope = 'all',

    [switch]$SkipStats,      # 跳过数值重算（复用现有 character_stats.json，适合日常快速回归）
    [switch]$KeepGoing,      # 单步失败不中断，跑完全部步骤
    [switch]$DryRun          # 只打印命令，不实际执行
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path $Root)) { $Root = (Get-Location).Path }

$Py      = 'python'
$Node    = 'node'
$Results = New-Object System.Collections.ArrayList

function Write-Head([string]$text) {
    Write-Host ''
    Write-Host ('=' * 74) -ForegroundColor DarkCyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ('=' * 74) -ForegroundColor DarkCyan
}

function Invoke-Step {
    param(
        [string]$Name,
        [string]$File,
        [string[]]$StepArgs,
        [string]$WorkDir = $Root,
        [switch]$Optional
    )
    $rel = $File
    Write-Host ''
    Write-Host "[步骤] $Name" -ForegroundColor Yellow
    Write-Host "       $rel $($StepArgs -join ' ')" -ForegroundColor DarkGray

    if ($DryRun) {
        [void]$Results.Add([pscustomobject]@{ Step = $Name; Status = 'DRYRUN'; Seconds = 0 })
        return $true
    }

    if (-not (Test-Path $File)) {
        $msg = "缺少文件：$File"
        if ($Optional) { Write-Warning $msg; [void]$Results.Add([pscustomobject]@{ Step = $Name; Status = 'SKIP'; Seconds = 0 }); return $true }
        Write-Host "  [失败] $msg" -ForegroundColor Red
        [void]$Results.Add([pscustomobject]@{ Step = $Name; Status = 'FAIL'; Seconds = 0 })
        return $false
    }

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Push-Location $WorkDir
    try {
        # 直接调用可执行文件，参数以数组传入，避免引号/中文路径被二次解析
        & $File @StepArgs
        $code = $LASTEXITCODE
        if ($null -eq $code) { $code = 0 }
    }
    finally { Pop-Location }
    $sw.Stop()

    $secs = [math]::Round($sw.Elapsed.TotalSeconds, 2)
    if ($code -eq 0) {
        Write-Host "  [通过] 耗时 ${secs}s" -ForegroundColor Green
        [void]$Results.Add([pscustomobject]@{ Step = $Name; Status = 'PASS'; Seconds = $secs })
        return $true
    }
    Write-Host "  [失败] 退出码 $code，耗时 ${secs}s" -ForegroundColor Red
    [void]$Results.Add([pscustomobject]@{ Step = $Name; Status = 'FAIL'; Seconds = $secs })
    return $false
}

function Get-ToolPath([string]$name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

# ============================== 前置检查 ==============================
Write-Head '六系演武 · 一键自动化（数值 → 卡组 → 成就 → 审计 → 自检 → 端到端联调）'
Write-Host "项目根目录 : $Root"
Write-Host "阶段       : $Stage   数值范围: $Scope   跳过数值重算: $($SkipStats.IsPresent)   空跑: $($DryRun.IsPresent)"

$pythonExe = Get-ToolPath $Py
$nodeExe   = Get-ToolPath $Node
Write-Host ("Python     : " + $(if ($pythonExe) { $pythonExe } else { '未找到（数值/校验/审计步骤会失败）' }))
Write-Host ("Node.js    : " + $(if ($nodeExe) { $nodeExe } else { '未找到（JS 语法自检 / 冒烟测试将跳过）' }))

$S_GEN   = Join-Path $Root 'data\scripts\generate_stats.py'
$S_DECK  = Join-Path $Root 'data\scripts\generate_decks.py'
$S_VALID = Join-Path $Root 'data\scripts\validate_achievements.py'
$S_AUDIT = Join-Path $Root 'data\scripts\audit_r2.py'
$S_SMOKE = Join-Path $Root 'data\scripts\smoke_test.js'
$S_E2E   = Join-Path $Root 'data\scripts\e2e_flow.js'
$UI_DIR  = Join-Path $Root 'ui'

$ok = $true

# ============================== 数据链 ==============================
if ($Stage -in @('all', 'data')) {

    if (-not $SkipStats) {
        $r = Invoke-Step -Name '1/7 数值生成 generation' -File $pythonExe -StepArgs @($S_GEN, '--scope', $Scope)
        if (-not $r -and -not $KeepGoing) { throw '数值生成失败，链路中止。' }
    }
    else {
        Write-Host ''
        Write-Host '[步骤] 1/7 数值生成 —— 已按 -SkipStats 跳过，复用现有 character_stats.json' -ForegroundColor Yellow
        [void]$Results.Add([pscustomobject]@{ Step = '1/7 数值生成'; Status = 'SKIP'; Seconds = 0 })
    }

    $r = Invoke-Step -Name '2/7 卡组生成 decks' -File $pythonExe -StepArgs @($S_DECK)
    if (-not $r -and -not $KeepGoing) { throw '卡组生成失败，链路中止。' }
}

# ============================== 校验链 ==============================
if ($Stage -in @('all', 'checks')) {

    $r = Invoke-Step -Name '3/7 成就与卡组校验 validate' -File $pythonExe -StepArgs @($S_VALID)
    if (-not $r -and -not $KeepGoing) { throw '成就校验失败，链路中止。' }

    $r = Invoke-Step -Name '4/7 审计报告 audit' -File $pythonExe -StepArgs @($S_AUDIT)
    if (-not $r -and -not $KeepGoing) { throw '审计生成失败，链路中止。' }

    # ---- JS 语法自检（node --check，逐个文件） ----
    Write-Host ''
    Write-Host '[步骤] 5/7 JS 语法自检 node --check' -ForegroundColor Yellow
    $jsFiles = @()
    if (Test-Path $UI_DIR) { $jsFiles += Get-ChildItem -Path $UI_DIR -Filter '*.js' -File | Select-Object -ExpandProperty FullName }
    if (Test-Path $S_SMOKE) { $jsFiles += $S_SMOKE }
    if (Test-Path $S_E2E)   { $jsFiles += $S_E2E }

    if (-not $nodeExe) {
        Write-Warning '未检测到 Node.js，跳过语法自检与冒烟测试。'
        [void]$Results.Add([pscustomobject]@{ Step = '5/7 JS 语法自检'; Status = 'SKIP'; Seconds = 0 })
    }
    elseif ($DryRun) {
        foreach ($f in $jsFiles) { Write-Host "       node --check $f" -ForegroundColor DarkGray }
        [void]$Results.Add([pscustomobject]@{ Step = '5/7 JS 语法自检'; Status = 'DRYRUN'; Seconds = 0 })
    }
    else {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $syntaxOk = $true
        foreach ($f in $jsFiles) {
            Push-Location $Root
            try { & $nodeExe --check $f 2>&1 | Out-Null; $c = $LASTEXITCODE } finally { Pop-Location }
            if ($null -eq $c) { $c = 0 }
            if ($c -eq 0) { Write-Host ("  [通过] " + (Split-Path $f -Leaf)) -ForegroundColor Green }
            else { Write-Host ("  [失败] " + (Split-Path $f -Leaf)) -ForegroundColor Red; $syntaxOk = $false }
        }
        $sw.Stop()
        $secs = [math]::Round($sw.Elapsed.TotalSeconds, 2)
        [void]$Results.Add([pscustomobject]@{ Step = '5/7 JS 语法自检'; Status = $(if ($syntaxOk) { 'PASS' } else { 'FAIL' }); Seconds = $secs })
        if (-not $syntaxOk) { $ok = $false; if (-not $KeepGoing) { throw 'JS 语法自检失败。' } }
    }

    # ---- 冒烟测试（三模块联动契约） ----
    if ($nodeExe) {
        $r = Invoke-Step -Name '6/7 冒烟测试 smoke' -File $nodeExe -StepArgs @($S_SMOKE) -Optional
        if (-not $r) { $ok = $false; if (-not $KeepGoing) { throw '冒烟测试失败。' } }
    }
    else {
        [void]$Results.Add([pscustomobject]@{ Step = '6/7 冒烟测试'; Status = 'SKIP'; Seconds = 0 })
    }

    # ---- 端到端联调（R8：对战内核 → 战斗日志契约 → 成就判定 → 收集图鉴） ----
    if ($nodeExe) {
        $r = Invoke-Step -Name '7/7 端到端联调 e2e' -File $nodeExe -StepArgs @($S_E2E) -Optional
        if (-not $r) { $ok = $false; if (-not $KeepGoing) { throw '端到端联调失败。' } }
    }
    else {
        [void]$Results.Add([pscustomobject]@{ Step = '7/7 端到端联调'; Status = 'SKIP'; Seconds = 0 })
    }
}

# ============================== 汇总 ==============================
Write-Head '执行汇总'
$total = 0.0
foreach ($r in $Results) {
    $total += $r.Seconds
    $color = switch ($r.Status) {
        'PASS'   { 'Green' }
        'FAIL'   { 'Red' }
        'SKIP'   { 'DarkGray' }
        'DRYRUN' { 'Magenta' }
        default  { 'Gray' }
    }
    Write-Host ("  {0,-24} {1,-7} {2,7}s" -f $r.Step, $r.Status, $r.Seconds) -ForegroundColor $color
}
$failed = @($Results | Where-Object { $_.Status -eq 'FAIL' }).Count
Write-Host ''
Write-Host ("  合计 {0} 步，失败 {1} 步，总耗时 {2}s" -f $Results.Count, $failed, [math]::Round($total, 2)) -ForegroundColor Cyan

if (-not $DryRun) {
    Write-Host ''
    Write-Host '  产物落点：' -ForegroundColor DarkGray
    Write-Host '    data\generated\character_stats.json   数值产物' -ForegroundColor DarkGray
    Write-Host '    data\decks.json                       卡组产物（488 名）' -ForegroundColor DarkGray
    Write-Host '    data\audit\r2-audit.md                审计报告' -ForegroundColor DarkGray
    Write-Host '    ui\battle-engine.js / achievement-system.js / settlement.js' -ForegroundColor DarkGray
    Write-Host '    data\generated\e2e\e2e-report.json            端到端联调报告' -ForegroundColor DarkGray
    Write-Host '    data\generated\e2e\battle-log-sample.jsonl    战斗日志契约落盘样例' -ForegroundColor DarkGray
}

if ($failed -gt 0 -or -not $ok) { exit 1 }
exit 0
