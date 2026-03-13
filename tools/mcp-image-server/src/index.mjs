import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { submitPrompt, waitForImages, downloadImage } from "./comfyui-client.mjs";
import { getCharacterPrompt, getMonsterPrompt, getEnvironmentPrompt } from "./prompts.mjs";
import { getPreset } from "./presets.mjs";
import { writeSourceMeta } from "./source-meta.mjs";

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(process.cwd(), "..", "..", "..");
const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";
const COMFYUI_CHECKPOINT = process.env.COMFYUI_CHECKPOINT || "model.safetensors";
const WORKFLOW_DIR = path.join(PROJECT_ROOT, "tools", "mcp-image-server", "workflows");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sourceDir(...parts) {
  return path.join(PROJECT_ROOT, "client", "assets", "source", ...parts);
}

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
  if (Array.isArray(value)) {
    return value.map((entry) => replaceTokens(entry, tokens));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceTokens(entry, tokens)]));
  }
  return value;
}

function buildWorkflow(workflowName, promptText, seed, outputPrefix, preset) {
  const workflowPath = path.join(WORKFLOW_DIR, workflowName);
  if (!fs.existsSync(workflowPath)) {
    throw new Error(`Workflow file not found: ${workflowPath}`);
  }

  return replaceTokens(readJson(workflowPath), {
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

async function runGeneration(kind, entityId, promptText, seed, workflowName, presetKey) {
  const resolvedSeed = seed || Math.floor(Math.random() * 1000000000);
  const preset = getPreset(presetKey);
  const workflow = buildWorkflow(workflowName, promptText, resolvedSeed, `iwruneword/${kind}/${entityId}`, preset);
  const queued = await submitPrompt(COMFYUI_BASE_URL, workflow);
  const outputs = await waitForImages(COMFYUI_BASE_URL, queued.prompt_id);
  const saveRoot = sourceDir(kind, entityId);
  ensureDir(saveRoot);
  const saved = [];
  for (const node of Object.values(outputs)) {
    for (const image of node.images || []) {
      const target = path.join(saveRoot, image.filename);
      await downloadImage(COMFYUI_BASE_URL, image, target);
      saved.push(target);
    }
  }
  const metaPath = writeSourceMeta(saveRoot, kind, saved, preset);
  const packResult = await runPackScript(kind === "characters" ? "characters" : kind === "monsters" ? "monsters" : "environment");
  return { files: saved, metaPath, packResult };
}

function runPackScript(mode) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PROJECT_ROOT, "scripts", "pack-generated-assets.js");
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, message: "pack-generated-assets.js is not implemented yet" });
      return;
    }
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
      } else reject(new Error(stderr || `pack script failed with code ${code}`));
    });
  });
}

const server = new McpServer({ name: "iwruneword-image-server", version: "0.1.0" });

server.tool("generate_character_sheet", {
  entityId: z.string(),
  style: z.string().optional(),
  promptOverride: z.string().optional(),
  seed: z.number().int().optional()
}, async ({ entityId, style, promptOverride, seed }) => {
  const prompt = getCharacterPrompt(entityId, style, promptOverride);
  const result = await runGeneration("characters", entityId, prompt, seed, "character-sheet.json", "character");
  return { content: [{ type: "text", text: JSON.stringify({ entityId, prompt, seed, workflow: "character-sheet.json", ...result }, null, 2) }] };
});

server.tool("generate_monster_sheet", {
  entityId: z.string(),
  style: z.string().optional(),
  promptOverride: z.string().optional(),
  seed: z.number().int().optional()
}, async ({ entityId, style, promptOverride, seed }) => {
  const prompt = getMonsterPrompt(entityId, style, promptOverride);
  const result = await runGeneration("monsters", entityId, prompt, seed, "monster-sheet.json", "monster");
  return { content: [{ type: "text", text: JSON.stringify({ entityId, prompt, seed, workflow: "monster-sheet.json", ...result }, null, 2) }] };
});

server.tool("generate_environment_set", {
  environmentId: z.string(),
  promptOverride: z.string().optional(),
  seed: z.number().int().optional()
}, async ({ environmentId, promptOverride, seed }) => {
  const prompt = getEnvironmentPrompt(environmentId, promptOverride);
  const result = await runGeneration("environment", environmentId, prompt, seed, "environment-set.json", "environment");
  return { content: [{ type: "text", text: JSON.stringify({ environmentId, prompt, seed, workflow: "environment-set.json", ...result }, null, 2) }] };
});

server.tool("pack_generated_assets", {
  mode: z.enum(["all", "characters", "monsters", "environment"]).default("all")
}, async ({ mode }) => {
  const result = await runPackScript(mode);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

server.tool("sync_source_meta", {
  collection: z.enum(["all", "characters", "monsters", "environment", "tiles"]).default("all")
}, async ({ collection }) => {
  const scriptPath = path.join(PROJECT_ROOT, "scripts", "sync-generated-meta.mjs");
  const child = spawn(process.execPath, [scriptPath, collection], { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `sync-generated-meta failed with code ${code}`));
    });
  });
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    result = { ok: true, stdout, stderr };
  }
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
