'use strict';
// Genere tools/patch-quit.js a partir du build portable qui fonctionne.
//
//   node tools/build-patch-quit.js <dossier>\resources\app
//
// La methode stopAll() et le bloc de sortie sont repris tels quels du fichier
// reel (version CRLF) : le kit produit donc exactement ce qui a ete teste.

const fs = require('fs');
const path = require('path');

const appDir = process.argv[2];
if (!appDir) {
  console.error('usage: node build-patch-quit.js <.../resources/app>');
  process.exit(1);
}

const sidecarSrc = fs.readFileSync(path.join(appDir, 'lib', 'sidecar.js'), 'utf8');
const mainSrc = fs.readFileSync(path.join(appDir, 'main.js'), 'utf8');

// --- 1. stopAll (commentaire inclus), en CRLF comme dans le build ------------
const SIDE_START = '/**\n   * Windows: the engine is not always ours.';
const ASYNC_STOP = '\n  async stop() {';
const i0 = sidecarSrc.indexOf(SIDE_START);
const i1 = sidecarSrc.indexOf(ASYNC_STOP, i0);
if (i0 < 0 || i1 < 0) {
  console.error('sidecar: stopAll block not found');
  process.exit(1);
}
const stopAllText = sidecarSrc.slice(i0, i1).replace(/[\r\n]+$/, '');

// --- 2. bloc de sortie de main.js --------------------------------------------
const G_START = '// Last line of defence:';
const G_END = "process.on('uncaughtException'";
const g0 = mainSrc.indexOf(G_START);
if (g0 < 0) { console.error('main: guard block not found'); process.exit(1); }
const g1 = mainSrc.indexOf("\n\napp.whenReady()", g0);   // le bloc s'arrete avant le demarrage
if (g1 < 0) { console.error('main: guard block end not found'); process.exit(1); }
// La ligne before-quit existait deja dans le fichier : elle ne fait pas partie du
// bloc a ajouter (sinon elle serait dupliquee).
const BEFORE_QUIT = "app.on('before-quit', (e) => { if (!quitting) { e.preventDefault(); quitApp(); } });";
const guardText = mainSrc.slice(g0, g1).replace(/[\r\n]+$/, '')
  .split('\n')
  .filter((l) => l.trim() !== BEFORE_QUIT)
  .join('\n')
  .replace(/[\r\n]+$/, '');

const stopAllJs = JSON.stringify(stopAllText);
const guardJs = JSON.stringify(guardText);

