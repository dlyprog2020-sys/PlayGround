import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const canvas = document.querySelector("#scene");
const loader = document.querySelector("#loader");
const scrollBar = document.querySelector("#scrollBar");
const colorName = document.querySelector("#colorName");
const hotspotsRoot = document.querySelector("#hotspots");
const techSection = document.querySelector("#tech");

const ACCENTS = {
  "#c9f73a": "Acid Lime",
  "#ff6b2c": "Solar Ember",
  "#4fd8ff": "Glacier Blue",
  "#e9e6dc": "Bone White",
};

const state = {
  progress: 0,
  smooth: 0,
  drag: 0,
  dragTarget: 0,
  pointerX: 0,
  pointerY: 0,
  pointerXS: 0,
  pointerYS: 0,
  frameColor: new THREE.Color("#c9f73a"),
  accentColor: new THREE.Color("#c9f73a"),
  targetFrame: new THREE.Color("#c9f73a"),
  targetAccent: new THREE.Color("#c9f73a"),
  dragging: false,
  lastX: 0,
  spin: 0,
};

let renderer;
let scene;
let camera;
let bike;
let wheels = [];
let particles;
let accentMat;
let frameMat;
const accentLinked = [];
const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
let maxScroll = 0;
let firstFrame = true;

const camPos = new THREE.Vector3();
const camTgt = new THREE.Vector3();
const tmpV = new THREE.Vector3();

const WHEEL_R = 0.365;
const REAR_X = -0.635;
const FRONT_X = 0.635;
const HUB_Y = 0.365;
const BB = new THREE.Vector3(-0.075, 0.43, 0);

const KEYS = [
  {
    time: 0,
    p: new THREE.Vector3(2.55, 1.46, 2.7),
    t: new THREE.Vector3(-0.34, 0.62, 0),
    fov: 37,
  },
  {
    time: 0.34,
    p: new THREE.Vector3(1.9, 1.02, 3.55),
    t: new THREE.Vector3(-0.2, 0.57, 0),
    fov: 36,
  },
  {
    time: 0.66,
    p: new THREE.Vector3(0.16, 1.14, 3.9),
    t: new THREE.Vector3(-0.24, 0.58, 0),
    fov: 34,
  },
  {
    time: 1,
    p: new THREE.Vector3(2.6, 1.72, 2.7),
    t: new THREE.Vector3(-0.22, 0.64, 0),
    fov: 38,
  },
];

function ease(t) {
  return t * t * (3 - 2 * t);
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    loader.querySelector("p").textContent = "Для 3D нужен браузер с WebGL";
    console.error(error);
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(37, window.innerWidth / window.innerHeight, 0.1, 60);
  camera.position.copy(KEYS[0].p);
  camera.lookAt(KEYS[0].t);

  setupEnvironment();
  setupLights();
  setupStage();
  buildBike();
  setupParticles();
  setupUI();
  bindPointer();

  await nextFrame();
  window.addEventListener("resize", onResize);
  onResize();
  animate();

  setTimeout(() => {
    document.body.classList.add("ready");
    maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  }, 260);
  window.addEventListener("load", () => {
    maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  });
}

function setupEnvironment() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  if ("environmentIntensity" in scene) scene.environmentIntensity = 0.62;
  pmrem.dispose();
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xc9dcff, 0x090a09, 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff6e8, 3.4);
  key.position.set(3.2, 5.2, 4);
  key.target.position.set(0, 0.45, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0x93b5ff, 1.5);
  fill.position.set(-4.2, 2.4, 2.8);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xb9d0ff, 0.7);
  rim.position.set(-2.4, 2.2, -3.4);
  scene.add(rim);

  const warm = new THREE.PointLight(0xffb37a, 6, 6, 2);
  warm.position.set(2.2, 1.4, 2.6);
  scene.add(warm);
}

