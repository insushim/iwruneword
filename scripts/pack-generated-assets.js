const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'client', 'assets', 'source');
const REMASTER_DIR = path.join(ROOT, 'client', 'assets', 'remaster');
const OUT_SPRITES = path.join(REMASTER_DIR, 'sprites');
const OUT_ENV = path.join(REMASTER_DIR, 'environment');
const OUT_TILES = path.join(REMASTER_DIR, 'tiles');
const DIR_ORDER = ['down','down_right','right','up_right','up','up_left','left','down_left','atk_down','atk_down_right','atk_right','atk_up_right','atk_up','atk_up_left','atk_left','atk_down_left'];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listPngs(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .map((name) => path.join(dirPath, name))
    .sort((a, b) => a.localeCompare(b));
}

function safeKey(value) {
  return value.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function getFolderMeta(folderPath) {
  const metaPath = path.join(folderPath, 'meta.json');
  return fs.existsSync(metaPath) ? readJson(metaPath) : null;
}

function defaultSpriteMeta(srcFile) {
  return {
    kind: 'directional',
    src: path.basename(srcFile),
    frameWidth: 1024,
    frameHeight: 1024,
    framesPerDir: 1,
    rows: [{ name: 'down', row: 0, frames: 1 }]
  };
}

function packSpriteFolder(folderPath, outputKey, manifest, report) {
  const pngs = listPngs(folderPath);
  if (!pngs.length) return;

  const meta = getFolderMeta(folderPath) || defaultSpriteMeta(pngs[0]);
  const srcName = meta.src || path.basename(pngs[0]);
  const srcPath = path.join(folderPath, srcName);
  const fallbackSrc = fs.existsSync(srcPath) ? srcPath : pngs[0];
  const outName = `${safeKey(outputKey)}.png`;
  copyFile(fallbackSrc, path.join(OUT_SPRITES, outName));

  manifest.sprites[outputKey] = {
    src: `assets/remaster/sprites/${outName}`,
    kind: meta.kind || 'directional',
    frameWidth: meta.frameWidth || 1024,
    frameHeight: meta.frameHeight || 1024,
    framesPerDir: meta.framesPerDir || 1,
    rows: Array.isArray(meta.rows) && meta.rows.length ? meta.rows : [{ name: 'down', row: 0, frames: 1 }]
  };

  report.push({ type: 'sprite', key: outputKey, source: fallbackSrc, usedMeta: !!getFolderMeta(folderPath) });
}

function packImageFolder(folderPath, outputType, outputKey, manifest, report) {
  const pngs = listPngs(folderPath);
  if (!pngs.length) return;

  const meta = getFolderMeta(folderPath);
  if (meta && Array.isArray(meta.assets) && meta.assets.length) {
    for (const asset of meta.assets) {
      const srcPath = path.join(folderPath, asset.src);
      if (!fs.existsSync(srcPath)) continue;
      const key = asset.key || `${outputKey}_${path.parse(asset.src).name}`;
      const outName = `${safeKey(key)}.png`;
      const destDir = outputType === 'tiles' ? OUT_TILES : OUT_ENV;
      copyFile(srcPath, path.join(destDir, outName));
      manifest[outputType][key] = {
        src: `assets/remaster/${outputType}/${outName}`,
        width: asset.width || null,
        height: asset.height || null
      };
      report.push({ type: outputType, key, source: srcPath, usedMeta: true });
    }
    return;
  }

  if (pngs.length === 1) {
    const outName = `${safeKey(outputKey)}.png`;
    const destDir = outputType === 'tiles' ? OUT_TILES : OUT_ENV;
    copyFile(pngs[0], path.join(destDir, outName));
    manifest[outputType][outputKey] = {
      src: `assets/remaster/${outputType}/${outName}`,
      width: null,
      height: null
    };
    report.push({ type: outputType, key: outputKey, source: pngs[0], usedMeta: false });
    return;
  }

  for (const png of pngs) {
    const key = `${outputKey}_${path.parse(png).name}`;
    const outName = `${safeKey(key)}.png`;
    const destDir = outputType === 'tiles' ? OUT_TILES : OUT_ENV;
    copyFile(png, path.join(destDir, outName));
    manifest[outputType][key] = {
      src: `assets/remaster/${outputType}/${outName}`,
      width: null,
      height: null
    };
    report.push({ type: outputType, key, source: png, usedMeta: false });
  }
}

function packFolderCollection(baseDir, kind, manifest, report) {
  if (!fs.existsSync(baseDir)) return;
  const entries = fs.readdirSync(baseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const entry of entries) {
    const folderPath = path.join(baseDir, entry.name);
    const key = entry.name;
    if (kind === 'sprites') packSpriteFolder(folderPath, key, manifest, report);
    if (kind === 'environment') packImageFolder(folderPath, 'environment', key, manifest, report);
    if (kind === 'tiles') packImageFolder(folderPath, 'tiles', key, manifest, report);
  }
}

function resetOutput() {
  ensureDir(OUT_SPRITES);
  ensureDir(OUT_ENV);
  ensureDir(OUT_TILES);
}

function buildManifest() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sprites: {},
    environment: {},
    tiles: {}
  };
}

function main() {
  const mode = process.argv[2] || 'all';
  if (!fs.existsSync(SOURCE_DIR)) {
    console.log(JSON.stringify({ ok: false, mode, message: 'No generated source assets found yet', sourceDir: SOURCE_DIR }, null, 2));
    process.exit(0);
  }

  resetOutput();
  const manifest = buildManifest();
  const report = [];

  if (mode === 'all' || mode === 'characters') {
    packFolderCollection(path.join(SOURCE_DIR, 'characters'), 'sprites', manifest, report);
  }
  if (mode === 'all' || mode === 'monsters') {
    packFolderCollection(path.join(SOURCE_DIR, 'monsters'), 'sprites', manifest, report);
  }
  if (mode === 'all' || mode === 'environment') {
    packFolderCollection(path.join(SOURCE_DIR, 'environment'), 'environment', manifest, report);
    packFolderCollection(path.join(SOURCE_DIR, 'tiles'), 'tiles', manifest, report);
  }

  fs.writeFileSync(path.join(REMASTER_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(JSON.stringify({
    ok: true,
    mode,
    counts: {
      sprites: Object.keys(manifest.sprites).length,
      environment: Object.keys(manifest.environment).length,
      tiles: Object.keys(manifest.tiles).length
    },
    report,
    manifest: path.join(REMASTER_DIR, 'manifest.json')
  }, null, 2));
}

main();
