# MCP Image Server

This is a scaffold for connecting a local image generator such as ComfyUI to RuneWord Chronicle.

## Expected local services

- ComfyUI at `http://127.0.0.1:8188`

## Expected env vars

```text
COMFYUI_BASE_URL=http://127.0.0.1:8188
COMFYUI_CHECKPOINT=model.safetensors
PROJECT_ROOT=D:\iwruneword
```

## Suggested MCP config

```json
{
  "mcpServers": {
    "iwruneword-image": {
      "command": "node",
      "args": ["D:/iwruneword/tools/mcp-image-server/src/index.mjs"],
      "env": {
        "COMFYUI_BASE_URL": "http://127.0.0.1:8188",
        "COMFYUI_CHECKPOINT": "model.safetensors",
        "PROJECT_ROOT": "D:/iwruneword"
      }
    }
  }
}
```

## Current state

This folder now includes base workflow templates in `workflows/` for:

- `character-sheet.json`
- `monster-sheet.json`
- `environment-set.json`

Each template uses placeholder tokens for prompt, seed, checkpoint, and output prefix.

You still need:

- to swap `model.safetensors` for a real installed checkpoint
- workflow tuning for your exact model and LoRA stack
- prompt tuning per asset family
