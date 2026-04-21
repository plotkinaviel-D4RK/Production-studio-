const canvas = document.querySelector("#stage");
const ctx = canvas.getContext("2d");

const ui = {
  backgroundColor: document.querySelector("#backgroundColor"),
  deleteLayer: document.querySelector("#deleteLayer"),
  exportScene: document.querySelector("#exportScene"),
  frameSlider: document.querySelector("#frameSlider"),
  importScene: document.querySelector("#importScene"),
  keyframeTrack: document.querySelector("#keyframeTrack"),
  layerList: document.querySelector("#layerList"),
  playPause: document.querySelector("#playPause"),
  propColor: document.querySelector("#propColor"),
  propName: document.querySelector("#propName"),
  propRotation: document.querySelector("#propRotation"),
  propScale: document.querySelector("#propScale"),
  propX: document.querySelector("#propX"),
  propY: document.querySelector("#propY"),
  battleDemo: document.querySelector("#battleDemo"),
  resetScene: document.querySelector("#resetScene"),
  selectedName: document.querySelector("#selectedName"),
  setKeyframe: document.querySelector("#setKeyframe"),
  generateScene: document.querySelector("#generateScene"),
  promptStatus: document.querySelector("#promptStatus"),
  scenePrompt: document.querySelector("#scenePrompt"),
  timeLabel: document.querySelector("#timeLabel"),
};

const maxFrame = 144;
const fps = 24;
let nextId = 5;
let selectedId = "hero";
let playing = false;
let drag = null;
let lastTick = 0;

const starterScene = {
  background: "#f3d7a1",
  frame: 0,
  layers: [
    makeLayer("sun", "circle", "Late Afternoon Sun", 1040, 155, 1.2, 0, "#f3a23a"),
    makeLayer("cloud-a", "cloud", "Drifting Cloud", 320, 150, 1, 0, "#ffffff"),
    makeLayer("hero", "character", "Main Character", 610, 455, 1, 0, "#e85d3f"),
    makeLayer("ground", "rect", "Stage Platform", 640, 635, 1, 0, "#2d6f8f"),
  ],
};

starterScene.layers[1].keyframes = [
  { frame: 0, x: 220, y: 150, scale: 1, rotation: 0 },
  { frame: 144, x: 760, y: 120, scale: 1.05, rotation: 0 },
];
starterScene.layers[2].keyframes = [
  { frame: 0, x: 560, y: 455, scale: 1, rotation: -4 },
  { frame: 72, x: 650, y: 430, scale: 1.04, rotation: 5 },
  { frame: 144, x: 720, y: 455, scale: 1, rotation: -2 },
];

let scene = structuredClone(starterScene);

function makeLayer(id, type, name, x, y, scale, rotation, color) {
  return {
    id,
    type,
    name,
    x,
    y,
    scale,
    rotation,
    color,
    visible: true,
    keyframes: [{ frame: 0, x, y, scale, rotation }],
  };
}

