import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#threeStage");
const status = document.querySelector("#threeStatus");
const generateButton = document.querySelector("#generate3dBattle");
const randomizeButton = document.querySelector("#randomize3d");
const fightButton = document.querySelector("#fight3d");
const promptInput = document.querySelector("#threePrompt");
const characterCanvas = document.querySelector("#characterCanvas");
const characterPrompt = document.querySelector("#characterPrompt");
const characterColor = document.querySelector("#characterColor");
const drawCharacterPngButton = document.querySelector("#drawCharacterPng");
const clearCharacterPngButton = document.querySelector("#clearCharacterPng");
const saveCharacterCardButton = document.querySelector("#saveCharacterCard");
const randomCharacterCardButton = document.querySelector("#randomCharacterCard");
const placePngLeftButton = document.querySelector("#placePngLeft");
const placePngRightButton = document.querySelector("#placePngRight");
const characterLibrary = document.querySelector("#characterLibrary");
const outfitLibrary = document.querySelector("#outfitLibrary");
const leftSlotName = document.querySelector("#leftSlotName");
const rightSlotName = document.querySelector("#rightSlotName");
const generatorStatus = document.querySelector("#generatorStatus");
const manhuntPngFile = document.querySelector("#manhuntPngFile");
const generateManhuntLeft = document.querySelector("#generateManhuntLeft");
const generateManhuntRight = document.querySelector("#generateManhuntRight");
const leftModelFile = document.querySelector("#leftModelFile");
const rightModelFile = document.querySelector("#rightModelFile");
const characterContext = characterCanvas.getContext("2d");
let drawingCharacter = false;
let selectedCharacterId = null;
const characterCards = [];
const outfitAssets = [
  { name: "Male Ranger", url: "/assets/modular-character-outfits/Outfits/Male_Ranger.gltf" },
  { name: "Female Ranger", url: "/assets/modular-character-outfits/Outfits/Female_Ranger.gltf" },
  { name: "Male Peasant", url: "/assets/modular-character-outfits/Outfits/Male_Peasant.gltf" },
  { name: "Female Peasant", url: "/assets/modular-character-outfits/Outfits/Female_Peasant.gltf" },
];

setStatus("Three.js loaded locally. Building 3D scene...");

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc7e8);
scene.fog = new THREE.FogExp2(0x9fc7e8, 0.032);
scene.environment = makeStudioEnvironment();

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 140);
camera.position.set(0, 5.4, 10.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.target.set(0, 1.4, 0);
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 5.8;
controls.maxDistance = 17;

const loader = new GLTFLoader();
const clock = new THREE.Clock();
const mixers = [];
const imported = {
  left: null,
  right: null,
};
const procedural = {
  left: null,
  right: null,
  arena: null,
  environment: null,
  sparks: [],
};

function setStatus(message) {
  status.textContent = message;
}

async function refreshGeneratorStatus() {
  try {
    const response = await fetch("/api/manhunt/status");
    const payload = await response.json();
    generatorStatus.textContent = payload.available
      ? "Ready. Man Hunt generator dependencies look available."
      : `Setup required: ${payload.reason || "Man Hunt generator is not ready."}`;
  } catch (error) {
    generatorStatus.textContent = `Could not check generator setup: ${error.message}`;
  }
}

function mat(color, roughness = 0.78, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function makeStudioEnvironment() {
  const renderTarget = new THREE.WebGLCubeRenderTarget(128);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x9fc7e8);

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-1, 2, 1);
  envScene.add(light);
  envScene.add(new THREE.HemisphereLight(0xbfdfff, 0x5a4634, 2.5));

  const cubeCamera = new THREE.CubeCamera(0.1, 100, renderTarget);
  cubeCamera.update(new THREE.WebGLRenderer(), envScene);
  return renderTarget.texture;
}

