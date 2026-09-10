$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "data\logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

$healthOk = $false
try {
  $response = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/api/health" -TimeoutSec 3
  $healthOk = $response.StatusCode -eq 200
} catch { $healthOk = $false }

if (-not $healthOk) {
  Start-Process -FilePath "npm.cmd" -ArgumentList "run", "start" -WorkingDirectory $ProjectRoot -RedirectStandardOutput (Join-Path $LogDir "app.stdout.log") -RedirectStandardError (Join-Path $LogDir "app.stderr.log") -WindowStyle Hidden
  Start-Sleep -Seconds 8
}

$Pythonw = Join-Path $ProjectRoot ".venv\Scripts\pythonw.exe"
if (-not (Test-Path -LiteralPath $Pythonw)) { throw "Ambiente Python não instalado em .venv." }
$SchedulerScript = Join-Path $ProjectRoot "automation\search_scheduler.py"
$alreadyRunning = Get-CimInstance Win32_Process -Filter "Name = 'pythonw.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine.Contains($SchedulerScript)
}
if (-not $alreadyRunning) {
  Start-Process -FilePath $Pythonw -ArgumentList $SchedulerScript -WorkingDirectory $ProjectRoot -WindowStyle Hidden
}
