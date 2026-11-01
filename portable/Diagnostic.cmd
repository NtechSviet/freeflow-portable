@echo off
rem Demarrage "a la main" avec les journaux Chromium/Electron dans un fichier.
rem A utiliser seulement si FreeFlow ne demarre pas : ce script ne detache pas
rem le processus, donc la fenetre de commande reste ouverte tant que FreeFlow tourne.
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_ENABLE_LOGGING=1"
set "ELECTRON_ENABLE_STACK_DUMPING=1"
echo ==== %DATE% %TIME% ==== > "%~dp0journal-demarrage.txt"
echo EXE: %~dp0FreeFlow.exe >> "%~dp0journal-demarrage.txt"
"%~dp0FreeFlow.exe" >> "%~dp0journal-demarrage.txt" 2>&1
echo --- code de sortie: %ERRORLEVEL% --- >> "%~dp0journal-demarrage.txt"
type "%~dp0journal-demarrage.txt"
pause
