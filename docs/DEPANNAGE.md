# Dépannage

Deux pannes ont été rencontrées en vrai sur cette fabrication. Elles n'ont pas la
même cause et il ne faut pas les confondre.

---

## 1. La dictée s'affiche dans la pastille mais ne s'écrit nulle part

### Symptôme exact

- La transcription s'affiche, le chronomètre défile : la reconnaissance vocale
  fonctionne.
- Le texte n'est collé **que dans certaines applications** : la barre de recherche
  Windows, une application en WebView2, des utilitaires… mais **rien** dans le
  Bloc-notes, Chrome, Discord, une application Electron, Word.
- `data\logs\freeflow.log` contient `paste -> pasted (app=? mode=Ctrl+V)` : le
  collage est rapporté comme réussi, alors que rien n'apparaît.

### Cause

Le dossier de l'application porte l'étiquette d'intégrité Windows

```
Étiquette obligatoire\Niveau obligatoire faible:(OI)(CI)(NW)
```

et non « Niveau obligatoire moyen ». Or Windows (UIPI) interdit à un processus de
niveau **faible** d'envoyer des frappes (`SendInput`, donc le `Ctrl+V` simulé)
vers une fenêtre de niveau **moyen** — le niveau de presque toutes les
applications de bureau. Les événements sont silencieusement jetés : aucune erreur,
aucun journal. Les seules cibles qui répondent encore sont les processus de même
niveau (le menu Démarrer/`SearchHost`, certaines applications lancées en
AppContainer).

C'est le niveau du **dossier** qui contamine les processus : Windows prend le
minimum entre le jeton du lanceur et l'étiquette du fichier exécutable. Un
`cmd.exe` copié dans un tel dossier s'exécute lui aussi en « faible ».

### Vérifier

```powershell
icacls "D:\FreeFlow-Portable"
```

La dernière ligne doit être :

```
Étiquette obligatoire\Niveau obligatoire moyen:(OI)(CI)(NW)
```

Si elle indique « faible », c'est la panne. Contrôle direct du niveau du processus :

```powershell
# lancer FreeFlow, puis :
Get-Process FreeFlow | ForEach-Object { "$($_.Id) $($_.ProcessName)" }
# et vérifier le jeton du processus principal (Outils : Process Explorer, colonne Integrity)
```

`build-portable.ps1` fait déjà cette réparation ; elle est donc surtout utile si
le dossier a été copié/déplacé depuis un support qui a propagé une étiquette
faible (copie avec `robocopy /COPYALL`, extraction d'une archive créée dans un
contexte « faible », dossier lui-même hérité d'un parent étiqueté faible).

### Réparer

```powershell
icacls "D:\FreeFlow-Portable" /setintegritylevel (OI)(CI)M /T /C
```

ou, pour l'utilisateur final : double-clic sur `Reparer-Etiquettes.cmd`, puis
quitter et relancer FreeFlow. Le `/T` est indispensable : les fichiers déjà
présents gardent sinon leur ancienne étiquette héritée.

---

## 2. `FreeFlow.exe` se ferme immédiatement, sans rien afficher

### Symptôme exact

- Double-clic : un bref sursaut du curseur, aucun processus qui reste, aucun
  journal (`data\logs\freeflow.log` non créé ou inchangé).
- Un fichier `journal-demarrage.txt` produit par `Diagnostic.cmd` contient
  `Received fatal exception EXCEPTION_BREAKPOINT` et un code de sortie
  `-2147483645`, avec une pile qui passe par
  `electron::fuses::IsLoadBrowserProcessSpecificV8SnapshotEnabled` et
  `v8::ScriptCompiler::CreateCodeCacheForFunction`.

### Cause

Même racine que le point 1 : le bac à sable de Chromium n'arrive pas à
s'initialiser quand le processus démarre déjà avec un jeton « faible ». La
rustine souvent citée sur les forums — `--no-sandbox` — masque le symptôme mais
laisse le problème d'intégrité en place, donc **le collage reste cassé** dans les
applications normales, et la protection du bac à sable est perdue.

### Réparer (dans le bon ordre)

1. `Reparer-Etiquettes.cmd` (ou `icacls … /setintegritylevel (OI)(CI)M /T /C`).
2. Relancer `FreeFlow.exe` **sans** `--no-sandbox`.
3. Vérifier dans le journal : `shortcut Ctrl+Alt+Space: registered` et
   `sidecar ready {"ready":true,...}`.

`--no-sandbox` ne doit servir qu'à confirmer le diagnostic, jamais de façon
permanente.

---

## 3. « Il ne peut pas coller quand je le lance en administrateur »

Effet miroir du point 1 : Windows bloque aussi l'envoi de frappes d'un processus
**élevé** vers une fenêtre non élevée. FreeFlow n'a besoin d'aucun droit
administrateur : lancez-le normalement. Même remarque pour une application cible
elle-même élevée : elle ne recevra pas le collage.

---

## 4. Le raccourci global ne répond pas

`data\logs\freeflow.log` affiche `shortcut Ctrl+Alt+Space: FAILED`.

- Une autre instance de FreeFlow tourne déjà (l'installeur classique et la
  version portable sont deux applications distinctes pour Windows) : fermez
  l'autre.
- Ou une autre application réserve le même raccourci : changez-le dans le
  panneau (`Ctrl+Alt+H` → Réglages).

## 5. Où regarder

| Fichier | Contenu |
|---|---|
| `data\logs\freeflow.log` | démarrage, raccourcis, sidecar, transcription, collage, erreurs |
| `journal-demarrage.txt` | sortie de `Diagnostic.cmd` (messages Chromium, code de sortie) |
| `data\settings.json` | réglages courants (raccourcis, langue, `modelCache`) |

`Diagnostic.cmd` ne détache pas le processus : la fenêtre de commande reste
ouverte tant que FreeFlow tourne, et tout ce que Chromium écrit se retrouve dans
`journal-demarrage.txt`.