function setupStage() {
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(2.65, 2.65, 0.06, 96),
    new THREE.MeshBasicMaterial({ color: 0x0e0f11 })
  );
  platform.position.y = -0.032;
  scene.add(platform);

  const poolCanvas = document.createElement("canvas");
  poolCanvas.width = 256;
  poolCanvas.height = 256;
  const poolCtx = poolCanvas.getContext("2d");
  const poolGradient = poolCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  poolGradient.addColorStop(0, "rgba(255,255,255,0.10)");
  poolGradient.addColorStop(0.55, "rgba(255,255,255,0.03)");
  poolGradient.addColorStop(1, "rgba(255,255,255,0)");
  poolCtx.fillStyle = poolGradient;
  poolCtx.fillRect(0, 0, 256, 256);

  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(poolCanvas),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.0008;
  scene.add(pool);

  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc9f73a,
    transparent: true,
    opacity: 0.16,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  [
    [1.02, 0.16],
    [1.52, 0.1],
    [2.02, 0.075],
    [2.5, 0.05],
  ].forEach(([radius, opacity]) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.004, radius + 0.004, 128),
      ringMat.clone()
    );
    ring.material.opacity = opacity;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    accentLinked.push(ring.material);
    scene.add(ring);
  });

}


function makeTube(a, b, radius, material, radialSegments = 12) {
  const av = new THREE.Vector3(a[0], a[1], a[2]);
  const bv = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = new THREE.Vector3().subVectors(bv, av);
  const length = dir.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1),
    material
  );
  mesh.position.copy(av).add(bv).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeJoint(position, radius, material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeWheel(x) {
  const wheel = new THREE.Group();
  wheel.position.set(x, HUB_Y, 0);

  const tire = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R - 0.048, 0.048, 14, 72),
    new THREE.MeshStandardMaterial({
      color: 0x0e0f11,
      roughness: 0.88,
      metalness: 0.05,
    })
  );
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheel.add(tire);

  const tread = new THREE.Mesh(
    new THREE.TorusGeometry(WHEEL_R - 0.012, 0.012, 8, 96),
    new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.95 })
  );
  tread.castShadow = false;
  wheel.add(tread);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.288, 0.019, 10, 64),
    new THREE.MeshStandardMaterial({
      color: 0x2b2d33,
      metalness: 0.92,
      roughness: 0.24,
      envMapIntensity: 1,
    })
  );
  rim.castShadow = true;
  wheel.add(rim);

  const spokeMat = new THREE.MeshStandardMaterial({
    color: 0x8f959c,
    metalness: 1,
    roughness: 0.28,
  });
  const spokeCount = 32;
  const spokes = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0042, 0.0042, 1, 5, 1),
    spokeMat,
    spokeCount
  );
  const spokeDummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < spokeCount; i += 1) {
    const angle = (i / spokeCount) * Math.PI * 2;
    const z = i % 2 === 0 ? 0.022 : -0.022;
    const start = new THREE.Vector3(Math.cos(angle) * 0.038, Math.sin(angle) * 0.038, z * 0.4);
    const end = new THREE.Vector3(Math.cos(angle) * 0.285, Math.sin(angle) * 0.285, 0);
    const dir = new THREE.Vector3().subVectors(end, start);
    spokeDummy.position.copy(start).add(end).multiplyScalar(0.5);
    spokeDummy.quaternion.setFromUnitVectors(up, dir.clone().normalize());
    spokeDummy.scale.set(1, dir.length(), 1);
    spokeDummy.updateMatrix();
    spokes.setMatrixAt(i, spokeDummy.matrix);
  }
  spokes.instanceMatrix.needsUpdate = true;
  wheel.add(spokes);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.052, 0.1, 24),
    new THREE.MeshStandardMaterial({
      color: 0x3a3d44,
      metalness: 0.95,
      roughness: 0.22,
    })
  );
  hub.rotation.x = Math.PI / 2;
  hub.castShadow = true;
  wheel.add(hub);

  [0.053, -0.053].forEach((z) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.005, 6, 32), accentMat);
    ring.position.z = z;
    wheel.add(ring);
  });

  const rotor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.112, 0.006, 48),
    new THREE.MeshStandardMaterial({
      color: 0x9298a1,
      metalness: 1,
      roughness: 0.32,
    })
  );
  rotor.rotation.x = Math.PI / 2;
  rotor.position.z = 0.075;
  rotor.castShadow = true;
  wheel.add(rotor);

  const rotorInner = new THREE.Mesh(
    new THREE.TorusGeometry(0.073, 0.008, 6, 40),
    new THREE.MeshStandardMaterial({ color: 0x5c616a, metalness: 0.9, roughness: 0.4 })
  );
  rotorInner.position.z = 0.075;
  wheel.add(rotorInner);

  const caliper = new THREE.Mesh(
    new RoundedBoxGeometry(0.036, 0.075, 0.045, 3, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x24262b, metalness: 0.8, roughness: 0.35 })
  );
  caliper.position.set(0.02, 0.105, 0.075);
  caliper.rotation.z = 0.2;
  caliper.castShadow = true;
  wheel.add(caliper);

  return wheel;
}