const out = `'use strict';
// Ajoute "aucun moteur fantome" a un build FreeFlow portable, sur place.
//
//   node tools/patch-quit.js <chemin>\\resources\\app
//
// FreeFlow arrete son moteur a l'arret normal, mais sous Windows le moteur
// survit a toute sortie anormale (plantage, fenetre tuee, console fermee,
// arret de session). Le moteur de ce build refuse /shutdown sans son jeton, et
// Windows protege la variable qui le contient contre la lecture par un autre
// processus : l'arret propre est hors de portee, on tue donc. Trois couches :
//
//   1. lib/sidecar.js -> stopAll() : notre arbre, ce qui ecoute sur le bloc de
//      ports, et tout binaire du moteur sous <dossier>\\resources\\ ;
//   2. main.js -> quitApp() appelle stopAll() au lieu de stop() ;
//   3. lib/-kill-engine.ps1 + garde-fou detache a la sortie : meme quand plus
//      aucune de nos lignes ne s'execute, le moteur est arrete.
//
// GENERE par tools/build-patch-quit.js depuis le build teste (stopAll et bloc
// de sortie repris tels quels).
//
// Idempotent. Codes de sortie : 0 ok/deja patche, 2 usage, 3 ancre absente,
// 4 auto-controle echoue (rien ecrit), 5 ecriture impossible.

const fs = require('fs');
const path = require('path');

const appDir = process.argv[2];
if (!appDir) {
  console.error('usage: node patch-quit.js <.../resources/app>');
  process.exit(2);
}

const sidecarPath = path.join(appDir, 'lib', 'sidecar.js');
const mainPath = path.join(appDir, 'main.js');

function read(p, what) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) {
    console.error('cannot read ' + what + ': ' + e.message);
    process.exit(5);
  }
}

let sidecar = read(sidecarPath, 'lib/sidecar.js');
let main = read(mainPath, 'main.js');

if (sidecar.indexOf('async stopAll()') !== -1 && main.indexOf('sidecar.stopAll()') !== -1) {
  console.log('already patched: quit/engine cleanup');
  process.exit(0);
}

// Repris tel quel du build teste (CRLF).
const STOPALL = ${stopAllJs};
// Meme chose pour la garde de sortie.
const GUARD = ${guardJs};

// --- 1. lib/sidecar.js --------------------------------------------------------
if (sidecar.indexOf('async stopAll()') === -1) {
  const memAnchor = '    this.child = null;';
  if (sidecar.indexOf(memAnchor) === -1) {
    console.error('sidecar anchor (this.child = null) not found');
    process.exit(3);
  }
  sidecar = sidecar.replace(memAnchor,
    '    this.child = null;\\n    this._port0 = this.port;     // port requested by the app (stopAll walks the range)');

  const stopAnchor = /\\n  async stop\\(\\) \\{/;
  if (!stopAnchor.test(sidecar)) {
    console.error('sidecar anchor (async stop) not found');
    process.exit(3);
  }
  // m = "\\n  async stop() {": le bloc arrive sans son retrait initial
  sidecar = sidecar.replace(stopAnchor, (m) => '\\n  ' + STOPALL + m);

  if (sidecar.indexOf('this.killed || this.external || !this.child') === -1) {
    const old = '    if (this.external || !this.child) return;';
    if (sidecar.indexOf(old) === -1) {
      console.error('sidecar anchor (external child check) not found');
      process.exit(3);
    }
    sidecar = sidecar.replace(old,
      '    // Our own engine was killed hard by stopAll(): the process already answers\\n'
      + '    // to nobody, so stop() only has its bookkeeping to do.\\n'
      + '    if (this.killed || this.external || !this.child) return;');
  }
}

// --- 2. main.js ---------------------------------------------------------------
if (main.indexOf('sidecar.stopAll()') === -1) {
  if (main.indexOf("const { execFile } = require('child_process');") !== -1) {
    main = main.replace("const { execFile } = require('child_process');",
      "const { execFile, spawn } = require('child_process');");
  }
  const quitAnchor = '  if (sidecar) await sidecar.stop();';
  if (main.indexOf(quitAnchor) === -1) {
    console.error('main anchor (sidecar.stop on quit) not found');
    process.exit(3);
  }
  main = main.replace(quitAnchor, [
    '  if (sidecar) {',
    "    try { await sidecar.stopAll(); } catch (e) { log('sidecar stopAll:', e.message); }",
    '  }',
  ].join('\\n'));

  const anchor = "app.on('window-all-closed', () => { /* keep running in the tray */ });";
  if (main.indexOf(anchor) === -1) {
    console.error('main anchor (window-all-closed) not found');
    process.exit(3);
  }
  main = main.replace(anchor, anchor + '\\n' + GUARD);
}

// --- auto-controle, puis ecriture ---------------------------------------------
for (const [name, text, needles] of [
  ['sidecar.js', sidecar, ['async stopAll()', 'this.killed || this.external']],
  ['main.js', main, ['sidecar.stopAll()', 'function guardEngine()', '-kill-engine.ps1']],
]) {
  for (const n of needles) {
    if (text.indexOf(n) === -1) {
      console.error(name + ': self-check failed on "' + n + '"; nothing written');
      process.exit(4);
    }
  }
}

try {
  fs.writeFileSync(sidecarPath, sidecar, 'utf8');
  fs.writeFileSync(mainPath, main, 'utf8');
} catch (e) {
  console.error('cannot write: ' + e.message);
  process.exit(5);
}

console.log('patched: sidecar.stopAll + quitApp + exit watchdog');
`;

const outPath = path.join(__dirname, 'patch-quit.js');
fs.writeFileSync(outPath, out, 'utf8');
console.log('written: ' + outPath + ' (' + out.length + ' octets)');
console.log('  stopAll : ' + stopAllText.split('\n').length + ' lignes');
console.log('  guard   : ' + guardText.split('\n').length + ' lignes');
