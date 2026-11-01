# kill-engine.ps1 - garde-fou de sortie de FreeFlow Portable (Windows).
#
# Pourquoi : l'application arrete normalement le moteur de transcription
# (freeflow-stt.exe, ~700 Mo en memoire) en quittant. Si Electron meurt
# autrement (plantage, "Fin de tache", arret de la session), le moteur peut
# rester en vie, et la prochaine instance l'adopte silencieusement : on se
# retrouve avec des processus fantomes apres chaque essai.
#
# Nomme avec le prefixe "-" pour que PowerShell n'en fasse pas un commentaire
# (sinon : "Missing expression after unary operator '-'").
#
# Lancement par l'application, en processus detache, a la sortie :
#   powershell -NoProfile -ExecutionPolicy Bypass -File -kill-engine.ps1 `
#       -ParentPid 1234 -ParentHandle 4321 -ExeName freeflow-stt.exe -Port 48123
#
# Le script attend la disparition du processus parent (par son handle, sans
# risque de PID recycle), puis tue ce qui reste du moteur.

param(
    [Parameter(Mandatory = $true)][int]$ParentPid,
    [int]$ParentHandle = 0,
    [string]$ExeName = 'freeflow-stt.exe',
    [int]$Port = 48123,
    [int]$PortSpan = 5,
    [int]$WaitSeconds = 45
)

$ErrorActionPreference = 'SilentlyContinue'

function Get-EnginePids {
    $found = New-Object System.Collections.ArrayList

    # 1. tout binaire du moteur qui vit sous un dossier resources\ : donc lance
    #    depuis une installation ou un dossier portable, jamais un homonyme
    foreach ($p in @(Get-CimInstance Win32_Process -Filter "Name = '$ExeName'")) {
        if ($p.ExecutablePath) {
            $resources = Split-Path -Parent (Split-Path -Parent $p.ExecutablePath)
            if ((Split-Path -Leaf $resources) -eq 'resources') { [void]$found.Add([int]$p.ProcessId) }
        }
    }

    # 2. ce qui ecoute sur le bloc de ports reserve par l'application
    try {
        Get-NetTCPConnection -State Listen -ErrorAction Stop |
            Where-Object { $_.LocalPort -ge $Port -and $_.LocalPort -le ($Port + $PortSpan) } |
            ForEach-Object { if ($_.OwningProcess) { [void]$found.Add([int]$_.OwningProcess) } }
    } catch { }

    return @($found | Sort-Object -Unique | Where-Object { $_ -and $_ -ne $PID })
}

function Test-ParentAlive {
    if ($ParentHandle -gt 0) {
        # Le handle garde son identite : s'il est encore ouvert dans le systeme,
        # le processus parent n'est pas mort (un PID recycle s'y opposerait).
        try {
            $null = [System.Diagnostics.Process]::GetProcessById($ParentHandle)
            return $true
        } catch {
            return $false
        }
    }
    return [bool](Get-Process -Id $ParentPid -ErrorAction SilentlyContinue)
}

# 1. attendre la fin du parent
$deadline = (Get-Date).AddSeconds($WaitSeconds)
while ((Test-ParentAlive) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
}
if (Test-ParentAlive) { exit 0 }        # parent toujours la : rien a faire

# 2. laisser l'arret normal agir, puis tuer ce qui reste
Start-Sleep -Milliseconds 700
$left = @(Get-EnginePids)
if ($left.Count -eq 0) { exit 0 }

foreach ($p in $left) {
    & taskkill.exe /PID $p /T /F 2>&1 | Out-Null
}

# 3. trace dans le journal de l'application, si le dossier data existe encore
try {
    $root = if ($env:FREEFLOW_PORTABLE_ROOT) { $env:FREEFLOW_PORTABLE_ROOT } else { Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
    if ($root) {
        $logDir = Join-Path $root 'data\logs'
        if (Test-Path $logDir) {
            $line = '{0} [quit guard] moteur(s) restant(s) apres la sortie : {1} : arret force' -f (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ'), ($left -join ',')
            Add-Content -LiteralPath (Join-Path $logDir 'freeflow.log') -Value $line -Encoding UTF8
        }
    }
} catch { }

exit 0