function createFrameTexture() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#0c0d0c";
  ctx.font = "700 108px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#e9e6dc";
  ctx.fillText("VOLT", 256, 88);
  ctx.fillStyle = "#b9bcb4";
  ctx.font = "600 30px Arial, sans-serif";
  ctx.fillText("APEX  ·  01", 256, 156);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeScreenTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 144;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#080b09";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, c.width - 8, c.height - 8);

  ctx.fillStyle = "#f3f4ee";
  ctx.font = "700 62px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("32", 24, 86);

  ctx.fillStyle = "#8d9386";
  ctx.font = "600 16px Arial, sans-serif";
  ctx.fillText("KM/H", 27, 112);

  ctx.fillStyle = "#e9e6dc";
  ctx.font = "600 13px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("ECO", 226, 40);

  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.strokeRect(128, 74, 102, 18);
  ctx.fillStyle = "#f3f4ee";
  ctx.fillRect(132, 78, 72, 10);

  ctx.fillStyle = "#8d9386";
  ctx.font = "600 12px Arial, sans-serif";
  ctx.fillText("78%", 230, 88);

  ctx.fillStyle = "#f3f4ee";
  ctx.fillRect(20, 124, 60, 3);

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function buildBike() {
  bike = new THREE.Group();
  scene.add(bike);

  frameMat = new THREE.MeshPhysicalMaterial({
    color: state.frameColor,
    metalness: 0.66,
    roughness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.05,
  });

  accentMat = new THREE.MeshStandardMaterial({
    color: state.accentColor,
    emissive: state.accentColor,
    emissiveIntensity: 1.5,
    metalness: 0.4,
    roughness: 0.28,
  });

  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x24262a,
    metalness: 0.88,
    roughness: 0.33,
    envMapIntensity: 0.9,
  });
  const blackRubber = new THREE.MeshStandardMaterial({
    color: 0x131416,
    roughness: 0.9,
    metalness: 0.04,
  });
  const leather = new THREE.MeshStandardMaterial({
    color: 0x131313,
    roughness: 0.62,
    metalness: 0.08,
  });
  const alloy = new THREE.MeshStandardMaterial({
    color: 0x8b919a,
    metalness: 1,
    roughness: 0.3,
  });
  const batteryMat = new THREE.MeshStandardMaterial({
    color: 0x17191a,
    metalness: 0.72,
    roughness: 0.34,
    envMapIntensity: 0.8,
  });

  const headBottom = new THREE.Vector3(0.435, 0.705, 0);
  const headTop = new THREE.Vector3(0.395, 0.925, 0);
  const seatTop = new THREE.Vector3(-0.235, 0.885, 0);
  const rearHub = new THREE.Vector3(REAR_X, HUB_Y, 0);
  const frontHub = new THREE.Vector3(FRONT_X, HUB_Y, 0);

  bike.add(makeTube(headBottom, headTop, 0.039, frameMat, 16));
  bike.add(makeTube(headTop, [-0.19, 0.9, 0], 0.027, frameMat));
  bike.add(makeTube([-0.19, 0.9, 0], seatTop, 0.027, frameMat));
  bike.add(makeTube(headBottom, [BB.x, BB.y, 0], 0.035, frameMat));
  bike.add(makeTube([BB.x, BB.y, 0], seatTop, 0.028, frameMat));
  bike.add(makeJoint(headBottom, 0.04, frameMat));
  bike.add(makeJoint(headTop, 0.036, darkMetal));

  [0.075, -0.075].forEach((z) => {
    bike.add(makeTube([0.44, 0.71, z * 0.72], [FRONT_X, HUB_Y, z], 0.02, frameMat));
    bike.add(makeTube([0.44, 0.71, z * 0.72], [0.56, 0.5, z], 0.024, frameMat));
    bike.add(makeTube([0.56, 0.5, z], [FRONT_X, HUB_Y, z], 0.017, darkMetal));
  });

  const crown = new THREE.Mesh(
    new RoundedBoxGeometry(0.075, 0.05, 0.19, 3, 0.018),
    frameMat
  );
  crown.position.set(0.442, 0.705, 0);
  crown.castShadow = true;
  bike.add(crown);

  [0.082, -0.082].forEach((z) => {
    bike.add(makeTube([BB.x, BB.y, 0], [REAR_X, HUB_Y, z], 0.014, frameMat));
    bike.add(makeTube(seatTop, [REAR_X, HUB_Y, z * 0.72], 0.012, frameMat));
  });

  const seatPost = makeTube(seatTop, [-0.285, 1.025, 0], 0.017, darkMetal);
  bike.add(seatPost);
  const seatPostTop = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, 0.035, 12),
    darkMetal
  );
  seatPostTop.position.set(-0.287, 1.035, 0);
  bike.add(seatPostTop);

  const saddle = new THREE.Mesh(
    new RoundedBoxGeometry(0.3, 0.055, 0.135, 5, 0.026),
    leather
  );
  saddle.position.set(-0.315, 1.062, 0);
  saddle.rotation.z = -0.045;
  saddle.castShadow = true;
  bike.add(saddle);

  const saddleNose = new THREE.Mesh(
    new RoundedBoxGeometry(0.1, 0.04, 0.075, 4, 0.018),
    leather
  );
  saddleNose.position.set(-0.12, 1.05, 0);
  saddleNose.rotation.z = -0.045;
  saddleNose.castShadow = true;
  bike.add(saddleNose);

  const stem = makeTube([0.397, 0.925, 0], [0.485, 1.02, 0], 0.021, darkMetal);
  bike.add(stem);
  const bar = makeTube([0.49, 1.035, -0.29], [0.49, 1.035, 0.29], 0.016, darkMetal, 14);
  bike.add(bar);
  const barPad = new THREE.Mesh(
    new RoundedBoxGeometry(0.055, 0.035, 0.09, 3, 0.012),
    darkMetal
  );
  barPad.position.set(0.49, 1.035, 0);
  bike.add(barPad);

  [0.235, -0.235].forEach((z) => {
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.115, 14),
      blackRubber
    );
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0.49, 1.035, z);
    grip.castShadow = true;
    bike.add(grip);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.009, 14), alloy);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(0.49, 1.035, z + Math.sign(z) * 0.062);
    bike.add(cap);

    const lever = new THREE.Mesh(
      new RoundedBoxGeometry(0.015, 0.012, 0.09, 2, 0.005),
      alloy
    );
    lever.position.set(0.51, 1.02, z * 0.82);
    lever.rotation.y = Math.sign(z) * 0.2;
    bike.add(lever);
  });

  const display = new THREE.Group();
  display.position.set(0.485, 1.075, 0);
  display.rotation.z = -0.32;
  bike.add(display);

  const displayBody = new THREE.Mesh(
    new RoundedBoxGeometry(0.11, 0.028, 0.078, 4, 0.012),
    darkMetal
  );
  displayBody.castShadow = true;
  display.add(displayBody);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.088, 0.052),
    new THREE.MeshBasicMaterial({
      map: makeScreenTexture(),
      toneMapped: false,
    })
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = 0.015;
  display.add(screen);

  [0.062, -0.062].forEach((z) => {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 10), accentMat);
    button.position.set(-0.03, 0.018, z);
    display.add(button);
  });

  const batteryStart = new THREE.Vector3(0.405, 0.69, 0);
  const batteryEnd = new THREE.Vector3(-0.02, 0.46, 0);
  const batteryDir = new THREE.Vector3().subVectors(batteryEnd, batteryStart);
  const batteryMid = batteryStart.clone().add(batteryEnd).multiplyScalar(0.5);
  const perp = new THREE.Vector3(-batteryDir.y, batteryDir.x, 0).normalize().multiplyScalar(-0.038);
  batteryMid.add(perp);

  const battery = new THREE.Group();
  battery.position.copy(batteryMid);
  battery.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    batteryDir.clone().normalize()
  );
  bike.add(battery);

  const batteryBody = new THREE.Mesh(
    new RoundedBoxGeometry(0.112, 0.5, 0.15, 6, 0.03),
    batteryMat
  );
  batteryBody.castShadow = true;
  batteryBody.receiveShadow = true;
  battery.add(batteryBody);

  const batteryStrip = new THREE.Mesh(
    new RoundedBoxGeometry(0.018, 0.4, 0.008, 3, 0.003),
    accentMat
  );
  batteryStrip.position.set(0, 0, 0.076);
  battery.add(batteryStrip);

  for (let i = 0; i < 3; i += 1) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), accentMat);
    led.position.set(0.036, -0.13 + i * 0.045, 0.079);
    battery.add(led);
  }

  const batteryPlate = new THREE.Mesh(
    new RoundedBoxGeometry(0.09, 0.035, 0.155, 3, 0.008),
    darkMetal
  );
  batteryPlate.position.copy(batteryMid)
    .add(new THREE.Vector3(0, 0.255, 0).applyQuaternion(battery.quaternion));
  bike.add(batteryPlate);

  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.17, 0.064),
    new THREE.MeshBasicMaterial({
      map: createFrameTexture(),
      transparent: true,
      toneMapped: false,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    })
  );
  decal.position.set(0, 0, 0.086);
  decal.rotation.y = 0;
  battery.add(decal);

  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.19, 36),
    darkMetal
  );
  motor.rotation.x = Math.PI / 2;
  motor.position.copy(BB);
  motor.castShadow = true;
  bike.add(motor);

  const motorRing = new THREE.Mesh(new THREE.TorusGeometry(0.107, 0.006, 8, 48), accentMat);
  motorRing.position.copy(BB);
  motorRing.position.z = 0.098;
  bike.add(motorRing);

  const motorCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x35383f, metalness: 0.9, roughness: 0.28 })
  );
  motorCore.rotation.x = Math.PI / 2;
  motorCore.position.copy(BB);
  motorCore.position.z = 0.012;
  bike.add(motorCore);

  const chainring = new THREE.Mesh(
    new THREE.CylinderGeometry(0.112, 0.112, 0.009, 40),
    alloy
  );
  chainring.rotation.x = Math.PI / 2;
  chainring.position.copy(BB);
  chainring.position.z = 0.115;
  chainring.castShadow = true;
  bike.add(chainring);

  const chainringRing = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.008, 6, 48), accentMat);
  chainringRing.position.copy(BB);
  chainringRing.position.z = 0.115;
  bike.add(chainringRing);

  const cog = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 28), alloy);
  cog.rotation.x = Math.PI / 2;
  cog.position.set(REAR_X, HUB_Y, 0.1);
  bike.add(cog);

  bike.add(
    makeTube([BB.x, BB.y + 0.112, 0.115], [REAR_X, HUB_Y + 0.052, 0.1], 0.0045, blackRubber, 6)
  );
  bike.add(
    makeTube([BB.x, BB.y - 0.112, 0.115], [REAR_X, HUB_Y - 0.052, 0.1], 0.0045, blackRubber, 6)
  );

  [1, -1].forEach((side, index) => {
    const crank = new THREE.Group();
    crank.position.set(BB.x, BB.y, side * 0.135);
    crank.rotation.z = index === 0 ? 0.55 : 0.55 + Math.PI;
    bike.add(crank);

    const arm = new THREE.Mesh(
      new RoundedBoxGeometry(0.024, 0.19, 0.018, 3, 0.007),
      darkMetal
    );
    arm.position.y = 0.085;
    arm.castShadow = true;
    crank.add(arm);

    const pedal = new THREE.Mesh(
      new RoundedBoxGeometry(0.095, 0.016, 0.056, 3, 0.006),
      blackRubber
    );
    pedal.position.set(0, 0.185, side * 0.055);
    pedal.castShadow = true;
    crank.add(pedal);

    const pedalPin = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.04, 8), alloy);
    pedalPin.rotation.x = Math.PI / 2;
    pedalPin.position.set(0, 0.185, side * 0.025);
    crank.add(pedalPin);
  });

  const headlightBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.052, 0.055, 24),
    darkMetal
  );
  headlightBody.rotation.z = Math.PI / 2;
  headlightBody.position.set(0.52, 0.8, 0);
  headlightBody.castShadow = true;
  bike.add(headlightBody);

  const headlightLens = new THREE.Mesh(
    new THREE.CircleGeometry(0.04, 24),
    new THREE.MeshStandardMaterial({
      color: 0xfff3d0,
      emissive: 0xffe7a8,
      emissiveIntensity: 2.4,
      toneMapped: true,
    })
  );
  headlightLens.rotation.y = Math.PI / 2;
  headlightLens.position.set(0.548, 0.8, 0);
  bike.add(headlightLens);

  const headlightGlow = new THREE.PointLight(0xffe7a8, 2.2, 2.4, 2);
  headlightGlow.position.set(0.68, 0.8, 0);
  bike.add(headlightGlow);

  [FRONT_X, REAR_X].forEach((x) => {
    const fender = new THREE.Mesh(
      new THREE.TorusGeometry(0.402, 0.023, 8, 48, 1.7),
      blackRubber
    );
    fender.position.set(x, HUB_Y, 0);
    fender.rotation.z = Math.PI / 2 - 1.7 / 2 + (x > 0 ? 0.18 : -0.12);
    fender.castShadow = true;
    bike.add(fender);
  });

  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x101113,
    roughness: 0.7,
    metalness: 0.1,
  });

  const makeCable = (points, radius = 0.0065) => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 6, false), cableMat);
    cable.castShadow = true;
    bike.add(cable);
  };

  makeCable([
    [0.505, 1.03, -0.2],
    [0.545, 0.9, -0.15],
    [0.575, 0.72, -0.02],
    [0.64, 0.5, 0.06],
  ]);
  makeCable([
    [0.505, 1.03, 0.2],
    [0.4, 1.0, 0.15],
    [0.12, 0.94, 0.1],
    [-0.33, 0.82, 0.09],
    [-0.56, 0.5, 0.08],
  ]);

  [0.042, -0.042].forEach((z) => {
    bike.add(makeTube([-0.2, 1.015, z], [-0.43, 1.03, z], 0.005, alloy, 6));
  });

  const derailleur = new THREE.Mesh(
    new RoundedBoxGeometry(0.045, 0.075, 0.035, 3, 0.01),
    darkMetal
  );
  derailleur.position.set(-0.605, 0.285, 0.115);
  derailleur.rotation.z = 0.3;
  derailleur.castShadow = true;
  bike.add(derailleur);

  const jockey = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.014, 16),
    darkMetal
  );
  jockey.rotation.x = Math.PI / 2;
  jockey.position.set(-0.64, 0.25, 0.115);
  bike.add(jockey);

  wheels = [makeWheel(REAR_X), makeWheel(FRONT_X)];
  wheels.forEach((wheel) => bike.add(wheel));

  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.34 })
  );
  shadowCatcher.rotation.x = -Math.PI / 2;
  shadowCatcher.position.y = 0.003;
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);
}

