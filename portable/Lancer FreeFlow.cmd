@echo off
rem Demarre FreeFlow sans installation (le profil reste dans .\data).
rem ELECTRON_RUN_AS_NODE doit etre vide, sinon Electron se comporte comme node.exe.
set "ELECTRON_RUN_AS_NODE="
start "" "%~dp0FreeFlow.exe"
