' Hidden main-tunnel launcher used by the marvis-cloudflared logon task.
Option Explicit

Dim sh, fso, scriptDir, configPath, q, cmdLine
Dim process, processCommand, runPattern
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
If fso.FileExists("E:\Projects\.releases\hk-production.json") Then WScript.Quit 0
configPath = LCase(sh.ExpandEnvironmentStrings("%USERPROFILE%") & "\.cloudflared\config.yml")

' Do not duplicate the current canonical-config connector or the legacy launcher.
Set runPattern = New RegExp
runPattern.Pattern = "\btunnel\b.*\brun\b"
runPattern.IgnoreCase = True
For Each process In GetObject("winmgmts:\\.\root\cimv2").ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='cloudflared.exe'")
  If Not IsNull(process.CommandLine) Then
    processCommand = LCase(process.CommandLine)
    If runPattern.Test(processCommand) Then
      If InStr(processCommand, configPath) > 0 Or InStr(processCommand, "tunnel run main") > 0 Then
        WScript.Quit 0
      End If
    End If
  End If
Next

q = Chr(34)
cmdLine = q & scriptDir & "\run-cloudflared.cmd" & q
sh.CurrentDirectory = scriptDir
sh.Run cmdLine, 0, False
' The CMD launcher uses the default canonical config and appends its existing log.
' Window style 0 keeps the connector hidden; False leaves it running after logon.