function makeFurMaterial(color, accent) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.24,
    flatShading: false,
    vertexColors: false,
    emissive: new THREE.Color(accent).multiplyScalar(0.025),
  });
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function paletteFromPrompt(prompt = "") {
  const text = prompt.toLowerCase();
  const night = includesAny(text, ["night", "dark", "moon", "shadow"]);
  const forest = includesAny(text, ["forest", "jungle", "grass", "nature"]);
  const desert = includesAny(text, ["desert", "sand", "canyon"]);
  const ice = includesAny(text, ["ice", "snow", "frost", "winter"]);
  const fire = includesAny(text, ["fire", "flame", "lava", "red"]);
  const electric = includesAny(text, ["electric", "lightning", "spark", "yellow"]);
  const water = includesAny(text, ["water", "ocean", "blue"]);
  const poison = includesAny(text, ["poison", "purple", "toxic"]);

  const left = electric ? 0xf0d43a : fire ? 0xe85d3f : poison ? 0x7751c7 : 0x4e6ee8;
  const leftAccent = electric ? 0xfff0a3 : fire ? 0xffc2a8 : poison ? 0xd9c8ff : 0xbcc9ff;
  const right = water ? 0x2d8fb8 : fire ? 0xd8903d : ice ? 0x94d9ff : 0x4fba69;
  const rightAccent = water ? 0xb8edf6 : fire ? 0xffd39b : ice ? 0xe4f8ff : 0xc7f0bd;

  return {
    arena: desert ? 0xc49a5a : ice ? 0x9ccdd6 : forest ? 0x65a85c : 0x8db06d,
    background: night ? 0x101827 : ice ? 0xd8edf4 : desert ? 0xe0b270 : 0x9fc7e8,
    fog: night ? 0x101827 : ice ? 0xd8edf4 : desert ? 0xe0b270 : 0x9fc7e8,
    spark: electric ? 0xffdd55 : fire ? 0xff6b35 : ice ? 0xb9f2ff : 0xffdd55,
    left,
    leftAccent,
    right,
    rightAccent,
    forest,
    desert,
    ice,
    night,
  };
}

function addLightRig() {
  const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x5a4938, 1.2);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1ce, 5.5);
  key.position.set(-5.5, 9, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -10;
  key.shadow.camera.right = 10;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x86bfff, 2.6);
  rim.position.set(5, 4, -7);
  scene.add(rim);

  const fill = new THREE.RectAreaLight(0xffd6a3, 3.2, 5, 4);
  fill.position.set(0, 4, 4);
  fill.lookAt(0, 1.2, 0);
  scene.add(fill);

  const impact = new THREE.PointLight(0xffd34e, 9, 7, 1.6);
  impact.position.set(0, 1.8, 0.2);
  scene.add(impact);
  procedural.impactLight = impact;
}

function roundedScale(mesh, x, y, z) {
  mesh.scale.set(x, y, z);
  return mesh;
}

function makeCreature(color, accent, side = 1) {
  const group = new THREE.Group();
  group.userData.homeX = side * -2.8;
  group.userData.side = side;
  group.userData.imported = false;
  group.position.set(group.userData.homeX, 0, 0.55);
  group.rotation.y = side > 0 ? Math.PI * 0.26 : -Math.PI * 0.26;

  const bodyMaterial = makeFurMaterial(color, accent);
  const accentMaterial = mat(accent, 0.82);
  const darkMaterial = mat(0x16120f, 0.9);
  const ivoryMaterial = mat(0xf8ead0, 0.62);

  const body = roundedScale(new THREE.Mesh(new THREE.SphereGeometry(0.88, 48, 32), bodyMaterial), 0.92, 1.18, 0.76);
  body.position.y = 1.18;
  body.castShadow = true;
  group.add(body);
  addSurfaceDetail(group, color, side);

  const belly = roundedScale(new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 20), accentMaterial), 0.72, 0.92, 0.2);
  belly.position.set(0.22 * side, 1.05, 0.66);
  belly.castShadow = true;
  group.add(belly);

  const head = roundedScale(new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 28), bodyMaterial), 1.04, 0.9, 0.86);
  head.position.set(0.36 * side, 2.2, 0.18);
  head.castShadow = true;
  group.add(head);

  const snout = roundedScale(new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 18), accentMaterial), 0.95, 0.62, 0.72);
  snout.position.set(0.78 * side, 2.08, 0.34);
  snout.castShadow = true;
  group.add(snout);

  [-0.22, 0.22].forEach((z) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), darkMaterial);
    eye.position.set(0.92 * side, 2.28, z + 0.22);
    group.add(eye);
  });

  [-0.28, 0.28].forEach((z) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.58, 4), bodyMaterial);
    ear.position.set(0.22 * side, 2.72, z);
    ear.rotation.z = side * -0.35;
    ear.rotation.x = z > 0 ? 0.22 : -0.22;
    ear.castShadow = true;
    group.add(ear);
  });

  for (let i = 0; i < 7; i += 1) {
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 8), accentMaterial);
    spine.position.set(-0.36 * side, 1.72 - i * 0.17, -0.04);
    spine.rotation.z = side * -0.9;
    spine.castShadow = true;
    group.add(spine);
  }

  [-0.34, 0.34].forEach((z) => {
    const arm = roundedScale(new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), bodyMaterial), 0.7, 1.35, 0.68);
    arm.position.set(0.62 * side, 1.34, z);
    arm.rotation.z = side * -0.7;
    arm.castShadow = true;
    group.add(arm);

    const leg = roundedScale(new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), bodyMaterial), 1.15, 0.54, 0.8);
    leg.position.set(-0.28 * side, 0.42, z);
    leg.castShadow = true;
    group.add(leg);
  });

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.15, 18), bodyMaterial);
  tail.position.set(-0.86 * side, 1.05, -0.1);
  tail.rotation.z = side * 1.26;
  tail.rotation.x = -0.2;
  tail.castShadow = true;
  group.add(tail);

  for (let index = 0; index < 3; index += 1) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 10), ivoryMaterial);
    tooth.position.set(1.08 * side, 1.92, -0.14 + index * 0.14);
    tooth.rotation.z = Math.PI;
    group.add(tooth);
  }

  const shadow = roundedScale(new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  })), 1.35, 0.46, 1);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  return group;
}

