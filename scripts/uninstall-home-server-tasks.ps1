param([string]$TaskPrefix = "PokeDad Radar")

$ErrorActionPreference = "Stop"
@("$TaskPrefix - Startup", "$TaskPrefix - Daily Backup") | ForEach-Object {
  if (Get-ScheduledTask -TaskName $_ -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $_ -Confirm:$false
  }
}
Write-Host "PokeDad Radar scheduled tasks removed."
