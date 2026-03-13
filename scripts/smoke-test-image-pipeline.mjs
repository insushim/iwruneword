import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getPreset } from "../tools/mcp-image-server/src/presets.mjs";

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), "..");
const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
const COMFYUI_CHECKPOINT = process.env.COMFYUI_CHECKPOINT || "model.safetensors";
const WORKFLOW_DIR = path.join(PROJECT_ROOT, "tools", "mcp-image-server", "workflows");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

async function checkComfyUi() {
  const response = await fetch(`${COMFYUI_BASE_URL}/system_stats`);
  if (!response.ok) {
    throw new Error(`ComfyUI health check failed: HTTP ${response.status}`);
  }
  return response.json();
}

function compileWorkflow(name, promptText, seed, outputPrefix, presetKey) {
  const filePath = path.join(WORKFLOW_DIR, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing workflow: ${filePath}`);
  }
  const preset = getPreset(presetKey);

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

async function main() {
  const report = {
    ok: true,
    comfyuiBaseUrl: COMFYUI_BASE_URL,
    checkpoint: COMFYUI_CHECKPOINT,
    workflowDir: WORKFLOW_DIR,
    connection: null,
    workflows: []
  };

  try {
    const stats = await checkComfyUi();
    report.connection = {
      ok: true,
      devices: Array.isArray(stats.devices) ? stats.devices.length : null
    };
  } catch (error) {
    report.ok = false;
    report.connection = {
      ok: false,
      error: error.message
    };
  }

  const samples = [
    ["character-sheet.json", "player_warrior", "fantasy warrior turnaround sheet", 12345, "iwruneword/characters/player_warrior", "character"],
    ["monster-sheet.json", "fire_dragon", "dark fantasy dragon turnaround sheet", 23456, "iwruneword/monsters/fire_dragon", "monster"],
    ["environment-set.json", "forest_of_words", "fantasy forest props and tiles", 34567, "iwruneword/environment/forest_of_words", "environment"]
  ];

  for (const [workflowName, entityId, promptText, seed, outputPrefix, presetKey] of samples) {
    try {
      const compiled = compileWorkflow(workflowName, promptText, seed, outputPrefix, presetKey);
      report.workflows.push({
        workflowName,
        entityId,
        presetKey,
        ok: true,
        nodeCount: Object.keys(compiled).length,
        samplerSeed: compiled["3"]?.inputs?.seed ?? null,
        steps: compiled["3"]?.inputs?.steps ?? null,
        cfg: compiled["3"]?.inputs?.cfg ?? null,
        checkpoint: compiled["4"]?.inputs?.ckpt_name ?? null,
        size: {
          width: compiled["5"]?.inputs?.width ?? null,
          height: compiled["5"]?.inputs?.height ?? null
        },
        outputPrefix: compiled["9"]?.inputs?.filename_prefix ?? null
      });
    } catch (error) {
      report.ok = false;
      report.workflows.push({
        workflowName,
        entityId,
        ok: false,
        error: error.message
      });
    }
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main();
