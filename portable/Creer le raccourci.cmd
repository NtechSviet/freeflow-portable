@echo off
rem Cree "FreeFlow Portable.lnk" dans ce dossier (icone FreeFlow, dossier de
rem travail = ce dossier). Utile apres avoir telecharge l'archive : le raccourci
rem n'est pas livre avec, car il contient un chemin absolu.
setlocal
echo Creation du raccourci dans "%~dp0"...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $l = $ws.CreateShortcut((Join-Path '%~dp0' 'FreeFlow Portable.lnk')); $l.TargetPath = (Join-Path '%~dp0' 'FreeFlow.exe'); $l.WorkingDirectory = '%~dp0'; $l.IconLocation = (Join-Path '%~dp0' 'resources\app\assets\icon.ico') + ',0'; $l.Description = 'FreeFlow - version portable'; $l.Save(); Write-Host 'Raccourci cree : FreeFlow Portable.lnk'"
echo.
pause
