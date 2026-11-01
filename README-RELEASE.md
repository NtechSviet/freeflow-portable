[puce]: # "pastilles"

---

<h3 align="center">FreeFlow Portable — Windows x64</h3>

<p align="center">
  <a href="https://github.com/NtechSviet/freeflow-portable/releases/latest/download/FreeFlow-Portable-1.2.0-win-x64.7z">
    <img alt="Télécharger l'archive FreeFlow Portable 1.2.0" src="https://img.shields.io/badge/%E2%AC%87_T%C3%A9l%C3%A9charger-FreeFlow_Portable_1.2.0_%E2%80%94_Windows_x64-2ea44f?style=for-the-badge&logo=windows&logoColor=white">
  </a>
</p>

![Licence MIT](https://img.shields.io/badge/licence-MIT-blue) ![Windows 10 et 11 x64](https://img.shields.io/badge/Windows-10_%2F_11_x64-0078D4) ![Sans installation](https://img.shields.io/badge/installation-aucune-success) ![Sans compte](https://img.shields.io/badge/compte-aucun-success) ![FreeFlow 1.2.0](https://img.shields.io/badge/FreeFlow-1.2.0-lightgrey)

**FreeFlow, mais sans installation.** Un dossier = l'application + vos réglages + le modèle vocal. On le copie, on le déplace, on le supprime. Rien n'est installé, rien n'est écrit dans `%APPDATA%`, l'administrateur n'est jamais demandé.

## 3 étapes

|  |  |
|---|---|
| **1. Télécharger** | Le bouton ci-dessus, ou `FreeFlow-Portable-1.2.0-win-x64.7z` dans la liste **Assets** au bas de cette page — 904 Mio. C'est le seul fichier nécessaire. |
| **2. Extraire** | Avec [7-Zip](https://www.7-zip.org) : clic droit sur le `.7z` → *7-Zip* → *Extraire vers « FreeFlow-Portable\ »*. **Pas** dans `C:\Program Files`. |
| **3. Lancer** | Double-clic sur `Lancer FreeFlow.cmd` dans le dossier extrait. |

Ensuite : `Ctrl+Alt+Espace` dicte, `Ctrl+Alt+H` ouvre le panneau. Au premier démarrage, le modèle `large-v3` est téléchargé dans `data\models` (~3 Go avec une carte NVIDIA, ~0,5 Go en CPU) ; après, tout fonctionne hors ligne.

## Version portable ou version officielle ?

|  | FreeFlow officiel | FreeFlow Portable (ce dépôt) |
|---|---|---|
| Installation | installateur `.exe` | **aucune**, on extrait une archive |
| Réglages et dictionnaire | `%APPDATA%\FreeFlow` | **dans le dossier**, `data\` |
| Modèle vocal | `%APPDATA%\…\models` | **dans le dossier**, `data\models\` |
| Autre PC / clé USB | à réinstaller | **copier le dossier** |
| Désinstaller | panneau *Applications* | **supprimer le dossier** |
| Version Mac | oui | non (Windows x64) |

La dictée est identique (même application, même modèle) : seul le rangement change. Mode d'emploi complet : [INSTALLER.md](https://github.com/NtechSviet/freeflow-portable/blob/main/INSTALLER.md) · dépannage : [docs/DEPANNAGE.md](https://github.com/NtechSviet/freeflow-portable/blob/main/docs/DEPANNAGE.md).

## fermer = tout arrêter

Clic droit sur l'icône de la zone de notification (près de l'horloge) → **Quitter**. Il ne doit rester aucun processus `FreeFlow` ni `freeflow-stt` ; le moteur de transcription occupe ~700 Mo et garde le port 48123. Cette version s'en charge, même si l'application est tuée brutalement. Vérification :

```powershell
Get-Process FreeFlow, freeflow-stt -ErrorAction SilentlyContinue   # aucun résultat attendu
```

## vérification de l'archive

SHA-256 (PowerShell) : `Get-FileHash .\FreeFlow-Portable-1.2.0-win-x64.7z -Algorithm SHA256`

```
a8504cee985c370357bb95a3a62881ff6cd0d99e83dd957e223c92a4cb4173b3
```

Si quelque chose coince, [ouvrez une issue](https://github.com/NtechSviet/freeflow-portable/issues) en joignant `journal-demarrage.txt` (créé par `Diagnostic.cmd`) et `data\logs\freeflow.log`.

**Licence et crédits** — FreeFlow © Alan, licence MIT : <https://github.com/AlanECE/freeflow>. Ce dépôt propose un packaging non officiel, sans lien avec l'auteur ; la version d'origine (Windows **et Mac**, avec un vrai installateur) est publiée sur [les Releases d'Alan](https://github.com/AlanECE/freeflow/releases/latest). L'emballage portable (scripts, notices, correctif) est sous licence MIT, voir [LICENSE](https://github.com/NtechSviet/freeflow-portable/blob/main/LICENSE).
