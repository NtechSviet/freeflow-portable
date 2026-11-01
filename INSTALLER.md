# Installer FreeFlow Portable (Windows) — 3 étapes

Pas de programme d'installation à exécuter : on télécharge une archive et on
l'extrait. Comme un logiciel « zip », mais en `.7z` (le dossier fait 2,1 Go, donc
il est compressé).

> Vous ne voulez pas compiler quoi que ce soit ? Tout se passe sur cette page,
> il n'y a pas besoin de Node.js ni de PowerShell.

---

## Étape 1 — Télécharger

1. Ouvrir la page des versions :
   **<https://github.com/NtechSviet/freeflow-portable/releases/latest>**
2. Dans la section **« Assets »** (en bas de la version, il faut parfois
   dérouler « Assets »), cliquer sur :

   ```
   FreeFlow-Portable-1.2.0-win-x64.7z     (904 Mio)
   ```

   C'est le **seul** fichier à télécharger. Les liens « Source code » à côté ne
   sont pas l'application.

Le téléchargement prend quelques minutes (904 Mio).

## Étape 2 — Extraire

1. Installer **7-Zip** si Windows ne sait pas ouvrir le `.7z` :
   <https://www.7-zip.org/a/7z2408-x64.exe> (ou l'utilitaire 7-Zip de votre choix).
2. Clic droit sur `FreeFlow-Portable-1.2.0-win-x64.7z` →
   **7-Zip → Extraire vers "FreeFlow-Portable\"**.
3. Choisir un dossier **simplement accessible**, par exemple :

   ```
   C:\Users\<vous>\Desktop\FreeFlow-Portable
   ```

   Éviter `C:\Program Files` (droits administrateur) et éviter un autre disque si
   vous n'avez pas la place : il faut **2,1 Go compressé + 6,4 Go extrait** de
   libre, et **~3 Go de plus** pour le modèle vocal au premier démarrage.

L'extraction dure quelques minutes (environ 790 fichiers).

## Étape 3 — Lancer

Dans le dossier `FreeFlow-Portable`, double-cliquer sur :

- **`Lancer FreeFlow.cmd`** — marche toujours, peu importe l'emplacement, ou
- **`Creer le raccourci.cmd`** — crée `FreeFlow Portable.lnk` (icône FreeFlow)
  et le faire en premier si vous préférez les raccourcis.

Windows peut afficher **« Windows a protégé votre ordinateur »** :
« Informations complémentaires » → « Exécuter quand même ». L'archive n'est pas
signée numériquement, c'est ce que Windows signale.

Une icône apparaît dans la zone de notification (près de l'horloge) :

| Raccourci | Effet |
|---|---|
| `Ctrl + Alt + Espace` | dicter (appuyer, parler, réappuyer) |
| `Ctrl + Alt + H` | panneau : réglages, dictionnaire, historique |

**Premier démarrage : FreeFlow télécharge le modèle vocal `large-v3`**
(~3 Go avec une carte NVIDIA, ~0,5 Go en CPU). Il y a un affichage de progression ;
laisser tourner. Ensuite, tout fonctionne hors ligne — le modèle est dans
`data\models` et suit le dossier.

---

## Vérifier que c'est la version portable

Le mode portable est actif parce que le fichier `portable.txt` est à côté de
`FreeFlow.exe`. Le profil va dans **`FreeFlow-Portable\data\`**, pas dans
`C:\Users\<vous>\AppData\`.

Après un premier lancement, vous devez voir :

```
FreeFlow-Portable\
├─ FreeFlow.exe
├─ Lancer FreeFlow.cmd
├─ portable.txt          <-- marqueur du mode portable
└─ data\
   ├─ settings.json      <-- vos réglages
   ├─ logs\freeflow.log  <-- journal (démarrage, raccourcis, collage)
   └─ models\            <-- modèle large-v3 téléchargé ici
```

Si `data\` n'apparaît pas, c'est que FreeFlow n'a pas démarré : voir
[Dépannage](#si-ça-ne-marche-pas).

---

## Déplacer le dossier plus tard

Fermer FreeFlow (icône de la zone de notification → Quitter), déplacer le dossier
entier, relancer `Lancer FreeFlow.cmd`. Tout suit : réglages, dictionnaire,
historique, modèle vocal. Si vous utilisiez le raccourci `.lnk`, supprimez-le et
relancez `Creer le raccourci.cmd` : il contient un chemin absolu.

---

## Désinstaller

Fermer FreeFlow, supprimer le dossier `FreeFlow-Portable`. C'est tout : rien
n'est écrit ailleurs (aucune entrée de registre, aucun fichier dans
`%APPDATA%`, aucun lancement au démarrage).

---

## Si ça ne marche pas

| Symptôme | Que faire |
|---|---|
| **Le texte s'affiche dans la pastille mais ne s'écrit dans aucune application** (Bloc-notes, Chrome, Word, Discord…) | Double-cliquer sur **`Reparer-Etiquettes.cmd`**, puis quitter et relancer FreeFlow. Cause : Windows (UIPI) interdit à un programme d'étiquette « faible » de simuler un `Ctrl+V` vers une application normale. L'archive livrée est déjà réparée ; ce script sert si le dossier a été recopié depuis un support qui a propagé une étiquette faible. |
| Rien ne se passe au double-clic | Double-cliquer sur **`Diagnostic.cmd`** : il écrit `journal-demarrage.txt` (messages Chromium + code de sortie). |
| Le texte est collé mais sans accents / mal découpé | Panneau `Ctrl+Alt+H` → Réglages → langue et modèle. |
| Le raccourci global ne répond pas | Une autre instance de FreeFlow tourne (une installation classique et la version portable sont deux applications distinctes pour Windows) : la fermer. |
| Windows demande un mot de passe administrateur | Vous avez lancé depuis `C:\Program Files` : déplacer le dossier. |
| Le collage ne marche que si FreeFlow est lancé normalement | **Ne jamais** lancer FreeFlow « en tant qu'administrateur » : Windows interdit aussi les frappes d'un programme élevé vers une fenêtre normale. |

Le détail technique (cause, vérification, réparation) est dans
[docs/DEPANNAGE.md](docs/DEPANNAGE.md).

---

## Vous préférez compiler vous-même ?

Le dépôt contient aussi la recette reproductible : partir de l'installation
officielle de FreeFlow 1.2.0 et la transformer en version portable en une
commande PowerShell (`build-portable.ps1`). Voir le [README](README.md).
