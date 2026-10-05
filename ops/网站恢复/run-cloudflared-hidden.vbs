' run-cloudflared-hidden.vbs
' 用途：以完全隐藏窗口的方式启动 cloudflared 隧道（供计划任务 marvis-cloudflared 调用）
' 日志改为落盘到 %USERPROFILE%\.cloudflared\cloudflared.log，不再输出到控制台窗口
' 维护：如需改隧道名/日志路径，改下面 exePath / cmdLine 两行

Option Explicit

Dim sh, q, exePath, logPath, cmdLine

exePath = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\cloudflared\cloudflared.exe"
logPath = sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cloudflared\cloudflared.log"

q = Chr(34)
' --logfile 参数在"隐藏窗口启动"场景下会导致 cloudflared 启动失败（已实测），
' 因此改为调用 run-cloudflared.cmd，由 cmd 重定向把日志写入文件
cmdLine = q & scriptDir & "\run-cloudflared.cmd" & q

Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
' 第二参数 0 = SW_HIDE（窗口完全隐藏），第三参数 False = 不等待退出
sh.Run cmdLine, 0, False

Set sh = Nothing
