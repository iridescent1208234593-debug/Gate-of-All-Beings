extends RefCounted
## Standalone Windows EXE swap; Windows must have finished closing the running image.
## The helper repeats the digest verification before an atomic swap and keeps one rollback image.

static func start_verified_swap(download: String, sha256: String) -> bool:
	if not OS.has_feature("windows") or not OS.has_feature("lab_public_release") or download != "user://updates/huiguan-next.exe":
		return false
	if sha256.length() != 64 or not FileAccess.file_exists(download):
		return false
	for byte in sha256:
		if not byte in "0123456789abcdef":
			return false
	var target := OS.get_executable_path()
	var path := ProjectSettings.globalize_path(download)
	if not target.to_lower().ends_with(".exe") or target == path:
		return false
	var system := OS.get_environment("SystemRoot")
	var exe := system.path_join("System32/WindowsPowerShell/v1.0/powershell.exe")
	if not FileAccess.file_exists(exe):
		return false
	var launch := make_helper(path, target, sha256, OS.get_process_id())
	return OS.create_process(exe, PackedStringArray(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand",
			Marshalls.raw_to_base64(launch.to_utf16_buffer())]), false) > 0


static func _ps(value: String) -> String:
	return "'" + value.replace("'", "''") + "'"


static func make_helper(src: String, dest: String, sha256: String, old_process_id: int) -> String:
	return """
$ErrorActionPreference='Stop'
$source=%s
$target=%s
$expected=%s
$gamePid=%d
$nonce=[Guid]::NewGuid().ToString('N')
$stage=$target+'.update-'+$nonce
$previous=$target+'.previous-'+$nonce
$rejected=$target+'.rejected-'+$nonce
$report=Join-Path ([IO.Path]::GetDirectoryName($source)) 'last-public-install.txt'
$swapped=$false
try {
  $owner=Get-Process -Id $gamePid -ErrorAction SilentlyContinue
  if($owner){
    if($owner.Path -ne $target){throw 'Unexpected running program'}
    if(-not $owner.WaitForExit(30000)){throw 'Running game did not close'}
  }
  $file=Get-Item -LiteralPath $target
  if($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Unexpected executable type'}
  Copy-Item -LiteralPath $source -Destination $stage
  $stream=[IO.File]::OpenRead($stage)
  try {
    $sha=[Security.Cryptography.SHA256]::Create()
    try { $actual=[BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
  } finally { $stream.Dispose() }
  if($actual -cne $expected){throw 'Installation bytes changed'}
  [IO.File]::Replace($stage,$target,$previous)
  $swapped=$true
  Start-Process -FilePath $target -WorkingDirectory ([IO.Path]::GetDirectoryName($target))
  [IO.File]::WriteAllText($report,'installed')
} catch {
  if($swapped -and (Test-Path -LiteralPath $previous -PathType Leaf)){
    [IO.File]::Replace($previous,$target,$rejected)
  }
  [IO.File]::WriteAllText($report,'update failed; previous client kept')
  if(Test-Path -LiteralPath $target -PathType Leaf){Start-Process -FilePath $target -WorkingDirectory ([IO.Path]::GetDirectoryName($target))}
} finally {
  if(Test-Path -LiteralPath $stage -PathType Leaf){Remove-Item -LiteralPath $stage}
}
""" % [_ps(src), _ps(dest), _ps(sha256), old_process_id]
