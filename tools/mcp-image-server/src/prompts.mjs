function buildPrompt(parts, promptOverride = "") {
  const base = parts.filter(Boolean).join(", ");
  return promptOverride ? `${base}, ${promptOverride}` : base;
}

export function getCharacterPrompt(entityId, style, promptOverride = "") {
  return buildPrompt([
    "single fantasy MMORPG hero concept sheet",
    "2.5D remaster game art",
    "top-down slightly angled camera",
    "full body",
    "clean silhouette",
    "ornate armor details",
    "centered subject on simple backdrop",
    "turnaround reference for sprite sheet",
    "8 directions",
    "consistent proportions",
    "production-ready Korean MMORPG look",
    style || "lineage remaster fantasy",
    entityId
  ], promptOverride);
}

export function getMonsterPrompt(entityId, style, promptOverride = "") {
  return buildPrompt([
    "single dark fantasy monster concept sheet",
    "MMORPG production art",
    "top-down angled gameplay readability",
    "clean silhouette",
    "strong anatomy",
    "centered subject on simple backdrop",
    "turnaround reference for sprite sheet",
    "8 directions",
    "high contrast readable shape language",
    style || "grim fantasy remaster",
    entityId
  ], promptOverride);
}

export function getEnvironmentPrompt(environmentId, promptOverride = "") {
  return buildPrompt([
    "fantasy MMORPG environment concept board",
    "tileable ground variations",
    "matching prop set",
    "hand-painted remaster quality",
    "readable from zoomed-out gameplay camera",
    "orthographic-friendly composition",
    "clean layout for extraction",
    "no characters",
    environmentId
  ], promptOverride);
}