function setupParticles() {
  const count = 220;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 1.2 + Math.random() * 2.6;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = 0.1 + Math.random() * 2.6;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xc9f73a,
    size: 0.014,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  particles = new THREE.Points(geometry, material);
  accentLinked.push(material);
  scene.add(particles);
}

function setupUI() {
  const revealEls = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.01, rootMargin: "0px 0px -2% 0px" }
  );
  revealEls.forEach((el) => observer.observe(el));

  const techObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        hotspotsRoot.classList.toggle("is-on", entry.isIntersecting);
      });
    },
    { threshold: 0.28 }
  );
  techObserver.observe(techSection);

  document.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.addEventListener("click", () => {
      const color = swatch.dataset.color;
      document.querySelectorAll(".swatch").forEach((s) => s.classList.remove("is-active"));
      swatch.classList.add("is-active");
      state.targetFrame.set(color);
      state.targetAccent.set(color);
      colorName.textContent = ACCENTS[color] || swatch.dataset.name;
      document.documentElement.style.setProperty("--accent", color);
    });
  });

  const features = document.querySelectorAll(".feature");
  const hotspotEls = document.querySelectorAll(".hotspot");
  features.forEach((feature) => {
    const sync = (active) => {
      hotspotEls.forEach((hotspot) => {
        hotspot.classList.toggle(
          "is-active",
          active && hotspot.dataset.hotspot === feature.dataset.part
        );
      });
    };
    feature.addEventListener("mouseenter", () => sync(true));
    feature.addEventListener("mouseleave", () => sync(false));
  });

  const modal = document.querySelector("#modal");
  const form = document.querySelector("#testRideForm");
  const success = document.querySelector(".form__success");
  let lastFocused = null;

  const openModal = () => {
    lastFocused = document.activeElement;
    form.hidden = false;
    success.hidden = true;
    form.reset();
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => form.querySelector("input")?.focus(), 300);
  };

  const closeModal = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (lastFocused) lastFocused.focus?.();
  };

  document.querySelectorAll("[data-open-modal]").forEach((btn) => {
    btn.addEventListener("click", openModal);
  });
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal.classList.contains("is-open")) closeModal();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.hidden = true;
    success.hidden = false;
  });

  const dragHint = document.querySelector(".drag-hint");
  if (dragHint) {
    canvas.addEventListener(
      "pointerdown",
      () => {
        dragHint.style.opacity = "0";
      },
      { once: true }
    );
  }
}