function selectedLayer() {
  return scene.layers.find((layer) => layer.id === selectedId) || null;
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function eased(amount) {
  return amount * amount * (3 - 2 * amount);
}

function layerAtFrame(layer, frame) {
  const keys = [...layer.keyframes].sort((a, b) => a.frame - b.frame);
  const first = keys[0];
  const last = keys[keys.length - 1];

  if (frame <= first.frame) return { ...layer, ...first };
  if (frame >= last.frame) return { ...layer, ...last };

  const fromIndex = keys.findIndex((key, index) => key.frame <= frame && keys[index + 1]?.frame >= frame);
  const from = keys[fromIndex];
  const to = keys[fromIndex + 1];
  const amount = eased((frame - from.frame) / (to.frame - from.frame));

  return {
    ...layer,
    x: lerp(from.x, to.x, amount),
    y: lerp(from.y, to.y, amount),
    scale: lerp(from.scale, to.scale, amount),
    rotation: lerp(from.rotation, to.rotation, amount),
  };
}

function resizeCanvasForDisplay() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function stageSize() {
  const rect = canvas.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function toScreen(point) {
  const size = stageSize();
  return {
    x: (point.x / 1280) * size.width,
    y: (point.y / 720) * size.height,
  };
}

function toScene(point) {
  const size = stageSize();
  return {
    x: (point.x / size.width) * 1280,
    y: (point.y / size.height) * 720,
  };
}

function drawLayer(layer) {
  const rendered = layerAtFrame(layer, scene.frame);
  if (!rendered.visible) return;

  const position = toScreen(rendered);
  const scale = rendered.scale * (stageSize().width / 1280);

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate((rendered.rotation * Math.PI) / 180);
  ctx.scale(scale, scale);

  if (rendered.type === "circle") drawCircle(rendered);
  if (rendered.type === "cloud") drawCloud(rendered);
  if (rendered.type === "rect") drawRect(rendered);
  if (rendered.type === "character") drawCharacter(rendered);
  if (rendered.type === "monster") drawMonster(rendered);
  if (rendered.type === "arena") drawArena(rendered);
  if (rendered.type === "effect") drawEffect(rendered);

  if (rendered.id === selectedId) {
    ctx.strokeStyle = "#1e1a16";
    ctx.lineWidth = 3 / scale;
    ctx.setLineDash([8 / scale, 8 / scale]);
    ctx.strokeRect(-90, -110, 180, 220);
  }

  ctx.restore();
}

function drawCircle(layer) {
  const gradient = ctx.createRadialGradient(-20, -20, 10, 0, 0, 72);
  gradient.addColorStop(0, "#ffeaa8");
  gradient.addColorStop(1, layer.color);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 72, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(layer) {
  ctx.fillStyle = layer.color;
  ctx.globalAlpha = 0.92;
  [-70, -25, 25, 72].forEach((x, index) => {
    ctx.beginPath();
    ctx.ellipse(x, index % 2 ? -8 : 4, 54, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawRect(layer) {
  ctx.fillStyle = layer.color;
  ctx.beginPath();
  ctx.roundRect(-210, -36, 420, 72, 24);
  ctx.fill();
}

function blendColor(hex, target, amount) {
  const parse = (value) => {
    const clean = value.replace("#", "");
    return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
  };
  const from = parse(hex);
  const to = parse(target);
  const next = from.map((channel, index) => Math.round(lerp(channel, to[index], amount)));
  return `#${next.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function drawArena(layer) {
  const arenaGradient = ctx.createRadialGradient(-70, -48, 40, 0, 0, 395);
  arenaGradient.addColorStop(0, blendColor(layer.color, "#ffffff", 0.42));
  arenaGradient.addColorStop(0.58, layer.color);
  arenaGradient.addColorStop(1, blendColor(layer.color, "#1e1a16", 0.46));

  ctx.fillStyle = "rgba(30,26,22,0.24)";
  ctx.beginPath();
  ctx.ellipse(0, 20, 386, 138, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = arenaGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 360, 126, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.ellipse(0, 0, 260, 82, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(30,26,22,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-340, 0);
  ctx.lineTo(340, 0);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let index = 0; index < 18; index += 1) {
    const x = -288 + ((index * 67) % 576);
    const y = -64 + ((index * 31) % 118);
    ctx.fillRect(x, y, 8, 2);
  }
}

function drawMonster(layer) {
  const facing = layer.x < 640 ? 1 : -1;
  const breath = Math.sin((scene.frame / 144) * Math.PI * 8);
  const squish = 1 + breath * 0.025;

  ctx.scale(facing, squish);
  ctx.fillStyle = "rgba(30,26,22,0.25)";
  ctx.beginPath();
  ctx.ellipse(-4, 94, 102, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  drawMonsterTail(layer);
  drawMonsterLegs(layer, breath);
  drawMonsterBody(layer);
  drawMonsterHead(layer, breath);
  drawMonsterArms(layer, breath);
}

function drawMonsterTail(layer) {
  const tailGradient = ctx.createLinearGradient(-62, 24, -176, 76);
  tailGradient.addColorStop(0, blendColor(layer.color, "#ffffff", 0.08));
  tailGradient.addColorStop(1, blendColor(layer.color, "#1e1a16", 0.28));
  ctx.strokeStyle = tailGradient;
  ctx.lineWidth = 24;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-58, 38);
  ctx.quadraticCurveTo(-130, 20, -166, 74);
  ctx.stroke();
}

function drawMonsterLegs(layer, breath) {
  ctx.fillStyle = blendColor(layer.color, "#1e1a16", 0.12);
  [
    [-34, 74, -12 + breath * 2],
    [44, 74, 10 - breath * 2],
  ].forEach(([x, y, rotation]) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.beginPath();
    ctx.roundRect(-26, -6, 58, 34, 16);
    ctx.fill();
    ctx.restore();
  });
}

function drawMonsterBody(layer) {
  const body = ctx.createRadialGradient(-28, -44, 22, 8, 12, 104);
  body.addColorStop(0, blendColor(layer.color, "#ffffff", 0.42));
  body.addColorStop(0.44, layer.color);
  body.addColorStop(1, blendColor(layer.color, "#1e1a16", 0.36));
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-6, 14, 78, 94, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(-34, -20, 26, 48, -0.36, 0, Math.PI * 2);
  ctx.fill();
}

function drawMonsterHead(layer, breath) {
  const head = ctx.createRadialGradient(0, -96, 18, 16, -82, 72);
  head.addColorStop(0, blendColor(layer.color, "#ffffff", 0.46));
  head.addColorStop(0.55, blendColor(layer.color, "#ffffff", 0.08));
  head.addColorStop(1, blendColor(layer.color, "#1e1a16", 0.34));
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.ellipse(18, -78 + breath * 2, 64, 58, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = blendColor(layer.color, "#1e1a16", 0.16);
  ctx.beginPath();
  ctx.moveTo(-26, -120);
  ctx.quadraticCurveTo(-6, -166, 16, -116);
  ctx.moveTo(34, -122);
  ctx.quadraticCurveTo(58, -166, 66, -104);
  ctx.fill();

  ctx.fillStyle = "#f8efe1";
  ctx.beginPath();
  ctx.ellipse(42, -88, 18, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e1a16";
  ctx.beginPath();
  ctx.arc(48, -88, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1e1a16";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(36, -55);
  ctx.quadraticCurveTo(56, -42, 78, -52);
  ctx.stroke();

  ctx.fillStyle = "#f8efe1";
  ctx.beginPath();
  ctx.moveTo(50, -43);
  ctx.lineTo(58, -25);
  ctx.lineTo(66, -44);
  ctx.fill();
}

function drawMonsterArms(layer, breath) {
  ctx.strokeStyle = blendColor(layer.color, "#1e1a16", 0.08);
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(52, -2);
  ctx.quadraticCurveTo(98, 10 + breath * 5, 116, 48);
  ctx.moveTo(-52, 2);
  ctx.quadraticCurveTo(-92, 22 - breath * 4, -102, 62);
  ctx.stroke();

  ctx.fillStyle = "#f8efe1";
  [
    [116, 48],
    [-102, 62],
  ].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEffect(layer) {
  const pulse = 0.8 + Math.sin((scene.frame / 144) * Math.PI * 14) * 0.22;
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 120 * pulse);
  glow.addColorStop(0, `${layer.color}dd`);
  glow.addColorStop(0.35, `${layer.color}77`);
  glow.addColorStop(1, `${layer.color}00`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 120 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = blendColor(layer.color, "#ffffff", 0.25);
  ctx.fillStyle = `${layer.color}66`;
  ctx.lineWidth = 8;
  ctx.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const radius = i % 2 ? 26 * pulse : 78 * pulse;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawCharacter(layer) {
  ctx.fillStyle = "#1e1a16";
  ctx.beginPath();
  ctx.arc(0, -86, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = layer.color;
  ctx.lineWidth = 22;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.lineTo(0, 56);
  ctx.moveTo(0, -8);
  ctx.lineTo(-58, 28);
  ctx.moveTo(0, -8);
  ctx.lineTo(58, -36);
  ctx.moveTo(0, 54);
  ctx.lineTo(-44, 108);
  ctx.moveTo(0, 54);
  ctx.lineTo(52, 104);
  ctx.stroke();
}

function draw() {
  resizeCanvasForDisplay();
  const size = stageSize();
  ctx.clearRect(0, 0, size.width, size.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, size.height);
  gradient.addColorStop(0, scene.background);
  gradient.addColorStop(0.52, blendColor(scene.background, "#ffffff", 0.18));
  gradient.addColorStop(1, "#f4e4c7");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size.width, size.height);

  drawAtmosphere(size);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let x = -60; x < size.width; x += 120) {
    ctx.beginPath();
    ctx.arc(x + scene.frame * 0.4, 80, 140, 0, Math.PI * 2);
    ctx.fill();
  }

  scene.layers.forEach(drawLayer);
  if (scene.layers.some((layer) => layer.type === "monster")) {
    drawBattleHud(size);
  }
}

function drawAtmosphere(size) {
  const horizon = size.height * 0.64;
  const ground = ctx.createLinearGradient(0, horizon, 0, size.height);
  ground.addColorStop(0, "rgba(96, 125, 83, 0.22)");
  ground.addColorStop(0.45, "rgba(107, 91, 64, 0.34)");
  ground.addColorStop(1, "rgba(52, 42, 34, 0.28)");
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.bezierCurveTo(size.width * 0.2, horizon - 28, size.width * 0.82, horizon + 36, size.width, horizon - 8);
  ctx.lineTo(size.width, size.height);
  ctx.lineTo(0, size.height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1;
  for (let index = 0; index < 8; index += 1) {
    const y = horizon + index * 28;
    ctx.beginPath();
    ctx.moveTo(size.width * 0.12, y);
    ctx.quadraticCurveTo(size.width * 0.5, y + index * 12, size.width * 0.88, y - index * 4);
    ctx.stroke();
  }

  const vignette = ctx.createRadialGradient(size.width / 2, size.height * 0.42, 80, size.width / 2, size.height / 2, size.width * 0.75);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, "rgba(24,18,14,0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size.width, size.height);
}

function drawBattleHud(size) {
  const cards = [
    { x: 28, y: 24, label: "LEFT MONSTER", hp: 0.72, align: "left" },
    { x: size.width - 328, y: 24, label: "RIGHT MONSTER", hp: 0.48, align: "right" },
  ];

  cards.forEach((card) => {
    ctx.save();
    ctx.fillStyle = "rgba(255,249,238,0.86)";
    ctx.strokeStyle = "rgba(30,26,22,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(card.x, card.y, 300, 72, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1e1a16";
    ctx.font = "700 13px Georgia, serif";
    ctx.textAlign = card.align;
    ctx.fillText(card.label, card.align === "left" ? card.x + 18 : card.x + 282, card.y + 25);

    ctx.fillStyle = "rgba(30,26,22,0.18)";
    ctx.beginPath();
    ctx.roundRect(card.x + 18, card.y + 42, 264, 12, 999);
    ctx.fill();

    const hpColor = card.hp > 0.55 ? "#52a653" : "#e8a13f";
    ctx.fillStyle = hpColor;
    ctx.beginPath();
    ctx.roundRect(card.x + 18, card.y + 42, 264 * card.hp, 12, 999);
    ctx.fill();
    ctx.restore();
  });
}

function renderLayers() {
  ui.layerList.innerHTML = "";
  scene.layers.slice().reverse().forEach((layer) => {
    const item = document.createElement("button");
    item.className = `layer ${layer.id === selectedId ? "active" : ""}`;
    item.innerHTML = `<span>${layer.name}</span><span>${layer.keyframes.length} keys</span>`;
    item.addEventListener("click", () => {
      selectedId = layer.id;
      syncInspector();
      render();
    });
    ui.layerList.append(item);
  });
}

function renderTimeline() {
  ui.timeLabel.textContent = `Frame ${scene.frame}`;
  ui.frameSlider.value = scene.frame;
  ui.keyframeTrack.innerHTML = "";

  selectedLayer()?.keyframes.forEach((keyframe) => {
    const dot = document.createElement("span");
    dot.className = "key-dot";
    dot.style.left = `${(keyframe.frame / maxFrame) * 100}%`;
    dot.title = `Frame ${keyframe.frame}`;
    ui.keyframeTrack.append(dot);
  });
}

function syncInspector() {
  const layer = selectedLayer();
  const current = layer ? layerAtFrame(layer, scene.frame) : null;

  ui.selectedName.textContent = layer?.type || "None";
  [ui.propName, ui.propX, ui.propY, ui.propScale, ui.propRotation, ui.propColor].forEach((input) => {
    input.disabled = !layer;
  });

  if (!layer || !current) return;

  ui.propName.value = layer.name;
  ui.propX.value = Math.round(current.x);
  ui.propY.value = Math.round(current.y);
  ui.propScale.value = Number(current.scale).toFixed(2);
  ui.propRotation.value = Math.round(current.rotation);
  ui.propColor.value = layer.color;
}

function render() {
  renderLayers();
  renderTimeline();
  syncInspector();
  draw();
}

function updateSelectedFromInspector() {
  const layer = selectedLayer();
  if (!layer) return;

  layer.name = ui.propName.value;
  layer.x = Number(ui.propX.value);
  layer.y = Number(ui.propY.value);
  layer.scale = Number(ui.propScale.value);
  layer.rotation = Number(ui.propRotation.value);
  layer.color = ui.propColor.value;
  render();
}

function setKeyframe() {
  const layer = selectedLayer();
  if (!layer) return;

  const keyframe = {
    frame: scene.frame,
    x: Number(ui.propX.value),
    y: Number(ui.propY.value),
    scale: Number(ui.propScale.value),
    rotation: Number(ui.propRotation.value),
  };

  const index = layer.keyframes.findIndex((key) => key.frame === scene.frame);
  if (index >= 0) {
    layer.keyframes[index] = keyframe;
  } else {
    layer.keyframes.push(keyframe);
  }

  layer.keyframes.sort((a, b) => a.frame - b.frame);
  render();
}

function hitTest(scenePoint) {
  return scene.layers
    .slice()
    .reverse()
    .find((layer) => {
      const rendered = layerAtFrame(layer, scene.frame);
      const width = rendered.type === "rect" ? 460 : 190;
      const height = rendered.type === "rect" ? 110 : 230;
      return (
        scenePoint.x >= rendered.x - width / 2 &&
        scenePoint.x <= rendered.x + width / 2 &&
        scenePoint.y >= rendered.y - height / 2 &&
        scenePoint.y <= rendered.y + height / 2
      );
    });
}

function addLayer(type) {
  const id = `${type}-${nextId++}`;
  const names = {
    character: "New Character",
    circle: "New Sun",
    cloud: "New Cloud",
    effect: "New Hit Effect",
    arena: "New Arena",
    monster: "New Monster",
    rect: "New Block",
  };
  const colors = {
    character: "#e85d3f",
    circle: "#f3a23a",
    cloud: "#ffffff",
    effect: "#ffcf33",
    arena: "#70a65a",
    monster: "#6f6de8",
    rect: "#2d6f8f",
  };

  scene.layers.push(makeLayer(id, type, names[type], 560, 320, 1, 0, colors[type]));
  selectedId = id;
  render();
}

function battleSceneFromPrompt(prompt) {
  const text = prompt.toLowerCase();
  const night = includesAny(text, ["night", "dark", "moon"]);
  const fire = includesAny(text, ["fire", "flame", "char"]);
  const electric = includesAny(text, ["electric", "lightning", "pikachu", "spark"]);
  const grass = includesAny(text, ["grass", "forest", "bulb"]);

  const leftColor = electric ? "#f0d43a" : fire ? "#e85d3f" : "#6f6de8";
  const rightColor = grass ? "#4fba69" : fire ? "#f28b3a" : "#2d8fb8";
  const effectColor = electric ? "#ffdf38" : fire ? "#ff6b35" : "#ffffff";

  return {
    background: night ? "#18243a" : "#bfe3ef",
    frame: 0,
    layers: [
      makeLayer("battle-sun", "circle", night ? "Battle Moon" : "Battle Sun", 1030, 125, 1.05, 0, night ? "#f5edcf" : "#f3a23a"),
      makeLayer("battle-cloud", "cloud", "Distant Volumetric Cloud", 260, 110, 1.05, 0, "#ffffff"),
      makeLayer("battle-cloud-2", "cloud", "Soft Background Cloud", 730, 175, 0.78, 0, "#f8efe1"),
      {
        ...makeLayer("battle-arena", "arena", "Cinematic 2.5D Battle Arena", 640, 555, 1.06, 0, grass ? "#65a85c" : "#8db06d"),
        keyframes: [{ frame: 0, x: 640, y: 555, scale: 1, rotation: 0 }],
      },
      {
        ...makeLayer("left-monster", "monster", "Left Creature Fighter", 388, 462, 1.12, -5, leftColor),
        keyframes: [
          { frame: 0, x: 388, y: 462, scale: 1.12, rotation: -5 },
          { frame: 44, x: 428, y: 440, scale: 1.17, rotation: 3 },
          { frame: 62, x: 558, y: 446, scale: 1.24, rotation: 12 },
          { frame: 92, x: 388, y: 462, scale: 1.12, rotation: -5 },
          { frame: 144, x: 388, y: 462, scale: 1.12, rotation: -5 },
        ],
      },
      {
        ...makeLayer("right-monster", "monster", "Right Creature Fighter", 890, 462, 1.15, 5, rightColor),
        keyframes: [
          { frame: 0, x: 890, y: 462, scale: 1.15, rotation: 5 },
          { frame: 62, x: 890, y: 462, scale: 1.15, rotation: 5 },
          { frame: 80, x: 850, y: 448, scale: 1.2, rotation: -8 },
          { frame: 108, x: 735, y: 446, scale: 1.25, rotation: -13 },
          { frame: 144, x: 890, y: 462, scale: 1.15, rotation: 5 },
        ],
      },
      {
        ...makeLayer("hit-effect", "effect", "Badly Animated Hit Spark", 660, 438, 0.15, 0, effectColor),
        keyframes: [
          { frame: 0, x: 660, y: 438, scale: 0.01, rotation: 0 },
          { frame: 58, x: 715, y: 438, scale: 0.01, rotation: 0 },
          { frame: 68, x: 715, y: 438, scale: 0.9, rotation: 18 },
          { frame: 82, x: 715, y: 438, scale: 0.01, rotation: 45 },
          { frame: 144, x: 625, y: 438, scale: 0.01, rotation: 0 },
        ],
      },
    ],
  };
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function countFromPrompt(text, word, fallback = 1) {
  if (text.includes(`three ${word}`) || text.includes(`3 ${word}`)) return 3;
  if (text.includes(`two ${word}`) || text.includes(`2 ${word}`)) return 2;
  if (text.includes(`one ${word}`) || text.includes(`1 ${word}`)) return 1;
  return text.includes(word) ? fallback : 0;
}

function sceneFromPrompt(prompt) {
  const text = prompt.toLowerCase();

  if (includesAny(text, ["pokemon", "pokémon", "battle", "fight", "arena", "monster duel", "pocket monster"])) {
    return battleSceneFromPrompt(prompt);
  }

  const generated = {
    background: "#f3d7a1",
    frame: 0,
    layers: [],
  };

  if (includesAny(text, ["night", "moon", "stars"])) generated.background = "#18243a";
  if (includesAny(text, ["forest", "jungle", "woods"])) generated.background = "#bfd9b7";
  if (includesAny(text, ["ocean", "sea", "beach", "water"])) generated.background = "#bfe3ef";
  if (includesAny(text, ["sunset", "golden", "orange"])) generated.background = "#f0b16c";
  if (includesAny(text, ["space", "galaxy"])) generated.background = "#101424";

  const add = (type, name, x, y, scale, rotation, color, keyframes = null) => {
    const id = `${type}-${nextId++}`;
    const layer = makeLayer(id, type, name, x, y, scale, rotation, color);
    if (keyframes) layer.keyframes = keyframes;
    generated.layers.push(layer);
    return layer;
  };

  if (includesAny(text, ["sun", "sunset", "day", "bright"])) {
    add("circle", "Prompt Sun", 1030, 150, includesAny(text, ["big", "huge"]) ? 1.45 : 1.1, 0, "#f3a23a");
  }

  if (includesAny(text, ["moon", "night"])) {
    add("circle", "Prompt Moon", 1050, 135, 0.85, 0, "#f5edcf");
  }

  const cloudCount = countFromPrompt(text, "cloud", includesAny(text, ["sky", "weather"]) ? 2 : 0);
  for (let index = 0; index < cloudCount; index += 1) {
    const startX = 190 + index * 260;
    add("cloud", `Prompt Cloud ${index + 1}`, startX, 120 + index * 34, 0.85 + index * 0.1, 0, "#ffffff", [
      { frame: 0, x: startX, y: 120 + index * 34, scale: 0.85 + index * 0.1, rotation: 0 },
      { frame: 144, x: startX + 360, y: 105 + index * 24, scale: 0.9 + index * 0.1, rotation: 0 },
    ]);
  }

  if (includesAny(text, ["mountain", "mountains", "hill", "hills"])) {
    add("rect", "Distant Mountain Ridge", 390, 510, 1.15, -7, "#6f8f75");
    add("rect", "Second Mountain Ridge", 785, 500, 1, 8, "#507266");
  }

  if (includesAny(text, ["beach", "desert", "sand"])) {
    add("rect", "Warm Sand", 640, 635, 1.25, 0, "#d89e57");
  } else if (includesAny(text, ["ocean", "sea", "water"])) {
    add("rect", "Waterline", 640, 635, 1.25, 0, "#2d8fb8");
  } else if (includesAny(text, ["forest", "grass", "park"])) {
    add("rect", "Grass Floor", 640, 635, 1.25, 0, "#4f8a45");
  } else {
    add("rect", "Stage Floor", 640, 635, 1.15, 0, "#2d6f8f");
  }

  const characterCount = countFromPrompt(text, "character", includesAny(text, ["person", "hero", "walking", "dancing"]) ? 1 : 0);
  for (let index = 0; index < characterCount; index += 1) {
    const startX = 430 + index * 220;
    const walking = includesAny(text, ["walk", "walking", "run", "running"]);
    const dancing = includesAny(text, ["dance", "dancing"]);
    add("character", index === 0 ? "Prompt Character" : `Prompt Character ${index + 1}`, startX, 455, 1, -4, "#e85d3f", [
      { frame: 0, x: startX, y: 455, scale: 1, rotation: -4 },
      { frame: 72, x: walking ? startX + 150 : startX + 20, y: dancing ? 410 : 430, scale: 1.04, rotation: dancing ? 12 : 5 },
      { frame: 144, x: walking ? startX + 300 : startX, y: 455, scale: 1, rotation: dancing ? -10 : -2 },
    ]);
  }

  if (generated.layers.length === 1) {
    add("cloud", "Default Cloud", 260, 140, 1, 0, "#ffffff", [
      { frame: 0, x: 260, y: 140, scale: 1, rotation: 0 },
      { frame: 144, x: 760, y: 125, scale: 1.05, rotation: 0 },
    ]);
    add("character", "Default Character", 560, 455, 1, -4, "#e85d3f", [
      { frame: 0, x: 520, y: 455, scale: 1, rotation: -4 },
      { frame: 72, x: 620, y: 430, scale: 1.04, rotation: 5 },
      { frame: 144, x: 720, y: 455, scale: 1, rotation: -2 },
    ]);
  }

  return generated;
}

function applyGeneratedScene(nextScene) {
  scene = nextScene;
  selectedId = scene.layers.find((layer) => layer.type === "character")?.id || scene.layers.at(-1)?.id || null;
  ui.backgroundColor.value = scene.background;
  playing = false;
  ui.playPause.textContent = "Play";
  render();
}

async function generateSceneFromPrompt() {
  const prompt = ui.scenePrompt.value.trim();
  if (!prompt) return;

  ui.generateScene.disabled = true;
  ui.generateScene.textContent = "Creating...";
  ui.promptStatus.textContent = "Asking AI to build the scene...";

  try {
    const response = await fetch("/api/generate-scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "AI scene generation failed.");
    }

    const payload = await response.json();
    applyGeneratedScene(payload.scene);
    ui.promptStatus.textContent = "Created with AI. You can edit layers and keyframes now.";
  } catch (error) {
    applyGeneratedScene(sceneFromPrompt(prompt));
    ui.promptStatus.textContent = `${error.message} Created with local fallback instead.`;
  } finally {
    ui.generateScene.disabled = false;
    ui.generateScene.textContent = "Create Scene";
  }
}

function exportScene() {
  const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "production-studio-scene.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function animationLoop(timestamp) {
  if (playing && timestamp - lastTick > 1000 / fps) {
    scene.frame = scene.frame >= maxFrame ? 0 : scene.frame + 1;
    lastTick = timestamp;
    renderTimeline();
    syncInspector();
    draw();
  }

  requestAnimationFrame(animationLoop);
}

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => addLayer(button.dataset.add));
});

ui.battleDemo.addEventListener("click", () => {
  ui.scenePrompt.value = "Pokemon Go style battle in a tiny 3d world with two monsters fighting";
  applyGeneratedScene(battleSceneFromPrompt(ui.scenePrompt.value));
  ui.promptStatus.textContent = "Loaded a local battle demo. Edit it or ask AI for variations.";
});

ui.backgroundColor.addEventListener("input", () => {
  scene.background = ui.backgroundColor.value;
  draw();
});

ui.deleteLayer.addEventListener("click", () => {
  if (scene.layers.length <= 1) return;
  scene.layers = scene.layers.filter((layer) => layer.id !== selectedId);
  selectedId = scene.layers.at(-1).id;
  render();
});

ui.exportScene.addEventListener("click", exportScene);
ui.frameSlider.addEventListener("input", () => {
  scene.frame = Number(ui.frameSlider.value);
  render();
});

ui.importScene.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  scene = JSON.parse(await file.text());
  selectedId = scene.layers[0]?.id || null;
  ui.backgroundColor.value = scene.background;
  render();
});

ui.playPause.addEventListener("click", () => {
  playing = !playing;
  ui.playPause.textContent = playing ? "Pause" : "Play";
});

ui.resetScene.addEventListener("click", () => {
  scene = structuredClone(starterScene);
  selectedId = "hero";
  playing = false;
  ui.playPause.textContent = "Play";
  render();
});

ui.setKeyframe.addEventListener("click", setKeyframe);
ui.generateScene.addEventListener("click", generateSceneFromPrompt);
ui.scenePrompt.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    generateSceneFromPrompt();
  }
});

[ui.propName, ui.propX, ui.propY, ui.propScale, ui.propRotation, ui.propColor].forEach((input) => {
  input.addEventListener("input", updateSelectedFromInspector);
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const scenePoint = toScene({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  const layer = hitTest(scenePoint);
  if (!layer) return;

  const rendered = layerAtFrame(layer, scene.frame);
  selectedId = layer.id;
  drag = { id: layer.id, offsetX: scenePoint.x - rendered.x, offsetY: scenePoint.y - rendered.y };
  canvas.setPointerCapture(event.pointerId);
  render();
});

canvas.addEventListener("pointermove", (event) => {
  if (!drag) return;

  const rect = canvas.getBoundingClientRect();
  const scenePoint = toScene({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  const layer = selectedLayer();
  if (!layer) return;

  layer.x = scenePoint.x - drag.offsetX;
  layer.y = scenePoint.y - drag.offsetY;
  syncInspector();
  draw();
});

canvas.addEventListener("pointerup", () => {
  drag = null;
});

window.addEventListener("resize", draw);

render();
requestAnimationFrame(animationLoop);
