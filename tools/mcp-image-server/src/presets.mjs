export const GENERATION_PRESETS = {
  character: {
    workflowName: "character-sheet.json",
    width: 1024,
    height: 1024,
    frameWidth: 192,
    frameHeight: 256,
    framesPerDir: 4,
    steps: 30,
    cfg: 6.5,
    samplerName: "euler",
    scheduler: "normal",
    batchSize: 1,
    negativePrompt: [
      "low quality",
      "blurry",
      "bad anatomy",
      "cropped",
      "duplicate limbs",
      "extra fingers",
      "fused weapon",
      "multiple characters",
      "busy background",
      "text",
      "watermark"
    ].join(", ")
  },
  monster: {
    workflowName: "monster-sheet.json",
    width: 1024,
    height: 1024,
    frameWidth: 320,
    frameHeight: 320,
    framesPerDir: 2,
    steps: 32,
    cfg: 7,
    samplerName: "euler",
    scheduler: "normal",
    batchSize: 1,
    negativePrompt: [
      "low quality",
      "blurry",
      "deformed anatomy",
      "extra heads",
      "extra wings",
      "cropped subject",
      "multiple monsters",
      "busy background",
      "text",
      "watermark"
    ].join(", ")
  },
  environment: {
    workflowName: "environment-set.json",
    width: 1152,
    height: 896,
    assetWidth: 256,
    assetHeight: 256,
    steps: 28,
    cfg: 6,
    samplerName: "euler",
    scheduler: "normal",
    batchSize: 1,
    negativePrompt: [
      "muddy texture",
      "blurry edges",
      "distorted perspective",
      "unreadable terrain",
      "oversaturated fog",
      "text",
      "watermark",
      "characters in scene"
    ].join(", ")
  },
  tiles: {
    workflowName: "environment-set.json",
    width: 1024,
    height: 1024,
    assetWidth: 128,
    assetHeight: 128,
    steps: 26,
    cfg: 6,
    samplerName: "euler",
    scheduler: "normal",
    batchSize: 1,
    negativePrompt: [
      "muddy texture",
      "blurry edges",
      "distorted perspective",
      "unreadable tile seams",
      "text",
      "watermark",
      "characters in scene"
    ].join(", ")
  }
};

function applyProfile(kind, preset) {
  const profile = process.env.COMFYUI_PROFILE || "standard";
  if (profile !== "fast-cpu") return preset;

  if (kind === "character") {
    return { ...preset, width: 512, height: 512, steps: 8, cfg: 5.5 };
  }
  if (kind === "monster") {
    return { ...preset, width: 512, height: 512, steps: 8, cfg: 6 };
  }
  if (kind === "environment") {
    return { ...preset, width: 640, height: 512, steps: 8, cfg: 5.5 };
  }
  if (kind === "tiles") {
    return { ...preset, width: 512, height: 512, steps: 6, cfg: 5.5 };
  }
  return preset;
}

function applyUltraCpuProfile(kind, preset) {
  if (kind === "character") {
    return {
      ...preset,
      width: 384,
      height: 384,
      steps: 4,
      cfg: 4.5,
      batchSize: 1
    };
  }
  if (kind === "monster") {
    return {
      ...preset,
      width: 384,
      height: 384,
      steps: 4,
      cfg: 4.5,
      batchSize: 1
    };
  }
  if (kind === "environment") {
    return {
      ...preset,
      width: 448,
      height: 384,
      steps: 4,
      cfg: 4.5,
      batchSize: 1
    };
  }
  if (kind === "tiles") {
    return {
      ...preset,
      width: 384,
      height: 384,
      steps: 4,
      cfg: 4.5,
      batchSize: 1
    };
  }
  return preset;
}

function applySelectedProfile(kind, preset) {
  const profile = process.env.COMFYUI_PROFILE || "standard";
  if (profile === "fast-cpu") return applyProfile(kind, preset);
  if (profile === "ultra-cpu") return applyUltraCpuProfile(kind, preset);
  return preset;
}

export function getPreset(kind) {
  const preset = GENERATION_PRESETS[kind];
  if (!preset) throw new Error(`Unknown generation preset: ${kind}`);
  return applySelectedProfile(kind, preset);
}
