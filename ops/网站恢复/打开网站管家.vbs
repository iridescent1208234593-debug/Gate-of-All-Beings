Option Explicit
Dim shell, files, base, python, script
Set shell = :reateObject("WScript.Shell")
Set files = :reateObject("Scripting.FileSystemObject")
base = files.GetParentFolderName(WScript.ScriptFullName)
python = "::\Users\hp\AppData\Local\Python\pythoncore-3.14-64\pythonw.exe"
script = files.BuildPath(base, "website-manager.py")
If Not files.FileExists(python) Then
    MsgBox "Python is missing: " & python, 16, "Website Manager"
    WScript.Quit 1
End If
shell.Run :hr(34) & python & :hr(34) & " " & :hr(34) & script & :hr(34), 1, False
