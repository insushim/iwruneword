const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const OUT_DIR = path.join(CLIENT_DIR, 'assets', 'remaster');
const SPRITE_OUT_DIR = path.join(OUT_DIR, 'sprites');
const ENV_OUT_DIR = path.join(OUT_DIR, 'environment');
const TILE_OUT_DIR = path.join(OUT_DIR, 'tiles');

const SPRITE_SCRIPT = path.join(CLIENT_DIR, 'sprites.js');

const DIR_ORDER = [
  'down',
  'down_right',
  'right',
  'up_right',
  'up',
  'up_left',
  'left',
  'down_left',
  'atk_down',
  'atk_down_right',
  'atk_right',
  'atk_up_right',
  'atk_up',
  'atk_up_left',
  'atk_left',
  'atk_down_left'
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeDataUrl(filePath, dataUrl) {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
}

async function exportAssets() {
  ensureDir(SPRITE_OUT_DIR);
  ensureDir(ENV_OUT_DIR);
  ensureDir(TILE_OUT_DIR);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: SPRITE_SCRIPT });

  const exportData = await page.evaluate((dirOrder) => {
    generateAllSprites();

    function exportSpriteCache() {
      const result = {};
      for (const [key, cache] of Object.entries(SpriteCache)) {
        const dirs = dirOrder.filter((dir) => Array.isArray(cache[dir]) && cache[dir].length);
        if (!dirs.length) continue;

        const frameWidth = cache[dirs[0]][0].width;
        const frameHeight = cache[dirs[0]][0].height;
        const framesPerDir = Math.max(...dirs.map((dir) => cache[dir].length));
        const upscale = 3;
        const sheet = document.createElement('canvas');
        sheet.width = frameWidth * framesPerDir * upscale;
        sheet.height = frameHeight * dirs.length * upscale;
        const ctx = sheet.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const rows = [];
        dirs.forEach((dir, rowIndex) => {
          const frames = cache[dir];
          rows.push({ name: dir, row: rowIndex, frames: frames.length });
          frames.forEach((frame, frameIndex) => {
            ctx.drawImage(
              frame,
              frameIndex * frameWidth * upscale,
              rowIndex * frameHeight * upscale,
              frameWidth * upscale,
              frameHeight * upscale
            );
          });
        });

        result[key] = {
          kind: 'directional',
          frameWidth: frameWidth * upscale,
          frameHeight: frameHeight * upscale,
          framesPerDir,
          rows,
          dataUrl: sheet.toDataURL('image/png')
        };
      }
      return result;
    }

    function exportSingleCache(cacheObj, upscale) {
      const result = {};
      for (const [key, canvas] of Object.entries(cacheObj)) {
        const out = document.createElement('canvas');
        out.width = canvas.width * upscale;
        out.height = canvas.height * upscale;
        const ctx = out.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(canvas, 0, 0, out.width, out.height);
        result[key] = {
          width: out.width,
          height: out.height,
          dataUrl: out.toDataURL('image/png')
        };
      }
      return result;
    }

    return {
      sprites: exportSpriteCache(),
      environment: exportSingleCache(EnvCache, 3),
      tiles: exportSingleCache(TileCache, 4),
      meta: {
        generatedAt: new Date().toISOString(),
        spriteCount: Object.keys(SpriteCache).length,
        environmentCount: Object.keys(EnvCache).length,
        tileCount: Object.keys(TileCache).length
      }
    };
  }, DIR_ORDER);

  await browser.close();

  const manifest = {
    version: 1,
    generatedAt: exportData.meta.generatedAt,
    sprites: {},
    environment: {},
    tiles: {}
  };

  for (const [key, sprite] of Object.entries(exportData.sprites)) {
    const fileName = `${key}.png`;
    writeDataUrl(path.join(SPRITE_OUT_DIR, fileName), sprite.dataUrl);
    manifest.sprites[key] = {
      src: `assets/remaster/sprites/${fileName}`,
      kind: sprite.kind,
      frameWidth: sprite.frameWidth,
      frameHeight: sprite.frameHeight,
      framesPerDir: sprite.framesPerDir,
      rows: sprite.rows
    };
  }

  for (const [key, env] of Object.entries(exportData.environment)) {
    const fileName = `${key}.png`;
    writeDataUrl(path.join(ENV_OUT_DIR, fileName), env.dataUrl);
    manifest.environment[key] = {
      src: `assets/remaster/environment/${fileName}`,
      width: env.width,
      height: env.height
    };
  }

  for (const [key, tile] of Object.entries(exportData.tiles)) {
    const fileName = `${key}.png`;
    writeDataUrl(path.join(TILE_OUT_DIR, fileName), tile.dataUrl);
    manifest.tiles[key] = {
      src: `assets/remaster/tiles/${fileName}`,
      width: tile.width,
      height: tile.height
    };
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log(
    `Exported ${Object.keys(manifest.sprites).length} sprite sheets, ` +
    `${Object.keys(manifest.environment).length} environment assets, ` +
    `${Object.keys(manifest.tiles).length} terrain tiles to ${OUT_DIR}`
  );
}

exportAssets().catch((error) => {
  console.error(error);
  process.exit(1);
});
