import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("studio-site");
const packageRoot = resolve(".");
const manHuntRoot = resolve("../Man Hunt");
const manHuntSourceImage = join(manHuntRoot, "public", "assets", "characters", "source", "profile-character.png");
const manHuntModel = join(manHuntRoot, "public", "assets", "characters", "models", "profile-character.glb");
const manHuntGenerator = join(manHuntRoot, "tools", "generate_profile_model.py");
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
let manHuntGenerationInProgress = false;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const sceneSchema = {
  type: "object",
  additionalProperties: false,
  required: ["background", "frame", "layers"],
  properties: {
    background: { type: "string" },
    frame: { type: "number" },
    layers: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "type", "name", "x", "y", "scale", "rotation", "color", "visible", "keyframes"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["circle", "cloud", "rect", "character", "monster", "arena", "effect"] },
          name: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          scale: { type: "number" },
          rotation: { type: "number" },
          color: { type: "string" },
          visible: { type: "boolean" },
          keyframes: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["frame", "x", "y", "scale", "rotation"],
              properties: {
                frame: { type: "number" },
                x: { type: "number" },
                y: { type: "number" },
                scale: { type: "number" },
                rotation: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
};

function safePath(urlPath) {
  const requested = decodeURIComponent(urlPath.split("?")[0]).replace(/\\/g, "/");
  if (requested.startsWith("/vendor/three/")) {
    const vendorPath = requested.replace("/vendor/three/", "node_modules/three/");
    const filePath = resolve(join(packageRoot, vendorPath));
    return filePath.startsWith(resolve("node_modules/three")) ? filePath : null;
  }

  if (requested === "/generated/manhunt/profile-character.glb") {
    return manHuntModel;
  }

  const filePath = resolve(join(root, normalize(requested === "/" ? "index.html" : requested)));
  return filePath.startsWith(root) ? filePath : null;
}

function readJson(request) {
  return new Promise((resolveRequest, rejectRequest) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        request.destroy();
        rejectRequest(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolveRequest(body ? JSON.parse(body) : {});
      } catch {
        rejectRequest(new Error("Invalid JSON body"));
      }
    });
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function responseText(openaiResponse) {
  if (typeof openaiResponse.output_text === "string") return openaiResponse.output_text;

  return openaiResponse.output
    ?.flatMap((item) => item.content || [])
    .find((content) => content.type === "output_text")
    ?.text;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function normalizeColor(color, fallback = "#e85d3f") {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function normalizeScene(scene) {
  return {
    background: normalizeColor(scene.background, "#f3d7a1"),
    frame: 0,
    layers: scene.layers.map((layer, index) => ({
      id: String(layer.id || `${layer.type}-${index}`).replace(/[^a-z0-9_-]/gi, "-"),
      type: layer.type,
      name: String(layer.name || `Layer ${index + 1}`).slice(0, 48),
      x: clamp(layer.x, 0, 1280),
      y: clamp(layer.y, 0, 720),
      scale: clamp(layer.scale || 1, 0.2, 2.5),
      rotation: clamp(layer.rotation, -180, 180),
      color: normalizeColor(layer.color),
      visible: layer.visible !== false,
      keyframes: layer.keyframes.map((keyframe) => ({
        frame: Math.round(clamp(keyframe.frame, 0, 144)),
        x: clamp(keyframe.x, 0, 1280),
        y: clamp(keyframe.y, 0, 720),
        scale: clamp(keyframe.scale || 1, 0.2, 2.5),
        rotation: clamp(keyframe.rotation, -180, 180),
      })),
    })),
  };
}

function manHuntStatus() {
  const hunyuanRepo = join(manHuntRoot, "tools", "Hunyuan3D-2");
  const sourceReady = existsSync(manHuntSourceImage);
  const modelReady = existsSync(manHuntModel);
  const repoReady = existsSync(hunyuanRepo);
  const available = repoReady;

  return {
    sourceImageExists: sourceReady,
    modelExists: modelReady,
    generationInProgress: manHuntGenerationInProgress,
    hunyuanRepoExists: repoReady,
    available,
    reason: available
      ? null
      : "Hunyuan3D is not installed in ../Man Hunt/tools/Hunyuan3D-2, and Python dependencies are missing.",
    modelUrl: modelReady ? `/generated/manhunt/profile-character.glb?v=${Date.now()}` : null,
  };
}

function saveManHuntSource(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/i.exec(dataUrl || "");
  if (!match) {
    throw new Error("Only PNG image uploads are supported right now.");
  }

  mkdirSync(join(manHuntRoot, "public", "assets", "characters", "source"), { recursive: true });
  mkdirSync(join(manHuntRoot, "public", "assets", "characters", "models"), { recursive: true });
  writeFileSync(manHuntSourceImage, Buffer.from(match[1], "base64"));
}

function runManHuntGenerator() {
  const python = process.env.MANHUNT_PYTHON || process.env.PYTHON || "python3";

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(python, [manHuntGenerator], {
      cwd: manHuntRoot,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }

      rejectRun(new Error(stderr || stdout || `Man Hunt generator exited with code ${code}`));
    });
  });
}