function bindPointer() {
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    state.dragging = true;
    state.lastX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    state.pointerX = (event.clientX / window.innerWidth) * 2 - 1;
    state.pointerY = (event.clientY / window.innerHeight) * 2 - 1;

    if (!state.dragging) return;
    const dx = event.clientX - state.lastX;
    state.lastX = event.clientX;
    state.dragTarget = THREE.MathUtils.clamp(state.dragTarget + dx * 0.007, -1.6, 1.6);
  });

  const endDrag = (event) => {
    state.dragging = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  window.addEventListener("pointerleave", () => {
    state.pointerX = 0;
    state.pointerY = 0;
  });
}

function sampleCamera(progress) {
  let index = 0;
  for (let i = 0; i < KEYS.length - 1; i += 1) {
    if (progress >= KEYS[i].time && progress <= KEYS[i + 1].time) {
      index = i;
      break;
    }
    if (progress > KEYS[KEYS.length - 1].time) index = KEYS.length - 2;
  }

  const a = KEYS[index];
  const b = KEYS[index + 1];
  const span = b.time - a.time || 1;
  const local = THREE.MathUtils.clamp((progress - a.time) / span, 0, 1);
  const t = ease(local);

  camPos.lerpVectors(a.p, b.p, t);
  camTgt.lerpVectors(a.t, b.t, t);
  return THREE.MathUtils.lerp(a.fov, b.fov, t);
}

