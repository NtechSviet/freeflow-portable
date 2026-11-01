'use strict';
// Adds "no orphan engine" to a portable FreeFlow build, in place.
//
//   node tools/patch-quit.js <chemin>\resources\app
//
// FreeFlow does stop its transcription engine on a normal quit, but on Windows
// the engine survives when Electron dies otherwise (crash, console window
// closed, "End task", session shutdown). The next launch then adopts that
// orphan instead of starting a fresh engine, and the leftover keeps ~700 MB
// and a renderer tree alive. This patch adds three layers, in order:
//
//   1. lib/sidecar.js -> stopAll(): on quit, kill every engine of this folder
//      (our tree, the engines listening on the port block, and any engine
//      binary living under <folder>\resources\);
//   2. main.js -> quitApp() uses stopAll() instead of stop();
//   3. lib/-kill-engine.ps1 + a detached watchdog armed on exit: even when no
//      code of ours runs any more, the engine is killed once we are gone.
//      (The script name starts with "-" so PowerShell does not treat it as an
//      operator; the quit path passes it with -File.)
//
// Idempotent. Exit codes: 0 ok/already patched, 2 usage, 3 anchor missing,
// 4 self-check failed (nothing written), 5 write failure.

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

if (sidecar.indexOf('stopAll()') !== -1 && main.indexOf('stopAll()') !== -1) {
  console.log('already patched: quit/engine cleanup');
  process.exit(0);
}

const eolOf = (s) => (s.indexOf('\r\n') !== -1 ? '\r\n' : '\n');

let changed = 0;

// ---------------------------------------------------------------------------
// 1. lib/sidecar.js : remember the requested port + stopAll()
// ---------------------------------------------------------------------------
if (sidecar.indexOf('stopAll()') === -1) {
  const memAnchor = '    this.child = null;\n    this.external = false;      // true when we adopted an already-running server';
  if (sidecar.indexOf(memAnchor) === -1) {
    console.error('sidecar anchor (child/external) not found');
    process.exit(3);
  }
  sidecar = sidecar.replace(memAnchor,
    '    this.child = null;\n    this._port0 = this.port;     // requested port (stopAll walks the block)\n'
    + '    this.external = false;      // true when we adopted an already-running server');

  const stopAnchor = '\n  async stop() {';
  if (sidecar.indexOf(stopAnchor) === -1) {
    console.error('sidecar anchor (async stop) not found');
    process.exit(3);
  }
  const stopAll = `
  /**
   * Windows: the engine does not always die with us. When Electron leaves
   * without /shutdown (crash, console closed, "End task", session shutdown) a
   * freeflow-stt process stays on the port with the model loaded (~700 MB),
   * and the next launch silently adopts it. On quit we therefore kill every
   * engine of this folder: our own tree, whatever listens on the port block,
   * and any engine binary living under <folder>\\resources\\.
   */
  async stopAll() {
    this.stopping = true;
    this.killed = true;
    clearInterval(this._poll);
    this._poll = null;
    if (process.platform !== 'win32' || this.external) return this.stop();
    if (this.child && this.child.pid) {
      const pid = this.child.pid;
      await new Promise((r) => {
        execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => r());
        setTimeout(r, 3000);
      });
    }
    const cmd = this.resolveCommand();
    const exeName = cmd ? path.win32.basename(cmd.cmd).toLowerCase() : '';
    const port0 = this._port0 || this.port;
    const dir = path.dirname(this.resourcesPath || '');
    const q = (s) => String(s).replace(/'/g, "''");
    const ps = [
      '$found = @()',
      'try {',
      '  Get-NetTCPConnection -State Listen -ErrorAction Stop |',
      '    Where-Object { $_.LocalPort -ge ' + port0 + ' -and $_.LocalPort -le ' + (port0 + 5) + ' } |',
      '    ForEach-Object { $found += $_.OwningProcess }',
      '} catch { }',
      exeName ? 'foreach ($e in @(Get-CimInstance Win32_Process -Filter "Name = \'' + q(exeName) + '\'" -ErrorAction SilentlyContinue)) {' : 'foreach ($e in @()) {',
      '  if ($e.ExecutablePath -and (Split-Path -Parent (Split-Path -Parent $e.ExecutablePath)) -eq \'' + q(dir) + '\') { $found += $e.ProcessId }',
      '}',
      '$found = $found | Sort-Object -Unique',
      'foreach ($p in $found) { taskkill /PID $p /T /F 2>&1 | Out-Null }',
      'if ($found.Count -gt 0) { "killed " + ($found -join ",") }',
    ].join('; ');
    await new Promise((r) => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ps],
        { windowsHide: true, timeout: 15000 }, (_e, out) => {
          const line = String(out || '').trim();
          if (line) this.log('sidecar: stopAll ' + line);
          r();
        });
      setTimeout(r, 16000);
    });
    this.child = null;
  }
`;
  sidecar = sidecar.replace(stopAnchor, stopAll + stopAnchor);
  changed++;
}

