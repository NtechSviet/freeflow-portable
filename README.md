# FreeFlow Portable (Windows)

FreeFlow dans un **dossier autonome, sans installation** : le programme, votre
profil (réglages, dictionnaire, historique, réunions) et le modèle vocal vivent
dans un seul dossier déplaçable. Rien dans `%APPDATA%`, rien dans le registre.

> ### ⬇ [Télécharger FreeFlow Portable 1.2.0 (Windows x64, 904 Mio)](https://github.com/NtechSviet/freeflow-portable/releases/latest)
>
> Archive `.7z` → extraire → double-clic sur `Lancer FreeFlow.cmd`.
> Guide pas à pas (télécharger, extraire, lancer, désinstaller) :
> **[INSTALLER.md](INSTALLER.md)**.

## Installation en 3 étapes

1. **Télécharger** `FreeFlow-Portable-1.2.0-win-x64.7z` dans les
   [Releases](https://github.com/NtechSviet/freeflow-portable/releases/latest)
   (section « Assets »).
2. **Extraire** avec [7-Zip](https://www.7-zip.org) : clic droit → 7-Zip →
   *Extraire vers « FreeFlow-Portable\ »*. Ne pas extraire dans `C:\Program Files`.
3. **Lancer** `Lancer FreeFlow.cmd` (ou `Creer le raccourci.cmd` pour une icône).
   `Ctrl+Alt+Espace` dicte, `Ctrl+Alt+H` ouvre le panneau.

Au premier démarrage, FreeFlow télécharge le modèle `large-v3` (~3 Go avec GPU
NVIDIA, ~0,5 Go en CPU) dans `data\models` ; ensuite tout fonctionne hors ligne.
Le détail (place disque, déplacement du dossier, désinstallation, dépannage) est
dans **[INSTALLER.md](INSTALLER.md)**.

Contenu de l'archive :

```
Lancer FreeFlow.cmd        lanceur (fonctionne tel quel, quel que soit l'emplacement)
Creer le raccourci.cmd     crée "FreeFlow Portable.lnk" (icône FreeFlow)
Diagnostic.cmd             démarrage manuel + journal complet si ça ne part pas
Reparer-Etiquettes.cmd     répare l'étiquette d'intégrité du dossier (voir Dépannage)
LISEZ-MOI.txt              la même notice, lisible sans éditeur
portable.txt               marqueur qui active le mode portable
FreeFlow.exe, resources\   l'application
data\                      votre profil + data\models\ (créé au 1er lancement)
```

---

## Ce dépôt contient aussi le kit de fabrication

Le dépôt Git ne contient pas les binaires (GitHub refuse les fichiers de plus de
100 Mo) : il contient les scripts, le correctif et la notice, plus l'archive
publiée en Release. Pour reproduire soi-même le dossier depuis l'installation
officielle, suivre la section suivante.

## Prérequis pour compiler soi-même

- Windows 10/11 x64
- [Node.js](https://nodejs.org) 18+ (fournit `node`, `npx`)
- FreeFlow **1.2.0** installé une fois (l'installeur officiel sert de source) —
  `%LOCALAPPDATA%\Programs\FreeFlow` par défaut
- ~7 Go d'espace libre à destination

## Compiler

```powershell
git clone https://github.com/<vous>/freeflow-portable.git
cd freeflow-portable

# source = installation officielle ; destination = dossier portable à créer
powershell -ExecutionPolicy Bypass -File .\build-portable.ps1 -Destination "D:\FreeFlow-Portable"
```

Le script enchaîne :

1. copie du runtime Electron (hors `resources\app.asar`) ;
2. extraction de `resources\app.asar` → `resources\app` (`@electron/asar`) ;
3. fusion de `resources\app.asar.unpacked` (modules natifs `uiohook-napi`) ;
4. correctif `tools\patch-main.js` : `userData` → `<dossier>\data`, `modelCache`
   → `<dossier>\data\models`, puis `node --check` ;
5. suppression de l'archive d'origine (FreeFlow charge `resources\app\` s'il
   existe) ;
6. copie des lanceurs, de `portable.txt`, création de `data\` ;
7. **remise des étiquettes d'intégrité à « Niveau moyen »** (indispensable, voir
   [docs/DEPANNAGE.md](docs/DEPANNAGE.md)) ;
8. création du raccourci `FreeFlow Portable.lnk`.

L'archive publiée en Release est fabriquée exactement de cette façon, puis
extraite sans `data\` ni `.lnk` (chemin absolu) :

```powershell
7z a -t7z -mx=7 -md=128m -mfb=128 -ms=on -mmt=on FreeFlow-Portable-1.2.0-win-x64.7z .\*
```

## Ce qui n'est pas dans Git (et pourquoi)

La version portable complète pèse **6,26 Go** :

| Élément | Taille | GitHub |
|---|---|---|
| `data\models\` (large-v3) | 4,13 Go | dépasse la limite de **2 Go par fichier joint** |
| `resources\freeflow-stt\` (moteur faster-whisper/CUDA) | ~1,5 Go | idem |
| `FreeFlow.exe` | 247 Mo | idem |

C'est pour cela que l'archive livrée fait 904 Mio : elle s'arrête au modèle, que
FreeFlow télécharge lui-même au premier démarrage — exactement comme
l'installeur officiel de l'auteur. GitHub accepte, en pièce jointe d'une Release,
un fichier de 904 Mio mais pas de 4,13 Go.

## Le correctif, en clair

`resources\app\main.js` ne connaît pas le mode portable : Electron écrit dans
`%APPDATA%`. Le patch ajoute, juste après le `require('child_process')` :

```js
var __FF_PORTABLE__ = null;
try {
  var __ffExeDir = path.dirname(process.execPath);
  if (['portable.txt', 'data', 'FreeFlow Portable'].some(function (n) {
        return fs.existsSync(path.join(__ffExeDir, n));
      })) {
    __FF_PORTABLE__ = __ffExeDir;
    try { fs.mkdirSync(path.join(__ffExeDir, 'data'), { recursive: true }); } catch (e0) { }
    app.setPath('userData', path.join(__ffExeDir, 'data'));
  }
} catch (e1) { __FF_PORTABLE__ = null; }
```

et redirige la valeur par défaut de `modelCache` vers `<dossier>\data\models`.
`fs.mkdirSync` est nécessaire : `app.setPath('userData', …)` lève une exception si
le dossier n'existe pas, et l'application reste alors bloquée sur une boîte de
dialogue sans écrire de journal.

## Dépannage

Le piège principal n'est pas le patch mais **l'étiquette d'intégrité du dossier**.
Symptômes, diagnostic et réparation : [docs/DEPANNAGE.md](docs/DEPANNAGE.md).

En résumé : si la dictée s'affiche mais ne s'écrit pas dans les autres
applications (Bloc-notes, Chrome/Electron, Word…), ou si l'application se ferme
immédiatement au démarrage, exécutez `Reparer-Etiquettes.cmd` puis relancez.

## Versions testées

| Élément | Version |
|---|---|
| FreeFlow | 1.2.0 |
| Electron | 44.9.0 (Chromium 44, Node 24.22.0) |
| Modèle | `large-v3` (faster-whisper / CTranslate2, CUDA + CPU) |
| `@electron/asar` | 3.2.10 |

Une version ultérieure de FreeFlow peut déplacer l'ancre du patch :
`tools/patch-main.js` échoue alors avec un code explicite plutôt que d'écrire un
fichier douteux. Le correctif produit ici a été vérifié **octet pour octet**
(`main.js` : 93 611 octets, SHA-256 `54c8e9d2…318edd`).

## Licence et crédits

- FreeFlow : © Alan — <https://github.com/AlanECE/freeflow> (licence MIT). Ce
  dépôt n'est pas affilié à l'auteur. L'archive d'une Release redistribue
  l'application et son moteur ; garder `LICENSE`, `LICENSES.chromium.html` et
  `THIRD_PARTY_NOTICES.md` d'origine, et voir la licence de FreeFlow.
- Scripts, notice et correctif de ce dépôt : MIT, voir [LICENSE](LICENSE).
