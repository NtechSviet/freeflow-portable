@echo off
rem ===================================================================
rem  Repare l'etiquette d'integrite du dossier (Niveau obligatoire moyen)
rem ===================================================================
rem  A lancer UNIQUEMENT si la dictee s'affiche dans la pastille mais que
rem  le texte ne s'ecrit pas dans les autres applications (Word, Notepad,
rem  Chrome, Discord, Electron...).
rem
rem  Cause : si le dossier porte l'etiquette "Niveau obligatoire faible"
rem  (Low), Windows interdit a FreeFlow d'envoyer ses frappes aux autres
rem  applications. Le symptome est trompeur : la transcription s'affiche,
rem  mais rien n'est colle. Revenir a "Niveau moyen" corrige cela.
rem ===================================================================
setlocal
echo.
echo Etiquette actuelle du dossier :
icacls "%~dp0."
echo.
echo Application de l'etiquette "Niveau obligatoire moyen" a tout le dossier...
icacls "%~dp0." /setintegritylevel (OI)(CI)M /T /C
echo.
echo Nouvelle etiquette :
icacls "%~dp0."
echo.
echo Termine. Fermez puis relancez FreeFlow (Ctrl+Alt+H - quitter, ou
echo clic droit sur l'icone de la zone de notification).
pause