async function uploadManHuntCharacter(request, response) {
  const { dataUrl } = await readJson(request);
  saveManHuntSource(dataUrl);
  sendJson(response, 200, {
    ok: true,
    message: "Character image uploaded to Man Hunt generator.",
    status: manHuntStatus(),
  });
}

async function generateManHuntCharacter(_request, response) {
  if (manHuntGenerationInProgress) {
    sendJson(response, 409, {
      ok: false,
      message: "Man Hunt character generation is already running.",
      status: manHuntStatus(),
    });
    return;
  }

  if (!existsSync(manHuntSourceImage)) {
    sendJson(response, 400, {
      ok: false,
      message: "Upload a PNG character image first.",
      status: manHuntStatus(),
    });
    return;
  }

  const status = manHuntStatus();
  if (!status.available) {
    sendJson(response, 503, {
      ok: false,
      message: status.reason,
      status,
    });
    return;
  }

  manHuntGenerationInProgress = true;

  try {
    const result = await runManHuntGenerator();
    manHuntGenerationInProgress = false;
    sendJson(response, 200, {
      ok: true,
      message: "Man Hunt 3D character generation finished.",
      ...result,
      status: manHuntStatus(),
    });
  } catch (error) {
    manHuntGenerationInProgress = false;
    sendJson(response, 500, {
      ok: false,
      message: error.message || "Man Hunt 3D character generation failed.",
      status: manHuntStatus(),
    });
  }
}

async function generateScene(request, response) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 503, {
      error: "OPENAI_API_KEY is not set. Using the browser fallback generator.",
    });
    return;
  }

  const { prompt } = await readJson(request);

  if (!prompt || typeof prompt !== "string") {
    sendJson(response, 400, { error: "A prompt string is required." });
    return;
  }

  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.2",
      input: [
        {
          role: "system",
          content:
            "Create a compact 2.5D animated scene plan for a browser canvas prototype. Use only supported layer types: circle, cloud, rect, character, monster, arena, effect. Coordinates are in a 1280 by 720 scene. For battle prompts, create a small creature-battle arena with two semi-realistic monster layers facing each other, simple lunge keyframes, and at least one effect layer for an attack impact. Keep scenes readable, cinematic, slightly realistic, richly lit, and easy to edit. Do not use copyrighted character names.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_output_tokens: 2500,
      text: {
        format: {
          type: "json_schema",
          name: "animated_scene",
          strict: true,
          schema: sceneSchema,
        },
      },
    }),
  });

  const payload = await apiResponse.json();

  if (!apiResponse.ok) {
    sendJson(response, apiResponse.status, {
      error: payload.error?.message || "OpenAI request failed.",
    });
    return;
  }

  const text = responseText(payload);
  const scene = normalizeScene(JSON.parse(text));
  sendJson(response, 200, { source: "openai", scene });
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/manhunt/status") {
    sendJson(response, 200, manHuntStatus());
    return;
  }

  if (request.method === "POST" && request.url === "/api/manhunt/upload-character") {
    uploadManHuntCharacter(request, response).catch((error) => {
      sendJson(response, 400, { ok: false, message: error.message || "Upload failed.", status: manHuntStatus() });
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/manhunt/generate-character") {
    generateManHuntCharacter(request, response).catch((error) => {
      sendJson(response, 500, { ok: false, message: error.message || "Generation failed.", status: manHuntStatus() });
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate-scene") {
    generateScene(request, response).catch((error) => {
      sendJson(response, 500, { error: error.message || "Scene generation failed." });
    });
    return;
  }

  const filePath = safePath(request.url || "/");

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const stats = statSync(filePath);
    const finalPath = stats.isDirectory() ? join(filePath, "index.html") : filePath;

    response.writeHead(200, {
      "Content-Type": contentTypes[extname(finalPath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(finalPath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.on("error", (error) => {
  console.error(`Could not start local server on ${host}:${port}`);
  console.error(error.message);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`Production Studio prototype running at http://${host}:${port}`);
});