function updateCamera(dt) {
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 1;
  const narrow = Math.max(0, 1.55 - aspect);
  const zoom = portrait
    ? THREE.MathUtils.clamp(1 + (1 - aspect) * 0.5, 1, 1.3)
    : 1 + narrow * 0.35;

  const fovBase = sampleCamera(state.smooth);
  camPos.sub(camTgt).multiplyScalar(zoom).add(camTgt);
  if (portrait) {
    camTgt.y -= 0.32;
    camTgt.x = camTgt.x * 0.3 + 0.28;
  } else {
    camTgt.x -= narrow * 1.2;
  }

  const smoothFactor = 1 - Math.pow(0.001, dt);
  state.pointerXS += (state.pointerX - state.pointerXS) * smoothFactor;
  state.pointerYS += (state.pointerY - state.pointerYS) * smoothFactor;

  camera.position.copy(camPos);
  camera.position.x += state.pointerXS * 0.11;
  camera.position.y -= state.pointerYS * 0.07;
  camera.fov += (fovBase + (portrait ? 3 : 0) - camera.fov) * smoothFactor;
  camera.updateProjectionMatrix();
  camera.lookAt(camTgt);
}

function updateHotspots() {
  if (!hotspotsRoot.classList.contains("is-on")) return;
  bike.updateMatrixWorld();

  hotspotEls.forEach((el) => {
    const hotspot = HOTSPOT_POINTS[el.dataset.hotspot];
    if (!hotspot) return;
    tmpV.copy(hotspot).applyMatrix4(bike.matrixWorld).project(camera);
    const visible = tmpV.z > -1 && tmpV.z < 1 && Math.abs(tmpV.x) < 1.25 && Math.abs(tmpV.y) < 1.3;
    el.style.visibility = visible ? "visible" : "hidden";
    const x = (tmpV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpV.y * 0.5 + 0.5) * window.innerHeight;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  });
}

