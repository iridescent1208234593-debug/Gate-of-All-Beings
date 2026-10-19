Option Explicit
Dim shell, files, base, python, script, q
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
base = files.GetParentFolderName(files.GetParentFolderName(WScript.ScriptFullName))
python = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe"
script = files.BuildPath(base, "server-manager.py")
q = Chr(34)
shell.CurrentDirectory = base
shell.Run q & python & q & " " & q & script & q, 1, False
