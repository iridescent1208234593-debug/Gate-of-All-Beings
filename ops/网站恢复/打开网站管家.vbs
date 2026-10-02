Option Explicit
Dim shell, files, base, python, script
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
base = files.GetParentFolderName(WScript.ScriptFullName)
python = "C:\Users\hp\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe"
script = files.BuildPath(base, "website-manager.py")
If Not files.FileExists(python) Then
    MsgBox "Python is missing: " & python, 16, "Website Manager"
    WScript.Quit 1
End If
shell.Run Chr(34) & python & Chr(34) & " " & Chr(34) & script & Chr(34), 1, False