function clearCharacterCanvas() {
  characterContext.clearRect(0, 0, characterCanvas.width, characterCanvas.height);
}

function currentCharacterName() {
  return characterPrompt.value.trim() || "Untitled Creature";
}

function drawQuickPngCharacter() {
  const prompt = characterPrompt.value.toLowerCase();
  const color = characterColor.value;
  const accent = prompt.includes("fire") ? "#ffb15c" : prompt.includes("ice") ? "#b8edf6" : prompt.includes("shadow") ? "#2a2435" : "#f8ead0";

  clearCharacterCanvas();
  characterContext.save();
  characterContext.translate(256, 272);

  const bodyGradient = characterContext.createRadialGradient(-60, -110, 20, 0, 0, 190);
  bodyGradient.addColorStop(0, "#ffffff");
  bodyGradient.addColorStop(0.18, color);
  bodyGradient.addColorStop(1, "#191612");
  characterContext.fillStyle = bodyGradient;
  characterContext.beginPath();
  characterContext.ellipse(0, 20, 118, 154, 0, 0, Math.PI * 2);
  characterContext.fill();

  characterContext.fillStyle = accent;
  characterContext.globalAlpha = 0.76;
  characterContext.beginPath();
  characterContext.ellipse(34, 46, 58, 88, -0.15, 0, Math.PI * 2);
  characterContext.fill();
  characterContext.globalAlpha = 1;

  characterContext.fillStyle = color;
  characterContext.beginPath();
  characterContext.ellipse(30, -130, 92, 78, 0.05, 0, Math.PI * 2);
  characterContext.fill();

  characterContext.fillStyle = "#f8ead0";
  characterContext.beginPath();
  characterContext.ellipse(62, -146, 24, 28, 0, 0, Math.PI * 2);
  characterContext.fill();
  characterContext.fillStyle = "#17130f";
  characterContext.beginPath();
  characterContext.arc(70, -146, 9, 0, Math.PI * 2);
  characterContext.fill();

  characterContext.fillStyle = "#f8ead0";
  if (prompt.includes("horn") || prompt.includes("demon") || prompt.includes("beast")) {
    characterContext.beginPath();
    characterContext.moveTo(-32, -190);
    characterContext.lineTo(-6, -252);
    characterContext.lineTo(18, -184);
    characterContext.moveTo(52, -190);
    characterContext.lineTo(98, -244);
    characterContext.lineTo(90, -170);
    characterContext.fill();
  }

  characterContext.strokeStyle = color;
  characterContext.lineWidth = 30;
  characterContext.lineCap = "round";
  characterContext.beginPath();
  characterContext.moveTo(-82, 12);
  characterContext.quadraticCurveTo(-146, 42, -170, 112);
  characterContext.moveTo(82, 12);
  characterContext.quadraticCurveTo(150, 28, 176, 100);
  characterContext.moveTo(-46, 142);
  characterContext.lineTo(-86, 206);
  characterContext.moveTo(48, 142);
  characterContext.lineTo(98, 206);
  characterContext.stroke();

  characterContext.strokeStyle = "#17130f";
  characterContext.lineWidth = 8;
  characterContext.beginPath();
  characterContext.moveTo(36, -94);
  characterContext.quadraticCurveTo(70, -72, 106, -92);
  characterContext.stroke();

  characterContext.restore();
}

