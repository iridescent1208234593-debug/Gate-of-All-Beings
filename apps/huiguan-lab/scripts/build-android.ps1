# 构建 LAB Android 客户端 APK。
#
# 为什么需要这个脚本：export_presets.cfg 里 package/signed=true，但**不含**
# keystore 路径与口令（密钥不落库，这是有意为之）。直接 --export-release 会报
# 「找不到发布密钥库」。这个脚本的做法是：
#   1. 备份 export_presets.cfg
#   2. 临时注入签名参数
#   3. 执行导出
#   4. 无论成功失败都还原备份
# 这样密钥只在构建期短暂存在于工作区，不会进 Git。
#
# 用法：
#   .\build-android.ps1 -Keystore "E:\keys\lab.jks" -StorePass "***" -Alias "labalias"
#   .\build-android.ps1                      # 不传签名参数 = 出未签名包，仅用于本地调试
#
# 环境要求：Godot 4.7.2（与 client/project.godot 的 features 对齐）、JDK 17+、Android SDK。

param(
    [string]$Keystore = "",
    [string]$StorePass = "",
    [string]$Alias = "",
    [string]$OutFile = "",
    [string]$Godot = "",
    [string]$PresetName = ""
)

$ErrorActionPreference = 'Stop'

$Lab = Split-Path -Parent $PSScriptRoot
$Client = Join-Path $Lab 'client'
$Preset = Join-Path $Client 'export_presets.cfg'
$Backup = "$Preset.build-backup"

if (-not $Godot) {
    $Godot = if ($env:LAB_GODOT) { $env:LAB_GODOT } else { Join-Path (Split-Path -Parent $Lab) 'Godot\Godot_v4.7.2-stable_win64_console.exe' }
}
if (-not (Test-Path $Godot)) {
    throw "找不到 Godot 4.7.2：$Godot`n请下载后放到该路径，或用 `$env:LAB_GODOT 指定，或用 -Godot 传入。"
}
if (-not $env:JAVA_HOME) { throw '未设置 JAVA_HOME（导出 Gradle 构建需要 JDK 17+）' }
if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) { throw '未设置 ANDROID_HOME（需要 Android SDK）' }

if (-not $OutFile) {
    $OutFile = Join-Path $Lab 'build\android-gradle\Huiguan-Lab.apk'
}
$outDir = Split-Path $OutFile -Parent
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }

