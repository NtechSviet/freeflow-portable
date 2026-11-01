#Requires -Version 5.1
<#
.SYNOPSIS
    Fabrique une version portable de FreeFlow a partir d'une installation existante.

.DESCRIPTION
    Copie le runtime Electron, decompile resources\app.asar en resources\app,
    applique le correctif "portable" (profil et modele vocal dans <dossier>\data),
    ajoute les lanceurs, remet l'etiquette d'integrite a "Niveau moyen" et cree
    le raccourci.

.PARAMETER Source
    Dossier de l'installation officielle de FreeFlow (contient FreeFlow.exe et
    resources\app.asar). Par defaut : %LOCALAPPDATA%\Programs\FreeFlow

.PARAMETER Destination
    Dossier a creer. Par defaut : .\FreeFlow-Portable a cote de ce script.

.PARAMETER Force
    Autorise l'ecrasement d'un dossier de destination deja present.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\build-portable.ps1 -Destination D:\FreeFlow-Portable
#>
[CmdletBinding()]
param(
    [string]$Source = (Join-Path $env:LOCALAPPDATA 'Programs\FreeFlow'),
    [string]$Destination = (Join-Path $PSScriptRoot 'FreeFlow-Portable'),
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Write-Step($message) { Write-Host "==> $message" -ForegroundColor Cyan }
function Stop-Build($message) { Write-Host "ERREUR : $message" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------- prerequisites
if (-not (Test-Path -LiteralPath $Source)) {
    Stop-Build "installation introuvable : $Source (indiquez -Source <dossier>)"
}
$Source = (Resolve-Path -LiteralPath $Source).Path

$required = @(
    'FreeFlow.exe',
    'resources\app.asar',
    'resources\freeflow-stt\freeflow-stt.exe'
)
foreach ($rel in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source $rel))) {
        Stop-Build "fichier manquant dans la source : $rel"
    }
}

if ((Test-Path -LiteralPath $Destination) -and -not $Force) {
    Stop-Build "la destination existe deja : $Destination (relancez avec -Force pour l'ecraser)"
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Stop-Build "Node.js est requis (pour extraire app.asar) : https://nodejs.org" }
$npxCmd = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npxCmd) { $npxCmd = Get-Command npx -ErrorAction SilentlyContinue }
if (-not $npxCmd) { Stop-Build "npx est requis (fourni avec Node.js)" }

# ------------------------------------------------------------------ 1. runtime
Write-Step "Copie du runtime Electron vers $Destination"
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$robocopyArgs = @(
    $Source, $Destination,
    '/E', '/COPY:DAT', '/R:2', '/W:2',
    '/XF', 'app.asar',
    '/XD', 'app.asar.unpacked',
    '/NFL', '/NDL', '/NJH', '/NJS', '/NP'
)
& robocopy @robocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) { Stop-Build "robocopy a echoue (code $LASTEXITCODE)" }

# -------------------------------------------------------------- 2. application
Write-Step 'Extraction de resources\app.asar vers resources\app'
$appDir = Join-Path $Destination 'resources\app'
if (Test-Path -LiteralPath $appDir) { Remove-Item -LiteralPath $appDir -Recurse -Force }
& $npxCmd.Source --yes '@electron/asar@3.2.10' extract (Join-Path $Source 'resources\app.asar') $appDir
if ($LASTEXITCODE -ne 0) { Stop-Build "l'extraction de app.asar a echoue (code $LASTEXITCODE)" }

$unpacked = Join-Path $Source 'resources\app.asar.unpacked'
if (Test-Path -LiteralPath $unpacked) {
    Write-Step 'Ajout des modules natifs (app.asar.unpacked)'
    Copy-Item -Path (Join-Path $unpacked '*') -Destination $appDir -Recurse -Force
}

Write-Step 'Application du correctif portable a main.js'
$mainJs = Join-Path $appDir 'main.js'
& $nodeCmd.Source (Join-Path $PSScriptRoot 'tools\patch-main.js') $mainJs
if ($LASTEXITCODE -ne 0) { Stop-Build "tools\patch-main.js a echoue (code $LASTEXITCODE)" }
& $nodeCmd.Source --check $mainJs
if ($LASTEXITCODE -ne 0) { Stop-Build 'main.js patche ne passe pas node --check' }

Write-Step "Suppression de l'archive d'origine (resources\app.asar[.unpacked])"
$staleAsar = Join-Path $Destination 'resources\app.asar'
if (Test-Path -LiteralPath $staleAsar) { Remove-Item -LiteralPath $staleAsar -Force }
if (Test-Path -LiteralPath (Join-Path $Destination 'resources\app.asar.unpacked')) {
    Remove-Item -LiteralPath (Join-Path $Destination 'resources\app.asar.unpacked') -Recurse -Force
}

# ------------------------------------------------------------ 3. fichiers portables
Write-Step 'Lanceurs, notice et marqueur portable.txt'
Copy-Item -Path (Join-Path $PSScriptRoot 'portable\*') -Destination $Destination -Force
New-Item -ItemType Directory -Force -Path (Join-Path $Destination 'data') | Out-Null

# ------------------------------------------------------------- 4. etiquettes SACL
# Un dossier portant l'etiquette "Niveau obligatoire faible" empeche Windows de
# laisser FreeFlow envoyer ses frappes (Ctrl+V) aux applications normales, et fait
# echouer le bac a sable de Chromium. On force donc "moyen", avec heritage.
Write-Step "Etiquettes d'integrite -> Niveau obligatoire moyen (heritage)"
& icacls $Destination /setintegritylevel '(OI)(CI)M' /T /C | Out-Null

# ----------------------------------------------------------------- 5. raccourci
Write-Step 'Creation du raccourci FreeFlow Portable.lnk'
$ws = New-Object -ComObject WScript.Shell
$lnkPath = Join-Path $Destination 'FreeFlow Portable.lnk'
$lnk = $ws.CreateShortcut($lnkPath)
$lnk.TargetPath = Join-Path $Destination 'FreeFlow.exe'
$lnk.Arguments = ''
$lnk.WorkingDirectory = $Destination
$lnk.IconLocation = (Join-Path $Destination 'resources\app\assets\icon.ico') + ',0'
$lnk.Description = 'FreeFlow - version portable'
$lnk.WindowStyle = 1
$lnk.Save()

# -------------------------------------------------------------------- 6. resume
$files = Get-ChildItem -LiteralPath $Destination -File -Recurse -Force -ErrorAction SilentlyContinue
$bytes = ($files | Measure-Object -Property Length -Sum).Sum
Write-Host ''
Write-Host ("Termine : {0} fichiers, {1:N2} Go" -f $files.Count, ($bytes / 1GB)) -ForegroundColor Green
Write-Host ''
Write-Host "Lancez :  $lnkPath"
Write-Host "Le modele vocal large-v3 (~4,2 Go) se telecharge au premier demarrage dans :"
Write-Host "          $Destination\data\models"
Write-Host "Pour le copier depuis une autre installation, arretez FreeFlow et copiez le"
Write-Host "dossier models (cache Hugging Face) dans data\models."