function randomizeCharacterPrompt() {
  const species = ["fire lizard", "crystal wolf", "shadow beast", "blue horned alien", "moss turtle", "electric rabbit", "ice dragon", "forest goblin"];
  const colors = ["#e85d3f", "#4e6ee8", "#7751c7", "#4fba69", "#f0d43a", "#2d8fb8"];
  characterPrompt.value = species[Math.floor(Math.random() * species.length)];
  characterColor.value = colors[Math.floor(Math.random() * colors.length)];
  drawQuickPngCharacter();
  saveCharacterCard();
}

function drawOnCharacterCanvas(event) {
  if (!drawingCharacter) return;

  const rect = characterCanvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * characterCanvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * characterCanvas.height;

  characterContext.fillStyle = characterColor.value;
  characterContext.beginPath();
  characterContext.arc(x, y, 14, 0, Math.PI * 2);
  characterContext.fill();
}

function characterCanvasDataUrl() {
  return characterCanvas.toDataURL("image/png");
}

function saveCharacterCard() {
  const card = {
    id: `char-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: currentCharacterName(),
    dataUrl: characterCanvasDataUrl(),
  };
  characterCards.unshift(card);
  selectedCharacterId = card.id;
  renderCharacterLibrary();
  setStatus(`Saved character "${card.name}". Assign it to left or right.`);
}

function selectedCharacter() {
  return characterCards.find((card) => card.id === selectedCharacterId) || null;
}

function loadCharacterIntoCanvas(card) {
  const image = new Image();
  image.addEventListener("load", () => {
    clearCharacterCanvas();
    characterContext.drawImage(image, 0, 0, characterCanvas.width, characterCanvas.height);
  });
  image.src = card.dataUrl;
  characterPrompt.value = card.name;
}

function renderCharacterLibrary() {
  characterLibrary.innerHTML = "";

  if (!characterCards.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No saved characters yet. Quick Draw, then Save Character.";
    characterLibrary.append(empty);
    return;
  }

  characterCards.forEach((card) => {
    const item = document.createElement("div");
    item.className = `character-card ${card.id === selectedCharacterId ? "selected" : ""}`;
    item.innerHTML = `
      <img src="${card.dataUrl}" alt="${card.name}" />
      <strong>${card.name}</strong>
      <div class="card-actions">
        <button data-action="left">Left</button>
        <button data-action="right">Right</button>
      </div>
    `;

    item.addEventListener("click", () => {
      selectedCharacterId = card.id;
      loadCharacterIntoCanvas(card);
      renderCharacterLibrary();
    });
    item.querySelector('[data-action="left"]').addEventListener("click", (event) => {
      event.stopPropagation();
      placeSavedCharacter(card, "left");
    });
    item.querySelector('[data-action="right"]').addEventListener("click", (event) => {
      event.stopPropagation();
      placeSavedCharacter(card, "right");
    });
    characterLibrary.append(item);
  });
}

function renderOutfitLibrary() {
  outfitLibrary.innerHTML = "";
  outfitAssets.forEach((asset) => {
    const item = document.createElement("div");
    item.className = "asset-card";
    item.innerHTML = `
      <div class="asset-preview">3D<br />${asset.name}</div>
      <strong>${asset.name}</strong>
      <div class="card-actions">
        <button data-action="left">Left</button>
        <button data-action="right">Right</button>
      </div>
    `;
    item.querySelector('[data-action="left"]').addEventListener("click", () => placeOutfitAsset(asset, "left"));
    item.querySelector('[data-action="right"]').addEventListener("click", () => placeOutfitAsset(asset, "right"));
    outfitLibrary.append(item);
  });
}

function makePngBillboard(dataUrl, sideName) {
  const texture = new THREE.TextureLoader().load(dataUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.imported = true;
  mesh.userData.homeX = sideName === "left" ? -2.8 : 2.8;
  mesh.userData.baseY = 0.95;
  mesh.position.set(mesh.userData.homeX, mesh.userData.baseY, 0.55);
  mesh.rotation.y = sideName === "left" ? Math.PI * 0.16 : -Math.PI * 0.16;
  return mesh;
}

function placePngBillboard(sideName) {
  const card = selectedCharacter();
  const dataUrl = card?.dataUrl || characterCanvasDataUrl();
  const target = sideName === "left" ? procedural.left : procedural.right;
  if (target) scene.remove(target);

  const model = makePngBillboard(dataUrl, sideName);
  scene.add(model);

  if (sideName === "left") {
    procedural.left = model;
    imported.left = model;
    leftSlotName.textContent = card?.name || currentCharacterName();
  } else {
    procedural.right = model;
    imported.right = model;
    rightSlotName.textContent = card?.name || currentCharacterName();
  }

  setStatus(`PNG character placed in the ${sideName} fighter slot. Use Generate ${sideName === "left" ? "Left" : "Right"} to turn it into 3D if Man Hunt is installed.`);
}

function placeSavedCharacter(card, sideName) {
  selectedCharacterId = card.id;
  loadCharacterIntoCanvas(card);
  renderCharacterLibrary();

  const target = sideName === "left" ? procedural.left : procedural.right;
  if (target) scene.remove(target);

  const model = makePngBillboard(card.dataUrl, sideName);
  scene.add(model);

  if (sideName === "left") {
    procedural.left = model;
    imported.left = model;
    leftSlotName.textContent = card.name;
  } else {
    procedural.right = model;
    imported.right = model;
    rightSlotName.textContent = card.name;
  }

  setStatus(`Assigned "${card.name}" to the ${sideName} slot.`);
}

function addSurfaceDetail(group, color, side) {
  const spotMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).offsetHSL(0.03, -0.05, -0.18),
    roughness: 0.95,
  });

  for (let i = 0; i < 12; i += 1) {
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.055 + (i % 3) * 0.018, 12), spotMaterial);
    spot.position.set(
      (-0.18 + (i % 4) * 0.12) * side,
      0.72 + Math.floor(i / 4) * 0.34,
      0.68
    );
    spot.rotation.y = side * 0.1;
    spot.castShadow = false;
    group.add(spot);
  }
}

function makeArena(color = 0x6fa05c) {
  const group = new THREE.Group();

  const groundTexture = makeGroundTexture(color);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.96,
    metalness: 0,
    map: groundTexture,
  });
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.8, 0.38, 128), groundMaterial);
  ground.receiveShadow = true;
  ground.position.y = -0.2;
  group.add(ground);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.72, 0.045, 10, 128), mat(0xf6f1df, 0.5));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  ring.receiveShadow = true;
  group.add(ring);

  const center = new THREE.Mesh(new THREE.CircleGeometry(1.04, 96), new THREE.MeshStandardMaterial({
    color: 0xe9e0c8,
    roughness: 0.72,
    metalness: 0,
    side: THREE.DoubleSide,
  }));
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.025;
  center.receiveShadow = true;
  group.add(center);

  for (let i = 0; i < 26; i += 1) {
    const rock = roundedScale(new THREE.Mesh(new THREE.DodecahedronGeometry(0.08 + (i % 3) * 0.025), mat(0x7b765d)), 1, 0.55, 0.8);
    const angle = i * 2.4;
    const radius = 4.2 + (i % 5) * 0.18;
    rock.position.set(Math.cos(angle) * radius, 0.06, Math.sin(angle) * radius * 0.62);
    rock.rotation.set(i * 0.7, i * 0.2, i * 0.4);
    rock.castShadow = true;
    group.add(rock);
  }

  return group;
}

function makeGroundTexture(baseColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const base = new THREE.Color(baseColor);
  context.fillStyle = `#${base.getHexString()}`;
  context.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2200; i += 1) {
    const shade = Math.random() * 32 - 16;
    const r = Math.max(0, Math.min(255, base.r * 255 + shade));
    const g = Math.max(0, Math.min(255, base.g * 255 + shade));
    const b = Math.max(0, Math.min(255, base.b * 255 + shade));
    context.fillStyle = `rgba(${r},${g},${b},${0.08 + Math.random() * 0.16})`;
    context.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 4, 1 + Math.random() * 4);
  }

  for (let i = 0; i < 42; i += 1) {
    context.strokeStyle = `rgba(30,26,22,${0.04 + Math.random() * 0.05})`;
    context.lineWidth = 1 + Math.random() * 2;
    context.beginPath();
    context.moveTo(Math.random() * 512, Math.random() * 512);
    context.quadraticCurveTo(Math.random() * 512, Math.random() * 512, Math.random() * 512, Math.random() * 512);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  return texture;
}

