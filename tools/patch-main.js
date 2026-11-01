'use strict';
// Renders FreeFlow's main process portable-aware, in place.
//
//   node tools/patch-main.js <chemin>\resources\app\main.js
//
// Two changes, both idempotent:
//   1. right after `require('child_process')`, a block that points Electron's
//      userData at <exeDir>\data as soon as a marker file sits next to the exe
//      (portable.txt, a `data` folder, or `FreeFlow Portable`); it also creates
//      that folder, because app.setPath() throws on a missing directory;
//   2. the default `modelCache`, so the voice model lands in <exeDir>\data\models
//      and not in %LOCALAPPDATA%\FreeFlow\models.
//
// Exit codes: 0 ok/already patched, 2 usage, 3 anchor missing, 4 modelCache
// default not found, 5 write/verify failure.

const fs = require('fs');
const path = require('path');

const target = process.argv[2];
if (!target) {
  console.error('usage: node patch-main.js <.../resources/app/main.js>');
  process.exit(2);
}

const ANCHOR = "const { execFile } = require('child_process');";

const BLOCK = [
  '// ---- FreeFlow Portable ---------------------------------------------------',
  '// A marker file next to FreeFlow.exe keeps profile, logs, dictionary, history,',
  '// meetings and voice model inside the folder instead of %APPDATA%/%LOCALAPPDATA%.',
  'var __FF_PORTABLE__ = null;',
  'try {',
  '  var __ffExeDir = path.dirname(process.execPath);',
  '  if ([',
  "    'portable.txt',",
  "    'data',",
  "    'FreeFlow Portable',",
  '  ].some(function (n) { return fs.existsSync(path.join(__ffExeDir, n)); })) {',
  '    __FF_PORTABLE__ = __ffExeDir;',
  "    try { fs.mkdirSync(path.join(__ffExeDir, 'data'), { recursive: true }); } catch (e0) { }",
  "    app.setPath('userData', path.join(__ffExeDir, 'data'));",
  '  }',
  '} catch (e1) { __FF_PORTABLE__ = null; }',
].join('\n');

const MODEL_CACHE = "path.join(__FF_PORTABLE__ ? userData : (process.env.LOCALAPPDATA ? "
  + "path.join(process.env.LOCALAPPDATA, 'FreeFlow') : userData), 'models')";

let src;
try {
  src = fs.readFileSync(target, 'utf8');
} catch (e) {
  console.error('cannot read ' + target + ': ' + e.message);
  process.exit(5);
}

if (src.indexOf('__FF_PORTABLE__') !== -1) {
  console.log('already patched: ' + target);
  process.exit(0);
}

const eol = src.indexOf('\r\n') !== -1 ? '\r\n' : '\n';

// --- 1. portable block --------------------------------------------------------
const at = src.indexOf(ANCHOR);
if (at < 0) {
  console.error('anchor not found (is this really FreeFlow main.js?): ' + ANCHOR);
  process.exit(3);
}
let cut = at + ANCHOR.length;
while (cut < src.length && (src[cut] === '\r' || src[cut] === '\n')) cut++;
const block = BLOCK.split('\n').join(eol) + eol + eol;
src = src.slice(0, cut) + block + src.slice(cut);

// --- 2. modelCache default ----------------------------------------------------
const modelRe = /if \(!settings\.get\(\)\.modelCache\) settings\.update\(\{ modelCache: ([\s\S]*?) \}\);/;
if (!modelRe.test(src)) {
  console.error('modelCache default not found; the file was NOT written');
  process.exit(4);
}
src = src.replace(modelRe, (m) => "if (!settings.get().modelCache) settings.update({ modelCache: "
  + MODEL_CACHE + ' });');

if (src.indexOf('__FF_PORTABLE__') === -1 || src.indexOf(MODEL_CACHE) === -1) {
  console.error('patch self-check failed; the file was NOT written');
  process.exit(5);
}

try {
  fs.writeFileSync(target, src, 'utf8');
} catch (e) {
  console.error('cannot write ' + target + ': ' + e.message);
  process.exit(5);
}

const ported = src.indexOf('__FF_PORTABLE__') !== -1;
console.log('patched: ' + path.basename(target) + ' (' + (ported ? 'portable block + modelCache' : 'nothing') + ')');
