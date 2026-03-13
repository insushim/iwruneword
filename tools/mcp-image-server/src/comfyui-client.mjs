import fs from "fs";
import path from "path";

export async function submitPrompt(baseUrl, workflow) {
  const res = await fetch(`${baseUrl}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: workflow })
  });
  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(`ComfyUI prompt failed: HTTP ${res.status}${details ? ` - ${details}` : ""}`);
  }
  return res.json();
}

export async function getHistory(baseUrl, promptId) {
  const res = await fetch(`${baseUrl}/history/${promptId}`);
  if (!res.ok) throw new Error(`ComfyUI history failed: HTTP ${res.status}`);
  return res.json();
}

export async function waitForImages(baseUrl, promptId, timeoutMs = 1200000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const history = await getHistory(baseUrl, promptId);
    const data = history[promptId];
    if (data && data.outputs) return data.outputs;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Timed out waiting for ComfyUI prompt ${promptId}`);
}

export async function downloadImage(baseUrl, image, targetPath) {
  const url = new URL(`${baseUrl}/view`);
  url.searchParams.set("filename", image.filename);
  if (image.subfolder) url.searchParams.set("subfolder", image.subfolder);
  if (image.type) url.searchParams.set("type", image.type);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, bytes);
  return targetPath;
}