function makeEnvironment(options = paletteFromPrompt("")) {
  const back = new THREE.Group();
  const treeColor = options.ice ? 0xaed7dd : options.desert ? 0x89714d : 0x5d864f;
  const trunkColor = options.desert ? 0x8c6a45 : 0x6f4b34;

  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(55, 32, 16),
    new THREE.MeshBasicMaterial({
      color: options.night ? 0x101827 : options.desert ? 0xd7a76d : 0xa9cdea,
      side: THREE.BackSide,
      fog: false,
    })
  );
  skyDome.position.y = 3;
  back.add(skyDome);

  for (let i = 0; i < 18; i += 1) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.95, 7), mat(trunkColor));
    const crown = roundedScale(new THREE.Mesh(new THREE.ConeGeometry(0.44, 1.25, 7), mat(i % 2 ? treeColor : 0x476c45)), 1, 1, 1);
    const x = -9 + i;
    const z = -6.6 - (i % 4) * 0.6;
    trunk.position.set(x, 0.42, z);
    crown.position.set(x, 1.32, z);
    trunk.castShadow = true;
    crown.castShadow = true;
    back.add(trunk, crown);
  }

  for (let i = 0; i < 34; i += 1) {
    const grass = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.34 + Math.random() * 0.22, 5), mat(options.desert ? 0x8c784b : 0x4f7d3d));
    const angle = i * 2.09;
    const radius = 3.9 + (i % 8) * 0.28;
    grass.position.set(Math.cos(angle) * radius, 0.13, Math.sin(angle) * radius * 0.65);
    grass.rotation.z = Math.sin(i) * 0.35;
    grass.castShadow = true;
    back.add(grass);
  }

  for (let i = 0; i < 10; i += 1) {
    const hill = roundedScale(new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 12), mat(options.desert ? 0xb8874f : 0x6e8d72)), 1.7, 0.42, 0.54);
    hill.position.set(-7 + i * 1.65, 0.1, -9 - (i % 2));
    back.add(hill);
  }

  procedural.environment = back;
  scene.add(back);
}

