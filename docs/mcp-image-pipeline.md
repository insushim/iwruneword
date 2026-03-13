# RuneWord Chronicle: Local Image Generator + MCP Pipeline

## Goal

Replace the current procedural sprite system with an asset-backed pipeline that can:

- generate source art with a local image generator such as ComfyUI
- expose generation and packing commands through MCP tools
- save versioned outputs into `client/assets/remaster`
- convert generated art into game-ready sprite sheets and terrain atlases

## Recommended stack

### Image generator

- `ComfyUI`
- optional checkpoints:
  - SDXL pixel-art or 2.5D fantasy model
  - Flux for concept sheets
  - ESRGAN or 4x upscaler for cleanup

### Control layer

- local MCP server in Node.js
- HTTP calls from MCP server to ComfyUI REST API
- repo-local packing scripts to convert outputs into this game's manifest format

### Game integration

- runtime already supports manifest-backed asset loading first
- fallback remains procedural if `client/assets/remaster/manifest.json` does not exist

## Directory layout

```text
client/
  assets/
    remaster/
      manifest.json
      sprites/
      environment/
      tiles/

tools/
  mcp-image-server/
    package.json
    README.md
    src/
      index.mjs
      comfyui-client.mjs
      prompts.mjs

scripts/
  pack-generated-assets.js
  export-remaster-assets.js
```

## MCP tool contract

The MCP server should expose these tools.

### `generate_character_sheet`

Input:

```json
{
  "entityId": "player_WARRIOR",
  "style": "lineage-remaster-fantasy",
  "promptOverride": "",
  "seed": 12345
}
```

### `generate_monster_sheet`

Input:

```json
{
  "entityId": "fire_dragon",
  "style": "dark-fantasy-remaster",
  "promptOverride": "",
  "seed": 45678
}
```

### `generate_environment_set`

Input:

```json
{
  "environmentId": "forest_of_words",
  "includeTiles": true,
  "includeProps": true,
  "seed": 78901
}
```

### `pack_generated_assets`

Input:

```json
{
  "mode": "all"
}
```

### `sync_source_meta`

Input:

```json
{
  "collection": "all"
}
```

## Asset spec for this project

### Characters and humanoids

- base frame size: `192x256`
- 8 directions
- 4 movement frames
- optional 4 attack frames

### Large monsters

- normal monster: `224x224`
- boss: `320x320`
- world boss: `384x384`

### Terrain tiles

- target tile size: `128x128`

### Environment props

- tree: `256x320`
- rock: `128x128`
- bush: `128x128`
- building: `320x320` to `448x384`

## Production workflow

1. Generate source sheets with MCP tools.
2. Generated PNGs get `meta.json` and an immediate pack pass automatically.
3. Review outputs manually.
4. Regenerate weak assets with stronger prompt overrides.
5. Pack approved outputs into final atlases.
6. Boot game and verify runtime is loading `manifest.json`.
7. Remove procedural fallback only after coverage is complete.

## Local smoke test

Use these commands before trying a real MCP-driven generation run.

```bash
npm run smoke:image-pipeline
npm run pack:assets
```

The smoke test verifies:

- ComfyUI connectivity at `COMFYUI_BASE_URL`
- workflow JSON presence and token replacement
- checkpoint/output prefix injection for all three workflow templates
- per-asset preset injection for width, height, steps, cfg, and negative prompt

If ComfyUI is not running on `http://127.0.0.1:8188`, the smoke test will fail with a connection error.

## Direct sample generation

If you want to validate ComfyUI without wiring an MCP client first, run one of these:

```bash
npm run generate:sample:character
npm run generate:sample:monster
npm run generate:sample:environment
npm run pack:assets
```

These scripts use the same workflow templates and prompt builders as the MCP server and save outputs under `client/assets/source/...`.

For a full Windows bring-up flow, see `docs/comfyui-windows-setup.md`.

## Metadata sync

Generated folders can be normalized back into packer-ready `meta.json` files with:

```bash
npm run sync:source-meta
```

This uses the same per-asset presets as the MCP server and direct generation scripts.

## Reality check

This pipeline makes the project ready for real art.

It does not create top-tier final art without:

- a real image generator
- manual curation
- repeated prompting
- cleanup for animation consistency

## Source folder contract

For best results, each generated source folder can include a `meta.json`.

### Character or monster folder

Example:

```json
{
  "kind": "directional",
  "src": "sheet.png",
  "frameWidth": 192,
  "frameHeight": 256,
  "framesPerDir": 4,
  "rows": [
    { "name": "down", "row": 0, "frames": 4 },
    { "name": "down_right", "row": 1, "frames": 4 },
    { "name": "right", "row": 2, "frames": 4 },
    { "name": "up_right", "row": 3, "frames": 4 },
    { "name": "up", "row": 4, "frames": 4 }
  ]
}
```

If `meta.json` is missing, the packer treats the first PNG in the folder as a one-frame placeholder sheet.

### Environment or tile folder

Example:

```json
{
  "assets": [
    { "key": "tree_oak", "src": "tree_oak.png", "width": 256, "height": 320 },
    { "key": "rock_gray", "src": "rock_gray.png", "width": 128, "height": 128 }
  ]
}
```
