import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { spawn } from "child_process";
import { submitPrompt, waitForImages, downloadImage } from "../tools/mcp-image-server/src/comfyui-client.mjs";
import { getCharacterPrompt, getMonsterPrompt, getEnvironmentPrompt } from "../tools/mcp-image-server/src/prompts.mjs";
import { getPreset } from "../tools/mcp-image-server/src/presets.mjs";
import { writeSourceMeta } from "../tools/mcp-image-server/src/source-meta.mjs";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const require = createRequire(import.meta.url);
const CONSTANTS = require(path.join(PROJECT_ROOT, "shared", "constants.js"));
const monstersData = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "server", "data", "monsters.json"), "utf8"));
const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
const COMFYUI_CHECKPOINT = process.env.COMFYUI_CHECKPOINT || "model.safetensors";
const WORKFLOW_DIR = path.join(PROJECT_ROOT, "tools", "mcp-image-server", "workflows");

const CHARACTER_IDS = Object.keys(CONSTANTS.CLASSES || {}).map((key) => `player_${key.toLowerCase()}`);
const MONSTER_IDS = (monstersData.monsters || []).map((monster) => monster.id);
const ENVIRONMENT_IDS = Object.values(CONSTANTS.ZONES || {}).map((zone) => zone.id);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function replaceTokens(value, tokens) {
  if (typeof value === "string") {
    if (Object.prototype.hasOwnProperty.call(tokens, value)) {
      return tokens[value];
    }
    return Object.entries(tokens).reduce((acc, [token, replacement]) => acc.split(token).join(String(replacement)), value);
  }
  if (Array.isArray(value)) return value.map((item) => replaceTokens(item, tokens));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceTokens(item, tokens)]));
  }
  return value;
}

function buildWorkflow(workflowName, promptText, seed, outputPrefix, preset) {
  const filePath = path.join(WORKFLOW_DIR, workflowName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing workflow: ${filePath}`);
  }

  return replaceTokens(readJson(filePath), {
    "__PROMPT__": promptText,
    "__NEGATIVE_PROMPT__": preset.negativePrompt,
    "__SEED__": seed,
    "__CHECKPOINT__": COMFYUI_CHECKPOINT,
    "__OUTPUT_PREFIX__": outputPrefix,
    "__WIDTH__": preset.width,
    "__HEIGHT__": preset.height,
    "__STEPS__": preset.steps,
    "__CFG__": preset.cfg,
    "__SAMPLER__": preset.samplerName,
    "__SCHEDULER__": preset.scheduler,
    "__BATCH_SIZE__": preset.batchSize
  });
}

function sourceDir(kind, entityId) {
  return path.join(PROJECT_ROOT, "client", "assets", "source", kind, entityId);
}

function runPackScript(mode) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PROJECT_ROOT, "scripts", "pack-generated-assets.js");
    const child = spawn(process.execPath, [scriptPath, mode], { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("exit", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve({ ok: true, stdout, stderr });
        }
      } else {
        reject(new Error(stderr || `pack-generated-assets failed with code ${code}`));
      }
    });
  });
}

async function runGeneration(kind, entityId, promptText, workflowName, presetKey, seed) {
  const resolvedSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1000000000);
  const preset = getPreset(presetKey);
  const workflow = buildWorkflow(workflowName, promptText, resolvedSeed, `iwruneword/${kind}/${entityId}`, preset);
  const queued = await submitPrompt(COMFYUI_BASE_URL, workflow);
  const outputs = await waitForImages(COMFYUI_BASE_URL, queued.prompt_id);
  const targetDir = sourceDir(kind, entityId);
  ensureDir(targetDir);

  const files = [];
  for (const node of Object.values(outputs)) {
    for (const image of node.images || []) {
      const targetPath = path.join(targetDir, image.filename);
      await downloadImage(COMFYUI_BASE_URL, image, targetPath);
      files.push(targetPath);
    }
  }
  const metaPath = writeSourceMeta(targetDir, kind, files, preset);
  const packResult = await runPackScript(kind === "characters" ? "characters" : kind === "monsters" ? "monsters" : "environment");

  return {
    kind,
    entityId,
    seed: resolvedSeed,
    workflowName,
    promptText,
    files,
    metaPath,
    packResult
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveTargets(target, entityArg) {
  const entityIds = entityArg
    ? entityArg.split(",").map((value) => value.trim()).filter(Boolean)
    : [];

  if (target === "character") return [{ kind: "characters", entityId: entityIds[0] || "player_warrior", presetKey: "character", workflowName: "character-sheet.json", prompt: (id) => getCharacterPrompt(id, "lineage-remaster-fantasy") }];
  if (target === "monster") return [{ kind: "monsters", entityId: entityIds[0] || "fire_dragon", presetKey: "monster", workflowName: "monster-sheet.json", prompt: (id) => getMonsterPrompt(id, "dark-fantasy-remaster") }];
  if (target === "environment") return [{ kind: "environment", entityId: entityIds[0] || "forest_of_words", presetKey: "environment", workflowName: "environment-set.json", prompt: (id) => getEnvironmentPrompt(id) }];

  if (target === "characters") {
    return unique(entityIds.length ? entityIds : CHARACTER_IDS).map((entityId) => ({
      kind: "characters",
      entityId,
      presetKey: "character",
      workflowName: "character-sheet.json",
      prompt: (id) => getCharacterPrompt(id, "lineage-remaster-fantasy")
    }));
  }

  if (target === "monsters") {
    return unique(entityIds.length ? entityIds : MONSTER_IDS).map((entityId) => ({
      kind: "monsters",
      entityId,
      presetKey: "monster",
      workflowName: "monster-sheet.json",
      prompt: (id) => getMonsterPrompt(id, "dark-fantasy-remaster")
    }));
  }

  if (target === "environments") {
    return unique(entityIds.length ? entityIds : ENVIRONMENT_IDS).map((entityId) => ({
      kind: "environment",
      entityId,
      presetKey: "environment",
      workflowName: "environment-set.json",
      prompt: (id) => getEnvironmentPrompt(id)
    }));
  }

  if (target === "all") {
    return [
      ...resolveTargets("characters"),
      ...resolveTargets("monsters"),
      ...resolveTargets("environments")
    ];
  }

  if (target === "plan") {
    return [];
  }

  throw new Error(`Unknown target '${target}'. Use one of: character, monster, environment, characters, monsters, environments, all, plan`);
}

async function main() {
  const target = process.argv[2] || "character";
  if (target === "plan") {
    console.log(JSON.stringify({
      ok: true,
      targets: {
        characters: CHARACTER_IDS,
        monsters: MONSTER_IDS,
        environments: ENVIRONMENT_IDS
      }
    }, null, 2));
    return;
  }

  const entityArg = process.argv[3];
  const seedArg = process.argv[4];
  const seed = seedArg ? Number.parseInt(seedArg, 10) : undefined;
  const jobs = resolveTargets(target, entityArg);
  const results = [];

  for (const job of jobs) {
    results.push(await runGeneration(
      job.kind,
      job.entityId,
      job.prompt(job.entityId),
      job.workflowName,
      job.presetKey,
      seed
    ));
  }

  console.log(JSON.stringify({
    ok: true,
    target,
    requested: entityArg || null,
    generated: jobs.length,
    results
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