function makeSparks() {
  const sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd55 });

  for (let i = 0; i < 28; i += 1) {
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), sparkMaterial);
    spark.userData.angle = i * 0.9;
    spark.userData.speed = 0.7 + (i % 5) * 0.15;
    spark.position.set(0, 1.8, 0.28);
    scene.add(spark);
    procedural.sparks.push(spark);
  }
}

function clearBattle() {
  [procedural.left, procedural.right, procedural.arena, procedural.environment].forEach((object) => {
    if (object) scene.remove(object);
  });
  procedural.left = null;
  procedural.right = null;
  procedural.arena = null;
  procedural.environment = null;
  imported.left = null;
  imported.right = null;
  mixers.length = 0;
}

function generateBattle(prompt = "") {
  clearBattle();
  const palette = prompt ? paletteFromPrompt(prompt) : paletteFromPrompt([
    "electric forest",
    "fire desert",
    "ice night",
    "water arena",
  ][Math.floor(Math.random() * 4)]);

  scene.background = new THREE.Color(palette.background);
  scene.fog.color = new THREE.Color(palette.fog);
  procedural.sparks.forEach((spark) => {
    spark.material.color.setHex(palette.spark);
  });
  procedural.impactLight.color.setHex(palette.spark);

  makeEnvironment(palette);
  procedural.arena = makeArena(palette.arena);
  procedural.left = makeCreature(palette.left, palette.leftAccent, 1);
  procedural.right = makeCreature(palette.right, palette.rightAccent, -1);

  scene.add(procedural.arena, procedural.left, procedural.right);
  setStatus(prompt ? "3D scene created from your prompt. Drag to orbit." : "3D battle generated. Drag to orbit. Import Quaternius .glb models when ready.");
}

