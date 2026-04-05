'use strict';
/**
 * afterPack.js — electron-builder afterPack hook
 * 
 * Runs AFTER electron-builder has packed all files into the app directory
 * but BEFORE the installer is created. Obfuscates all main-process JS files.
 * 
 * The renderer JS is already obfuscated by the Vite build (vite.config.js).
 * This hook targets the main process: src/main/**\/*.js
 */
const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

// Files/directories to skip — these would break if obfuscated
const SKIP_PATTERNS = [
  'node_modules',
  'sql-wasm.wasm',
  // Integration files are pure API wrappers — obfuscate them too, but skip
  // any that contain only metadata (e.g. index files that just re-export)
];

// Obfuscator options — strong but reliable settings
// Reference: https://obfuscator.io/#options
const OBFUSCATOR_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,           // disabled: too slow on 500 integration files
  debugProtection: false,             // disabled: causes issues in non-browser envs
  disableConsoleOutput: false,        // keep logs for debugging packaged app
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,               // disabled: would break require() chains
  selfDefending: false,               // disabled: browser-only feature
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 6,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.75,
  stringArrayEncoding: ['rc4'],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChunkLength: 3,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false,       // disabled: massively inflates file size
  target: 'node',                     // critical: node target, not browser
};

/**
 * Recursively collect all .js files under a directory.
 */
function collectJsFiles(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_PATTERNS.some(p => entry.name.includes(p))) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  }
  return results;
}

module.exports = async function afterPack(context) {
  const { appOutDir, packager } = context;

  // Only obfuscate for production builds (not during dev)
  if (process.env.NODE_ENV === 'development') return;

  // Suppress javascript-obfuscator Pro advertisement messages
  process.env.JSO_SILENT = '1';
  // Redirect the obfuscator's console.log to suppress ads
  const _origLog = console.log;
  console.log = (...args) => {
    const str = args.join(' ');
    if (str.includes('JavaScript Obfuscator Pro') || str.includes('obfuscator.io')) return;
    _origLog(...args);
  };

  // Locate the main-process source directory inside the packed output
  // For Windows: appOutDir/resources/app/src/main (without asar)
  //              appOutDir/resources/app.asar (with asar — skip, can't obfuscate asar in-place)
  // electron-builder with asar:true packs into app.asar — we need asarUnpack or
  // we obfuscate before asar packing. electron-builder calls afterPack AFTER asar,
  // so we target the unpacked app if asar is disabled for specific files, or we
  // write an afterSign hook instead. However, we CAN access app.asar.unpacked.
  
  const resourcesDir = path.join(appOutDir, 'resources');
  
  // Check if built with asar (packed) or without (directory)
  const asarPath = path.join(resourcesDir, 'app.asar');
  const appDir = path.join(resourcesDir, 'app');
  
  let mainDir;
  if (fs.existsSync(appDir)) {
    // No asar or asar unpacked
    mainDir = path.join(appDir, 'src', 'main');
  } else if (fs.existsSync(asarPath)) {
    // With asar: electron-builder calls afterPack before it creates the asar
    // when using the "afterPack" hook — the unpacked directory is still present
    // at this point as a staging directory. Check for it:
    const stagingDir = path.join(resourcesDir, 'app');
    if (fs.existsSync(stagingDir)) {
      mainDir = path.join(stagingDir, 'src', 'main');
    } else {
      console.log('[afterPack] Staged app directory not found — skipping obfuscation');
      return;
    }
  } else {
    console.log('[afterPack] Could not locate app directory — skipping obfuscation');
    return;
  }

  if (!fs.existsSync(mainDir)) {
    console.log(`[afterPack] Main dir not found at ${mainDir} — skipping`);
    return;
  }

  const jsFiles = collectJsFiles(mainDir);
  console.log(`[afterPack] Obfuscating ${jsFiles.length} main-process files...`);

  let obfuscated = 0;
  let failed = 0;
  
  for (const filePath of jsFiles) {
    try {
      const source = fs.readFileSync(filePath, 'utf8');
      const result = JavaScriptObfuscator.obfuscate(source, OBFUSCATOR_OPTIONS);
      fs.writeFileSync(filePath, result.getObfuscatedCode(), 'utf8');
      obfuscated++;
    } catch (err) {
      // Don't fail the entire build for one file — log and continue
      console.warn(`[afterPack] Warning: could not obfuscate ${path.relative(mainDir, filePath)}: ${err.message}`);
      failed++;
    }
  }

  console.log(`[afterPack] Done — ${obfuscated} files obfuscated, ${failed} skipped.`);
  // Restore console.log
  console.log = _origLog;
};