if (sidecar.indexOf('if (this.killed || this.external || !this.child) return;') === -1) {
  sidecar = sidecar.replace('    if (this.external || !this.child) return;',
    '    // stopAll() already killed our engine: stop() only does its bookkeeping.\n'
    + '    if (this.killed || this.external || !this.child) return;');
}

// ---------------------------------------------------------------------------
// 2. main.js : spawn() import, stopAll() on quit, exit watchdog
// ---------------------------------------------------------------------------
if (main.indexOf('stopAll()') === -1) {
  if (main.indexOf("const { execFile } = require('child_process');") !== -1) {
    main = main.replace("const { execFile } = require('child_process');",
      "const { execFile, spawn } = require('child_process');");
  }
  const quitAnchor = '  if (sidecar) await sidecar.stop();';
  if (main.indexOf(quitAnchor) === -1) {
    console.error('main anchor (sidecar.stop on quit) not found');
    process.exit(3);
  }
  main = main.replace(quitAnchor,
    '  // Every engine of this folder, not just the one we spawned (see lib/sidecar.js).\n'
    + '  if (sidecar) {\n'
    + '    try { await sidecar.stopAll(); } catch (e) { log(\'sidecar stopAll:\', e.message); }\n'
    + '  }');

  const anchor = "app.on('window-all-closed', () => { /* keep running in the tray */ });";
  if (main.indexOf(anchor) === -1) {
    console.error('main anchor (window-all-closed) not found');
    process.exit(3);
  }
  const eol = eolOf(main);
  const guard = [
    '',
    '// Last line of defence: whatever the exit path, the transcription engine must not',
    '// outlive this process. The helper waits for our PID to disappear, then kills what',
    '// is left of the engine (lib/-kill-engine.ps1, "-" prefix: not a PowerShell operator).',
    'function guardEngine() {',
    "  if (process.platform !== 'win32' || !sidecar || sidecar.external) return;",
    "  const script = path.join(__dirname, 'lib', '-kill-engine.ps1');",
    '  if (!fs.existsSync(script)) return;',
    '  try {',
    "    const c = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,",
    "      '-ParentPid', String(process.pid), '-ExeName', 'freeflow-stt.exe', '-Port', String(sidecar._port0 || sidecar.port)],",
    '      { detached: true, stdio: \'ignore\', windowsHide: true,',
    "        env: { ...process.env, FREEFLOW_PORTABLE_ROOT: path.dirname(process.execPath) } });",
    '    c.unref();',
    "    log('quit guard: watchdog armed');",
    "  } catch (e) { log('quit guard:', e.message); }",
    '}',
    "app.on('will-quit', guardEngine);",
    "process.on('SIGTERM', () => { guardEngine(); quitApp(); });",
    "process.on('SIGINT', () => { guardEngine(); quitApp(); });",
    "process.on('uncaughtException', (e) => { log('uncaught:', e && e.stack ? e.stack : String(e)); guardEngine(); });",
  ].join(eol);
  main = main.replace(anchor, anchor + eol + guard);
  changed++;
}

// --- self-check, then write ---------------------------------------------------
for (const [name, s, needles] of [
  ['sidecar.js', sidecar, ['stopAll()', 'this.killed ||']],
  ['main.js', main, ['stopAll()', 'guardEngine', '-kill-engine.ps1']],
]) {
  for (const n of needles) {
    if (s.indexOf(n) === -1) {
      console.error(name + ': self-check failed on "' + n + '"; nothing written');
      process.exit(4);
    }
  }
}

if (changed === 0) {
  console.log('already patched: quit/engine cleanup');
  process.exit(0);
}

try {
  fs.writeFileSync(sidecarPath, sidecar, 'utf8');
  fs.writeFileSync(mainPath, main, 'utf8');
} catch (e) {
  console.error('cannot write: ' + e.message);
  process.exit(5);
}

console.log('patched: sidecar.stopAll + quitApp + exit watchdog');
