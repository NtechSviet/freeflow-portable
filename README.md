# FreeFlow Portable (Windows)

Fabrique un dossier **FreeFlow autonome, sans installation** : le programme, son
profil (réglages, dictionnaire, historique, réunions) et le modèle vocal vivent
dans un seul dossier déplaçable. Aucun fichier n'est écrit dans `%APPDATA%`.

Ce dépôt contient **le kit de fabrication** (scripts + correctif + notice), pas
les binaires — voir « Ce qui n'est pas ici » plus bas.

**Version prête à l'emploi** : l'archive du dossier portable (Windows x64, sans le
modèle vocal, qui se télécharge au premier démarrage) est publiée dans les
[Releases](https://github.com/NtechSviet/freeflow-portable/releases/latest).

```
FreeFlow Portable.lnk      lanceur (icône FreeFlow)
Lancer FreeFlow.cmd        lanceur texte (même chose, sans raccourci)
Creer le raccourci.cmd     recrée le raccourci si le dossier a été déplacé
Diagnostic.cmd             démarrage manuel + journal complet si ça ne part pas
Reparer-Etiquettes.cmd     répare l'étiquette d'intégrité du dossier (voir Dépannage)
LISEZ-MOI.txt              notice pour l'utilisateur final
portable.txt               marqueur qui active le mode portable
data\                      profil + data\models\ (modèle large-v3)
```

## Ce qui n'est pas ici (et pourquoi)

La version portable d'origine pèse **6,26 Go** :

| Élément | Taille | GitHub |
|---|---|---|
| `resources\freeflow-stt\` (moteur faster-whisper/CUDA) | ~1,5 Go | dépasse la limite de 100 Mo **par fichier** |
| `data\models\` (large-v3) | 4,13 Go | idem |
| `FreeFlow.exe` | 247 Mo | idem |

GitHub refuse tout fichier de plus de 100 Mo (et un dépôt au-delà de ~1 Go devient
inutilisable). Le modèle est de toute façon téléchargé automatiquement au premier
démarrage. Ce dépôt fournit donc **la recette reproductible** : on part de
l'installation officielle (MIT) et on la transforme en version portable en une
commande. Résultat identique, quelques minutes de calcul et un `git clone` de
quelques kilo-octets.

## Prérequis

- Windows 10/11 x64
- [Node.js](https://nodejs.org) 18+ (fournit `node`, `npx`)
- FreeFlow **1.2.0** installé une fois (l'installeur officiel sert de source) —
  `%LOCALAPPDATA%\Programs\FreeFlow` par défaut
- ~7 Go d'espace libre à destination

## Utilisation

```powershell
git clone https://github.com/<vous>/freeflow-portable.git
cd freeflow-portable

# source = installation officielle ; destination = dossier portable à créer
powershell -ExecutionPolicy Bypass -File .\build-portable.ps1 `
    -Destination "D:\FreeFlow-Portable"
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

Puis : double-clic sur `FreeFlow Portable.lnk`. `Ctrl+Alt+Espace` dicte,
`Ctrl+Alt+H` ouvre le panneau.

### Déplacer / réinstaller

Le dossier est autonome : coupez FreeFlow, déplacez-le, relancez le raccourci
(recréez-le si le chemin change : `Lancer FreeFlow.cmd` utilise `%~dp0` et suit
le dossier tout seul).

### Le modèle vocal

Au premier démarrage, FreeFlow télécharge `large-v3` (~4,2 Go) dans
`data\models` (cache Hugging Face). Pour éviter le téléchargement, copiez le
dossier `models` d'une autre installation, application fermée.

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
  dépôt n'est pas affilié à l'auteur ; il ne redistribue aucun binaire.
- Scripts, notice et correctif de ce dépôt : MIT, voir [LICENSE](LICENSE).
- Le dossier produit conserve `LICENSE`, `LICENSES.chromium.html` et
  `THIRD_PARTY_NOTICES.md` d'origine : ne les supprimez pas si vous redistribuez.
