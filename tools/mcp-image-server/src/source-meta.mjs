import fs from "fs";
import path from "path";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeKey(value) {
  return value.replace(/[^a-zA-Z0-9_\-]/g, "_");
}

function spriteRows(framesPerDir = 1) {
  return [
    "down",
    "down_right",
    "right",
    "up_right",
    "up",
    "up_left",
    "left",
    "down_left"
  ].map((name, row) => ({ name, row, frames: framesPerDir }));
}

export function buildSourceMeta(kind, files, preset) {
  const fileNames = files.map((filePath) => path.basename(filePath));
  if (!fileNames.length) {
    throw new Error(`Cannot build source meta for '${kind}' without files`);
  }

  if (kind === "characters" || kind === "monsters") {
    return {
      kind: "directional",
      src: fileNames[0],
      frameWidth: preset.frameWidth,
      frameHeight: preset.frameHeight,
      framesPerDir: preset.framesPerDir,
      rows: spriteRows(preset.framesPerDir)
    };
  }

  if (kind === "environment" || kind === "tiles") {
    return {
      assets: fileNames.map((fileName) => ({
        key: safeKey(path.parse(fileName).name),
        src: fileName,
        width: preset.assetWidth ?? null,
        height: preset.assetHeight ?? null
      }))
    };
  }

  throw new Error(`Unsupported source meta kind: ${kind}`);
}

export function writeSourceMeta(targetDir, kind, files, preset) {
  const meta = buildSourceMeta(kind, files, preset);
  const metaPath = path.join(targetDir, "meta.json");
  writeJson(metaPath, meta);
  return metaPath;
}
