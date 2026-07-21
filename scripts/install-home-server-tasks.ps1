param(
  [string]$BackupTime = "03:00",
  [string]$TaskPrefix = "PokeDad Radar"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$powerShell = (Get-Command powershell.exe).Source

function New-ScriptAction([string]$ScriptName) {
  $path = Join-Path $PSScriptRoot $ScriptName
  return New-ScheduledTaskAction -Execute $powerShell -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$path`""
}

$startupName = "$TaskPrefix - Startup"
$backupName = "$TaskPrefix - Daily Backup"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2) -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdministrator) {
  Register-ScheduledTask -TaskName $startupName -Action (New-ScriptAction "ngrok-home-server-recover.ps1") -Trigger (New-ScheduledTaskTrigger -AtStartup) -Settings $settings -RunLevel Highest -Force -ErrorAction Stop | Out-Null
  Register-ScheduledTask -TaskName $backupName -Action (New-ScriptAction "ngrok-home-server-backup.ps1") -Trigger (New-ScheduledTaskTrigger -Daily -At $BackupTime) -Settings $settings -RunLevel Highest -Force -ErrorAction Stop | Out-Null
  Write-Host "Installed elevated startup recovery and daily backup tasks."
} else {
  $currentUser = $identity.Name
  Register-ScheduledTask -TaskName $startupName -Action (New-ScriptAction "ngrok-home-server-recover.ps1") -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $currentUser) -Settings $settings -User $currentUser -RunLevel Limited -Force -ErrorAction Stop | Out-Null
  Register-ScheduledTask -TaskName $backupName -Action (New-ScriptAction "ngrok-home-server-backup.ps1") -Trigger (New-ScheduledTaskTrigger -Daily -At $BackupTime) -Settings $settings -User $currentUser -RunLevel Limited -Force -ErrorAction Stop | Out-Null
  Write-Host "Installed per-user logon recovery and daily backup tasks."
}

Write-Host "No secret values were displayed."