async function importGlb(file, side) {
  if (!file) return;
  const url = URL.createObjectURL(file);

  try {
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const target = side === "left" ? procedural.left : procedural.right;
    if (target) scene.remove(target);

    prepareImportedModel(model, side);

    scene.add(model);
    if (side === "left") {
      procedural.left = model;
      imported.left = model;
    } else {
      procedural.right = model;
      imported.right = model;
    }

    gltf.animations.slice(0, 2).forEach((clip) => {
      const mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip);
      action.fadeIn(0.2);
      action.play();
      mixers.push(mixer);
    });

    setStatus(`Imported ${file.name}. Click "Fight Imported Characters" after both sides are loaded.`);
  } catch (error) {
    setStatus(`Could not import ${file.name}: ${error.message}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function importGlbUrl(url, side, name = "Generated character") {
  try {
    const gltf = await loader.loadAsync(url);
    const model = gltf.scene;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const target = side === "left" ? procedural.left : procedural.right;
    if (target) scene.remove(target);

    prepareImportedModel(model, side);
    scene.add(model);

    if (side === "left") {
      procedural.left = model;
      imported.left = model;
    } else {
      procedural.right = model;
      imported.right = model;
    }

    gltf.animations.slice(0, 2).forEach((clip) => {
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(clip).play();
      mixers.push(mixer);
    });

    setStatus(`${name} loaded into the ${side} fighter slot.`);
  } catch (error) {
    setStatus(`Could not load generated model: ${error.message}`);
  }
}

async function placeOutfitAsset(asset, side) {
  setStatus(`Loading ${asset.name} into the ${side} slot...`);
  await importGlbUrl(asset.url, side, asset.name);
  if (side === "left") leftSlotName.textContent = asset.name;
  else rightSlotName.textContent = asset.name;
}

function prepareImportedModel(model, sideName) {
  const side = sideName === "left" ? 1 : -1;
  model.userData.side = side;
  model.userData.imported = true;
  model.userData.homeX = sideName === "left" ? -2.8 : 2.8;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z) || 1;
  model.scale.setScalar(2.25 / maxSize);

  const scaledBox = new THREE.Box3().setFromObject(model);
  const center = scaledBox.getCenter(new THREE.Vector3());
  const minY = scaledBox.min.y;

  const baseY = -minY;
  model.userData.baseY = baseY;
  model.position.set(model.userData.homeX - center.x, baseY, 0.55 - center.z);
  model.rotation.y = sideName === "left" ? Math.PI * 0.46 : -Math.PI * 0.46;
}

function fileToDataUrl(file) {
  return new Promise((resolveFile, rejectFile) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolveFile(reader.result));
    reader.addEventListener("error", () => rejectFile(reader.error));
    reader.readAsDataURL(file);
  });
}

async function uploadCharacterPng() {
  const file = manhuntPngFile?.files?.[0];
  const dataUrl = file ? await fileToDataUrl(file) : selectedCharacter()?.dataUrl || characterCanvasDataUrl();
  const response = await fetch("/api/manhunt/upload-character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || "Upload failed.");
  }
}

async function generateManhuntCharacter(side) {
  try {
    const name = selectedCharacter()?.name || currentCharacterName();
    setStatus(`Generating "${name}" for the ${side} slot. This can take several minutes...`);
    await uploadCharacterPng();

    const response = await fetch("/api/manhunt/generate-character", { method: "POST" });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.message || "Generation failed.");
    }

    if (!payload.status?.modelUrl) {
      throw new Error("Generation finished but no GLB model URL was returned.");
    }

    await importGlbUrl(payload.status.modelUrl, side, `Generated "${name}"`);
    if (side === "left") leftSlotName.textContent = `${name} (3D)`;
    else rightSlotName.textContent = `${name} (3D)`;
    if (imported.left && imported.right) {
      fightImportedCharacters();
    }
  } catch (error) {
    setStatus(`Man Hunt generation failed: ${error.message}`);
  }
}

function fightImportedCharacters() {
  if (!imported.left || !imported.right) {
    setStatus("Import a left and right .glb first, then click Fight Imported Characters.");
    return;
  }

  imported.left.userData.homeX = -2.8;
  imported.right.userData.homeX = 2.8;
  imported.left.rotation.y = Math.PI * 0.46;
  imported.right.rotation.y = -Math.PI * 0.46;
  setStatus("Imported characters are fighting. Drag to orbit the camera.");
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();
  const delta = clock.getDelta();

  mixers.forEach((mixer) => mixer.update(delta));

  if (procedural.left && procedural.right) {
    const lunge = Math.max(0, Math.sin(elapsed * 1.8)) ** 12;
    procedural.left.position.x = procedural.left.userData.homeX + lunge * 1.1;
    procedural.left.position.y = (procedural.left.userData.baseY || 0) + Math.sin(elapsed * 4.5) * 0.04;
    procedural.left.rotation.z = Math.sin(elapsed * 3.4) * 0.035 + lunge * -0.16;

    procedural.right.position.x = 2.8 - Math.max(0, Math.sin(elapsed * 1.8 - 1.3)) ** 12 * 1.1;
    procedural.right.position.y = (procedural.right.userData.baseY || 0) + Math.sin(elapsed * 4.2 + 1.2) * 0.04;
    procedural.right.rotation.z = Math.sin(elapsed * 3.1) * -0.035;
  }

  procedural.sparks.forEach((spark, index) => {
    const burst = Math.max(0, Math.sin(elapsed * 1.8)) ** 8;
    const radius = burst * (0.3 + spark.userData.speed);
    spark.visible = burst > 0.08;
    spark.position.set(
      Math.cos(spark.userData.angle + elapsed) * radius,
      1.7 + Math.sin(index + elapsed * 3) * radius * 0.45,
      0.2 + Math.sin(spark.userData.angle) * radius
    );
    spark.scale.setScalar(1 + burst * 2);
  });

  if (procedural.impactLight) {
    procedural.impactLight.intensity = 2 + Math.max(0, Math.sin(elapsed * 1.8)) ** 8 * 18;
  }

  controls.update();
  renderer.render(scene, camera);
}

addLightRig();
makeSparks();
generateBattle();
resize();
animate();
refreshGeneratorStatus();

generateButton.addEventListener("click", () => generateBattle(promptInput.value));
randomizeButton.addEventListener("click", () => generateBattle());
fightButton.addEventListener("click", fightImportedCharacters);
generateManhuntLeft.addEventListener("click", () => generateManhuntCharacter("left"));
generateManhuntRight.addEventListener("click", () => generateManhuntCharacter("right"));
promptInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    generateBattle(promptInput.value);
  }
});
leftModelFile.addEventListener("change", () => importGlb(leftModelFile.files?.[0], "left"));
rightModelFile.addEventListener("change", () => importGlb(rightModelFile.files?.[0], "right"));
window.addEventListener("resize", resize);

drawQuickPngCharacter();
renderCharacterLibrary();
renderOutfitLibrary();
drawCharacterPngButton.addEventListener("click", drawQuickPngCharacter);
clearCharacterPngButton.addEventListener("click", clearCharacterCanvas);
saveCharacterCardButton.addEventListener("click", saveCharacterCard);
randomCharacterCardButton.addEventListener("click", randomizeCharacterPrompt);
placePngLeftButton.addEventListener("click", () => placePngBillboard("left"));
placePngRightButton.addEventListener("click", () => placePngBillboard("right"));
characterCanvas.addEventListener("pointerdown", (event) => {
  drawingCharacter = true;
  characterCanvas.setPointerCapture(event.pointerId);
  drawOnCharacterCanvas(event);
});
characterCanvas.addEventListener("pointermove", drawOnCharacterCanvas);
characterCanvas.addEventListener("pointerup", () => {
  drawingCharacter = false;
});
