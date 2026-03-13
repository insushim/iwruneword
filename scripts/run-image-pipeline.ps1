param(
  [string]$ComfyUiBaseUrl = "http://127.0.0.1:8188",
  [string]$Checkpoint = "model.safetensors",
  [ValidateSet("character", "monster", "environment")]
  [string]$Target = "character",
  [switch]$PackAfterGenerate
)

$ErrorActionPreference = "Stop"

$env:COMFYUI_BASE_URL = $ComfyUiBaseUrl
$env:COMFYUI_CHECKPOINT = $Checkpoint
$env:PROJECT_ROOT = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

Write-Host "PROJECT_ROOT=$env:PROJECT_ROOT"
Write-Host "COMFYUI_BASE_URL=$env:COMFYUI_BASE_URL"
Write-Host "COMFYUI_CHECKPOINT=$env:COMFYUI_CHECKPOINT"

Write-Host ""
Write-Host "[1/3] Smoke test"
npm run smoke:image-pipeline

Write-Host ""
Write-Host "[2/3] Generate sample asset: $Target"
switch ($Target) {
  "character" { npm run generate:sample:character }
  "monster" { npm run generate:sample:monster }
  "environment" { npm run generate:sample:environment }
}

if ($PackAfterGenerate) {
  Write-Host ""
  Write-Host "[3/3] Pack generated assets"
  npm run pack:assets
}