# ---------------------------------------------------------------------------
# Godot 引擎库（godot-lib.template_*.aar，约 100 MB 各一份）不在版本控制里。
# 干净检出直接构建会在 compileStandardReleaseJavaWithJavac 阶段失败：
#   GodotApp.java: 方法不会覆盖或实现超类型的方法
# 因为 GodotActivity 等基类来自那个 aar。首次构建必须先「安装 Android 构建
# 模板」，把模板包里的 libs/ 解到 client/android/build/libs/。
# 这里做前置检查，缺了就从导出模板里自动补，避免每次都要手工处理。
# ---------------------------------------------------------------------------
$Libs = Join-Path $Client 'android\build\libs'
$ReleaseAar = Join-Path $Libs 'release\godot-lib.template_release.aar'
if (-not (Test-Path $ReleaseAar)) {
    Write-Host '== 缺少 godot-lib aar，尝试从导出模板补装'
    $tplDir = Join-Path $env:APPDATA 'Godot\export_templates\4.7.2.stable'
    $srcZip = Join-Path $tplDir 'android_source.zip'
    if (-not (Test-Path $srcZip)) {
        throw @"
缺少 Godot 引擎库，且找不到导出模板：
  $srcZip
请先在 Godot 里「编辑器 → 管理导出模板 → 下载并安装」，或用 -TemplateZip 指定 android_source.zip。
"@
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($srcZip)
    try {
        $wanted = $zip.Entries | Where-Object { $_.FullName -match '^libs/.*\.aar$' }
        if (-not $wanted) { throw "模板包里没有 libs/*.aar：$srcZip" }
        foreach ($e in $wanted) {
            $dstPath = Join-Path (Join-Path $Client 'android\build') ($e.FullName -replace '/', '\')
            New-Item -ItemType Directory -Force (Split-Path $dstPath -Parent) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $dstPath, $true)
            Write-Host ("   " + $e.FullName + "  " + [math]::Round($e.Length / 1MB, 1) + " MB")
        }
    }
    finally { $zip.Dispose() }
    Write-Host '== 引擎库已补齐'
}

# 版本号从预设里读出来，避免脚本与预设各写一份
$presetText = Get-Content $Preset -Raw
$verCode = [regex]::Match($presetText, '(?m)^version/code=(\d+)').Groups[1].Value
$verName = [regex]::Match($presetText, '(?m)^version/name="([^"]*)"').Groups[1].Value
Write-Host "== 版本 $verName（versionCode $verCode）"

# 预设名会随仓库演进变动（曾经叫 "Android Preview"，后来改成 "Android"），
# 默认按顺序找一个存在的 Android 预设，避免硬编码。
if (-not $PresetName) {
    foreach ($cand in @('Android', 'Android Preview')) {
        if ($presetText -match "(?m)^name=`"$([regex]::Escape($cand))`"\s*$") {
            # 确认它属于 platform="Android" 的那一段
            $PresetName = $cand
            break
        }
    }
}
if (-not $PresetName) { throw "在 $Preset 里找不到 Android 预设，请用 -PresetName 指定。" }
Write-Host "== 使用预设：$PresetName"

Copy-Item $Preset $Backup -Force
try {
    if ($Keystore) {
        if (-not (Test-Path $Keystore)) { throw "找不到密钥库：$Keystore" }
        if (-not $StorePass) { throw '传了 -Keystore 就必须同时给 -StorePass' }
        if (-not $Alias) { throw '传了 -Keystore 就必须同时给 -Alias' }
        # 路径统一成正斜杠，Godot 的 cfg 解析不接受反斜杠转义
        $ksPath = $Keystore -replace '\\', '/'
        # 必须插进目标预设自己的 [preset.N.options] 段，不能追加到文件末尾——
        # 预设现在有多个，追加会落进最后一个预设，签名参数就丢了。
        $raw = Get-Content $Preset -Raw
        $idx = [regex]::Match($raw, "(?m)^name=`"$([regex]::Escape($PresetName))`"\s*$").Index
        if ($idx -lt 0) { throw "在预设文件里定位不到 name=`"$PresetName`"" }
        # 从该 name 之后找最近的 [preset.N.options] 段尾（下一个 [preset. 或文件末）
        $tail = $raw.Substring($idx)
        $nextPreset = [regex]::Match($tail, '(?m)^\[preset\.\d+\]')
        $blockEnd = if ($nextPreset.Success) { $idx + $nextPreset.Index } else { $raw.Length }
        $head = $raw.Substring(0, $blockEnd).TrimEnd()
        $rest = $raw.Substring($blockEnd)
        $inject = @"

keystore/release="$ksPath"
keystore/release_user="$Alias"
keystore/release_password="$StorePass"


"@
        $merged = $head + $inject.TrimEnd() + "`n"
        if ($rest) { $merged += "`n" + $rest.TrimStart() }
        Set-Content -Path $Preset -Value $merged -Encoding UTF8 -NoNewline
        Write-Host '== 已注入签名参数（构建后自动还原预设）'
    } else {
        Write-Warning '未传签名参数：本次产出为未签名包，只能本地调试，不能分发。'
    }

    Write-Host "== 导入资源"
    & $Godot --headless --path $Client --import 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw '资源导入失败' }

    Write-Host "== 导出 APK"
    Write-Host "== 导出 APK（预设：$PresetName）"
    & $Godot --headless --path $Client --export-release $PresetName $OutFile 2>&1 |
        ForEach-Object { if ($_ -match 'ERROR|WARNING|DONE') { Write-Host "   $_" } }
    $code = $LASTEXITCODE

    if (-not (Test-Path $OutFile)) { throw "导出失败（exit $code）：产物不存在" }
    $size = (Get-Item $OutFile).Length
    Write-Host ''
    Write-Host "== 完成"
    Write-Host "   文件    ：$OutFile"
    Write-Host "   大小    ：$([math]::Round($size / 1MB, 2)) MB（$size 字节）"
    Write-Host "   SHA-256 ：$((Get-FileHash $OutFile -Algorithm SHA256).Hash.ToLower())"
    Write-Host ''
    Write-Host '   发 OTA 时把上面的大小与 SHA-256 填进 version.json，两个都必须与 APK 完全一致。'
}
finally {
    if (Test-Path $Backup) {
        Move-Item $Backup $Preset -Force
        Write-Host '== 已还原 export_presets.cfg（签名参数未落盘）'
    }
}
