import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPreset } from "../tools/mcp-image-server/src/presets.mjs";
import { writeSourceMeta } from "../tools/mcp-image-server/src/source-meta.mjs";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "client", "assets", "source");

const COLLECTIONS = [
  { dir: "characters", presetKey: "character" },
  { dir: "monsters", presetKey: "monster" },
  { dir: "environment", presetKey: "environment" },
  { dir: "tiles", presetKey: "tiles" }
];

function resolveCollections(filter) {
  if (!filter || filter === "all") return COLLECTIONS;
  return COLLECTIONS.filter((collection) => collection.dir === filter);
}

function listPngs(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .map((name) => path.join(dirPath, name))
    .sort((a, b) => a.localeCompare(b));
}

function listDirs(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(dirPath, entry.name));
}

function main() {
  const filter = process.argv[2] || "all";
  const report = [];

  for (const collection of resolveCollections(filter)) {
    const baseDir = path.join(SOURCE_ROOT, collection.dir);
    for (const entityDir of listDirs(baseDir)) {
      const files = listPngs(entityDir);
      if (!files.length) continue;
      const metaPath = writeSourceMeta(entityDir, collection.dir, files, getPreset(collection.presetKey));
      report.push({
        collection: collection.dir,
        entityId: path.basename(entityDir),
        fileCount: files.length,
        metaPath
      });
    }
  }

  console.log(JSON.stringify({ ok: true, filter, count: report.length, report }, null, 2));
}

main();