const HOTSPOT_POINTS = {
  battery: new THREE.Vector3(0.19, 0.56, 0.1),
  motor: new THREE.Vector3(-0.075, 0.43, 0.14),
  display: new THREE.Vector3(0.485, 1.1, 0.03),
  brake: new THREE.Vector3(0.635, 0.5, 0.08),
};

let hotspotEls = [];

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clockDelta(), 0.05);
  const time = performance.now() * 0.001;

  state.progress = maxScroll > 0 ? THREE.MathUtils.clamp(window.scrollY / maxScroll, 0, 1) : 0;
  state.smooth += (state.progress - state.smooth) * (1 - Math.pow(0.0015, dt));
  scrollBar.style.width = `${state.progress * 100}%`;

  updateCamera(dt);

  state.drag += (state.dragTarget - state.drag) * (1 - Math.pow(0.004, dt));
  const sway = reduceMotion ? 0 : Math.sin(time * 0.32) * 0.045;
  bike.rotation.y = state.drag + sway;
  bike.position.y = reduceMotion ? 0 : Math.sin(time * 0.55) * 0.008;

  if (!reduceMotion) {
    state.spin += dt * 2.4;
    wheels.forEach((wheel) => {
      wheel.rotation.z = -state.spin;
    });

    if (particles) {
      particles.rotation.y = time * 0.035;
    }
  }

  frameMat.color.lerp(state.targetFrame, 1 - Math.pow(0.008, dt));
  accentMat.color.lerp(state.targetAccent, 1 - Math.pow(0.008, dt));
  accentMat.emissive.lerp(state.targetAccent, 1 - Math.pow(0.008, dt));
  accentLinked.forEach((material) => {
    material.color.lerp(state.targetAccent, 1 - Math.pow(0.008, dt));
    if (material.emissive) material.emissive.lerp(state.targetAccent, 1 - Math.pow(0.008, dt));
  });

  updateHotspots();
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    document.body.classList.add("is-live");
  }
}

let lastTime = performance.now();
function clockDelta() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;
  return dt;
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!renderer || !camera) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  hotspotEls = Array.from(document.querySelectorAll(".hotspot"));
  maxScroll = document.documentElement.scrollHeight - window.innerHeight;
}

init();
