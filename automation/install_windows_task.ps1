$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$StartupScript = Join-Path $PSScriptRoot "start_at_logon.ps1"
$TaskName = "Carreira - Busca Automatica de Vagas"
$CurrentUser = "$env:USERDOMAIN\$env:USERNAME"

$action = New-ScheduledTaskAction `
  -Execute (Get-Command powershell.exe).Source `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$StartupScript`"" `
  -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser
$principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Description "Inicia o painel local e busca alertas oficiais de vagas a cada duas horas." `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Output "Tarefa '$TaskName' instalada e iniciada para $CurrentUser."
