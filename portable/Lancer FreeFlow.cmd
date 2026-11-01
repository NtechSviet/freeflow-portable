@echo off
setlocal EnableExtensions
rem ---------------------------------------------------------------------------
rem  Installation de FreeFlow Portable  (Windows x64) - 3 etapes
rem
rem  1) telecharger  FreeFlow-Portable-1.2.0-win-x64.7z  depuis les Releases
rem  2) extraire l'archive avec 7-Zip (clic droit > 7-Zip > Extraire vers ...)
rem  3) double-cliquer sur ce fichier : Lancer FreeFlow.cmd
rem
rem  Ce fichier ne fait rien d'autre que demarrer FreeFlow.exe qui se trouve
rem  dans le meme dossier. Le mode portable est actif parce que "portable.txt"
rem  est ici : le profil est ecrit dans .\data, pas dans %APPDATA%.
rem
rem  Aucun droit administrateur. Ne PAS lancer "en tant qu'administrateur".
rem
rem  Ctrl + Alt + Espace : dicter     Ctrl + Alt + H : panneau
rem  Premier demarrage : telechargement du modele vocal (~0,5 a 3 Go) dans
rem  .\data\models. Voyez aussi LISEZ-MOI.txt.
rem ---------------------------------------------------------------------------

rem Electron se comporte comme node.exe si cette variable existe : la vider.
set "ELECTRON_RUN_AS_NODE="

if not exist "%~dp0FreeFlow.exe" (
  echo [ERREUR] FreeFlow.exe est introuvable a cote de ce fichier :
  echo          %~dp0
  echo.
  echo Vous avez probablement lance ce fichier depuis l'archive .7z sans
  echo l'extraire. Attention : Windows peut afficher le contenu de l'archive
  echo comme un dossier ; il faut quand meme choisir
  echo    clic droit sur FreeFlow-Portable-1.2.0-win-x64.7z
  echo    ^> 7-Zip  ^>  Extraire vers "FreeFlow-Portable\"
  echo puis relancer Lancer FreeFlow.cmd depuis le dossier extrait.
  echo.
  pause
  exit /b 2
)

if not exist "%~dp0portable.txt" (
  echo [AVERTISSEMENT] portable.txt est absent : FreeFlow demarrera en mode
  echo normal et ecrira dans %%APPDATA%% au lieu de .\data.
  echo Restaurez le fichier portable.txt dans ce dossier pour le mode portable.
  echo.
)

start "" "%~dp0FreeFlow.exe"
exit /b 0
