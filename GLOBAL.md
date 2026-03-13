# Global Working Notes

## 2026-03-13

- New character flow now starts in `forest_of_words` at `(4500, 3600)` via `shared/constants.js`.
- Death respawn returns players to `starting_village` through `SPAWN_POINTS.TOWN_RESPAWN`.
- `server/game/GameWorld.js` guarantees a small starter monster cluster near the new-character spawn so first combat is immediate.
- `client/index.html` now supports:
  - remaster asset loading first, procedural sprite fallback second
  - right-click move / move-to-attack / move-to-pickup / move-to-NPC
  - `Space` can re-trigger nearest-monster targeting even during auto-attack
- Quiz flow is working as designed:
  - quiz appears only on the finishing blow, not on the first hit
  - wrong answers revive the monster at 30% HP
- Added local remaster asset pipeline:
  - docs: `docs/mcp-image-pipeline.md`, `docs/comfyui-windows-setup.md`
  - scripts: export / pack / smoke / sample generation / meta sync
  - MCP server: `tools/mcp-image-server`
- Current automated smoke tests:
  - `test_playwright.js`: register -> starter combat -> quiz -> result
  - `test_aggro.js`: starter combat smoke verifying player takes damage
- `screenshot_*.png` is ignored in `.gitignore` and should stay out of commits.
- Render deployment is Git-push driven via `render.yaml`; pushing `main` triggers deploy.
- ComfyUI smoke test can still fail if local ComfyUI is not running at `http://127.0.0.1:8188`; workflow validation itself was fine.
