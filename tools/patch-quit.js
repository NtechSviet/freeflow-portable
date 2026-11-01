'use strict';
// Ajoute "aucun moteur fantome" a un build FreeFlow portable, sur place.
//
//   node tools/patch-quit.js <chemin>\resources\app
//
// FreeFlow arrete son moteur a l'arret normal, mais sous Windows le moteur
// survit a toute sortie anormale (plantage, fenetre tuee, console fermee,
// arret de session). Le moteur de ce build refuse /shutdown sans son jeton, et
// Windows protege la variable qui le contient contre la lecture par un autre
// processus : l'arret propre est hors de portee, on tue donc. Trois couches :
//
//   1. lib/sidecar.js -> stopAll() : notre arbre, ce qui ecoute sur le bloc de
//      ports, et tout binaire du moteur sous <dossier>\resources\ ;
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
const STOPALL = "/**\n   * Windows: the engine is not always ours. When Electron leaves without\n   * /shutdown (crash, console closed, \"End task\", machine rebooted), a\n   * freeflow-stt process stays on the port with the model loaded (~700 MB),\n   * and the next launch silently adopts it. On quit we therefore kill every\n   * engine of this folder (current port, next ports up, plus any process\n   * running an engine binary from this directory) and the current tree.\n   */\n  async stopAll() {\n    this.stopping = true;\n    this.killed = true;\n    clearInterval(this._poll);\n    this._poll = null;\n    if (process.platform !== 'win32' || this.external) {\n      return this.stop();                       // spawning engine / non-Windows: nothing extra\n    }\n    if (this.child && this.child.pid) {\n      const pid = this.child.pid;\n      await new Promise((r) => {\n        execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => r());\n        setTimeout(r, 3000);\n      });\n    }\n    const exe = this.resolveCommand();\n    const exeName = exe ? path.win32.basename(exe.cmd).toLowerCase() : '';\n    const port0 = this._port0 || this.port;\n    const ps = `\n      $found = @()\n      try {\n        Get-NetTCPConnection -State Listen -ErrorAction Stop |\n          Where-Object { $_.LocalPort -ge ${port0} -and $_.LocalPort -le ${port0 + 5} } |\n          ForEach-Object { $found += $_.OwningProcess }\n      } catch { }\n      foreach ($e in @(Get-CimInstance Win32_Process -Filter \"Name = '${exeName.replace(/'/g, \"''\")}'\" -ErrorAction SilentlyContinue)) {\n        if ($e.ExecutablePath -and (Split-Path -Parent (Split-Path -Parent $e.ExecutablePath)) -eq '${path.dirname(this.resourcesPath || '').replace(/'/g, \"''\")}') { $found += $e.ProcessId }\n      }\n      $found = $found | Sort-Object -Unique\n      foreach ($p in $found) { taskkill /PID $p /T /F 2>&1 | Out-Null }\n      if ($found.Count -gt 0) { 'killed ' + ($found -join ',') }\n    `;\n    await new Promise((r) => {\n      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps], { windowsHide: true, timeout: 15000 }, (_e, out) => {\n        const line = String(out || '').trim();\n        if (line) this.log(`sidecar: stopAll ${line}`);\n        r();\n      });\n      setTimeout(r, 16000);\n    });\n    this.child = null;\n  }";
// Meme chose pour la garde de sortie.
const GUARD = "// Last line of defence: whatever the exit path (tray \"Quitter\", SIGTERM, renderer\n// crash), the engine must not outlive this process. Windows-only helper script:\n// it waits for our PID to disappear, then kills what is left of the engine.\nfunction guardEngine() {\n  if (process.platform !== 'win32' || !sidecar || sidecar.external) return;\n  const script = path.join(__dirname, 'lib', '-kill-engine.ps1');\n  if (!fs.existsSync(script)) return;\n  try {\n    // Le script attend la fin de ce processus, puis tue ce qui reste du moteur.\n    const c = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,\n      '-ParentPid', String(process.pid), '-ExeName', 'freeflow-stt.exe', '-Port', String(sidecar._port0 || sidecar.port)],\n    { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, FREEFLOW_PORTABLE_ROOT: path.dirname(process.execPath) } });\n    c.unref();\n    log('quit guard: watchdog armed');\n  } catch (e) { log('quit guard:', e.message); }\n}\napp.on('will-quit', guardEngine);\napp.on('render-process-gone', (_e, _wc, details) => { log('render-process-gone', details); });\nprocess.on('SIGTERM', () => { guardEngine(); quitApp(); });\nprocess.on('SIGINT', () => { guardEngine(); quitApp(); });\nprocess.on('uncaughtException', (e) => { log('uncaught:', e && e.stack ? e.stack : String(e)); guardEngine(); });";

// --- 1. lib/sidecar.js --------------------------------------------------------
if (sidecar.indexOf('async stopAll()') === -1) {
  const memAnchor = '    this.child = null;';
  if (sidecar.indexOf(memAnchor) === -1) {
    console.error('sidecar anchor (this.child = null) not found');
    process.exit(3);
  }
  sidecar = sidecar.replace(memAnchor,
    '    this.child = null;\n    this._port0 = this.port;     // port requested by the app (stopAll walks the range)');

  const stopAnchor = /\n  async stop\(\) \{/;
  if (!stopAnchor.test(sidecar)) {
    console.error('sidecar anchor (async stop) not found');
    process.exit(3);
  }
  // m = "\n  async stop() {": le bloc arrive sans son retrait initial
  sidecar = sidecar.replace(stopAnchor, (m) => '\n  ' + STOPALL + m);

  if (sidecar.indexOf('this.killed || this.external || !this.child') === -1) {
    const old = '    if (this.external || !this.child) return;';
    if (sidecar.indexOf(old) === -1) {
      console.error('sidecar anchor (external child check) not found');
      process.exit(3);
    }
    sidecar = sidecar.replace(old,
      '    // Our own engine was killed hard by stopAll(): the process already answers\n'
      + '    // to nobody, so stop() only has its bookkeeping to do.\n'
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
  ].join('\n'));

  const anchor = "app.on('window-all-closed', () => { /* keep running in the tray */ });";
  if (main.indexOf(anchor) === -1) {
    console.error('main anchor (window-all-closed) not found');
    process.exit(3);
  }
  main = main.replace(anchor, anchor + '\n' + GUARD);
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
