# ComfyUI Windows Setup

## Goal

Bring up a local ComfyUI instance on Windows and run this repo's sample asset pipeline end to end.

## Assumptions

- project root is `D:\iwruneword`
- Python is available on the machine
- GPU drivers and CUDA stack are already in a usable state for your ComfyUI build

## 1. Install or locate ComfyUI

If ComfyUI is not already on the machine, clone it somewhere stable such as:

```powershell
cd D:\
git clone https://github.com/comfyanonymous/ComfyUI.git
cd D:\ComfyUI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If you already have ComfyUI, just note its absolute path.

## 2. Put a checkpoint in place

Copy a model checkpoint into ComfyUI's `models\checkpoints` folder.

Example:

```text
D:\ComfyUI\models\checkpoints\sdxl_turbo.safetensors
```

Use the exact filename as `COMFYUI_CHECKPOINT`.

## 3. Start ComfyUI

Example:

```powershell
cd D:\ComfyUI
.\.venv\Scripts\Activate.ps1
python main.py --listen 127.0.0.1 --port 8188
```

When it is ready, this URL should respond:

```text
http://127.0.0.1:8188/system_stats
```

## 4. Run the repo smoke test

In a second terminal:

```powershell
cd D:\iwruneword
$env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
$env:COMFYUI_CHECKPOINT = "sdxl_turbo.safetensors"
npm run smoke:image-pipeline
```

Expected result:

- connection succeeds
- all three workflow templates compile

## 5. Generate one sample and pack it

Fast path:

```powershell
cd D:\iwruneword
.\scripts\run-image-pipeline.ps1 -Checkpoint "sdxl_turbo.safetensors" -Target character -PackAfterGenerate
```

Manual path:

```powershell
cd D:\iwruneword
$env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
$env:COMFYUI_CHECKPOINT = "sdxl_turbo.safetensors"
npm run generate:sample:character
npm run pack:assets
```

Generated source files land under:

```text
client\assets\source\characters\player_warrior\
```

Packed outputs land under:

```text
client\assets\remaster\
```

## 6. Optional MCP server

After direct generation works, start the MCP bridge:

```powershell
cd D:\iwruneword
$env:COMFYUI_BASE_URL = "http://127.0.0.1:8188"
$env:COMFYUI_CHECKPOINT = "sdxl_turbo.safetensors"
$env:PROJECT_ROOT = "D:\iwruneword"
npm run mcp:image-server
```

## Failure cases

- `fetch failed`
  ComfyUI is not running, bound to a different port, or blocked by local firewall.

- `Missing workflow`
  The repo is missing files under `tools\mcp-image-server\workflows`.

- `ComfyUI prompt failed: HTTP 400`
  The checkpoint name is wrong or the workflow nodes are incompatible with your installed ComfyUI/custom nodes.

- images save but pack output is empty
  The generated folder does not contain PNGs where the packer expects them, or the folder layout does not match `client\assets\source\...`.
