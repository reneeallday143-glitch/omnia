const stageWrap = document.getElementById('stage-wrap');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(32, stageWrap.clientWidth / stageWrap.clientHeight, 0.05, 30);
camera.position.set(0, 1.25, 2.35);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(stageWrap.clientWidth, stageWrap.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.id = 'stage-canvas';
stageWrap.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.05, 0);
controls.update();

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(1, 2, 2);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.85));

// Purple Neon Grid
const grid = new THREE.GridHelper(6, 24, 0xc084fc, 0x6b21a8);
scene.add(grid);

// Floating Particles
const particleCount = 65;
const particleGroup = new THREE.Group();
const particleMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.55 });
const particles = [];
for (let i = 0; i < particleCount; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), particleMat);
  m.position.set((Math.random() - 0.5) * 3.8, Math.random() * 2.8, (Math.random() - 0.5) * 2.6);
  particleGroup.add(m);
  particles.push({ mesh: m, speed: 0.15 + Math.random() * 0.25, drift: (Math.random() - 0.5) * 0.18 });
}
scene.add(particleGroup);

let currentVrm = null;
let currentHand = 'relaxed';
let currentExpr = 'neutral';
let currentStance = 'none';
let isPaused = false;
let modelFlipped = false;
let crownGroup = null;
let crownVisible = true;
const clock = new THREE.Clock();
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
const targetRot = {};

function setTarget(boneName, x, y, z) {
  targetRot[boneName] = { x, y, z };
}

function attachCrown(vrm) {
  if (crownGroup && crownGroup.parent) crownGroup.parent.remove(crownGroup);
  crownGroup = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83b, metalness: 0.92, roughness: 0.18 });
  const darkGoldMat = new THREE.MeshStandardMaterial({ color: 0xb88214, metalness: 0.88, roughness: 0.28 });
  const gemColors = [0xff1744, 0x00e5ff, 0x2979ff, 0xff1744, 0x00e5ff, 0x2979ff, 0xff1744, 0x2979ff];

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.102, 0.026, 32, 1, true), goldMat);
  band.material.side = THREE.DoubleSide;
  crownGroup.add(band);

  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.0035, 10, 36), darkGoldMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.013;
  crownGroup.add(rimTop);

  const rimBot = rimTop.clone();
  rimBot.position.y = -0.013;
  crownGroup.add(rimBot);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const isFront = i === 0;
    const isMain = i % 2 === 0;
    const h = isFront ? 0.068 : (isMain ? 0.050 : 0.034);

    const spireHolder = new THREE.Group();
    spireHolder.rotation.y = angle;

    const spire = new THREE.Mesh(new THREE.ConeGeometry(isFront ? 0.018 : 0.013, h, 4), goldMat);
    spire.position.set(0, 0.013 + h / 2, 0.106);
    spire.rotation.x = -0.14;
    spireHolder.add(spire);

    const finial = new THREE.Mesh(
      new THREE.OctahedronGeometry(isFront ? 0.0085 : 0.0055, 0),
      new THREE.MeshStandardMaterial({ color: gemColors[i], emissive: gemColors[i], emissiveIntensity: 0.45, roughness: 0.1 })
    );
    finial.position.set(0, 0.013 + h + 0.010, 0.114);
    spireHolder.add(finial);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(isFront ? 0.010 : 0.0065, 1),
      new THREE.MeshStandardMaterial({ color: gemColors[i], emissive: gemColors[i], emissiveIntensity: 0.35, roughness: 0.15 })
    );
    gem.scale.set(1, 1, 0.55);
    gem.position.set(0, 0, 0.109);
    spireHolder.add(gem);

    crownGroup.add(spireHolder);
  }

  const headBone = vrm.humanoid.getNormalizedBoneNode('Head');
  if (headBone) {
    crownGroup.position.set(0, 0.145, -0.01);
    crownGroup.rotation.x = -0.12;
    crownGroup.visible = crownVisible;
    headBone.add(crownGroup);
  }
}

// Load your exact file: Niecee C.vrm
const loader = new THREE.GLTFLoader();
loader.register((parser) => new THREE_VRM.VRMLoaderPlugin(parser));
loader.load('./Niecee%20C.vrm', (gltf) => {
  const vrm = gltf.userData.vrm;
  THREE_VRM.VRMUtils.removeUnnecessaryVertices(gltf.scene);
  THREE_VRM.VRMUtils.combineSkeletons(gltf.scene);
  vrm.scene.rotation.y = Math.PI;
  scene.add(vrm.scene);
  currentVrm = vrm;
  attachCrown(vrm);
});

function activateBtn(btn) {
  if (!btn) return;
  btn.parentElement.querySelectorAll('.pose-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

window.setHand = (gesture, btn) => {
  currentHand = gesture;
  document.querySelectorAll('#hand-grid .pose-btn, #attitude-grid .pose-btn, #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.setExpr = (expr, btn) => { currentExpr = expr; activateBtn(btn); };

window.setStance = (stance, btn) => {
  currentStance = stance;
  document.querySelectorAll('#stance-grid .pose-btn:not(#crown-toggle), #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.toggleCrown = () => {
  crownVisible = !crownVisible;
  if (crownGroup) crownGroup.visible = crownVisible;
  document.getElementById('crown-toggle').classList.toggle('active', crownVisible);
};

window.togglePause = () => {
  isPaused = !isPaused;
  const btn = document.getElementById('pause-btn');
  btn.textContent = isPaused ? '▶ Stand Still (Paused)' : '⏸ Stand Still (Playing)';
  btn.classList.toggle('active', isPaused);
};

window.flipModel = () => {
  modelFlipped = !modelFlipped;
  if (currentVrm) currentVrm.scene.rotation.y = modelFlipped ? 0 : Math.PI;
};

window.zoomCam = (delta) => {
  camera.position.z = Math.max(0.55, Math.min(4.5, camera.position.z + delta));
};

window.faceCam = () => {
  camera.position.set(0, 1.44, 0.90);
  controls.target.set(0, 1.42, 0);
  controls.update();
};

window.setBg = (bg, btn) => {
  activateBtn(btn);
  const map = {
    cyber: 'radial-gradient(circle at 50% 35%, #12263a 0%, #090d16 100%)',
    sakura: 'radial-gradient(circle at 50% 45%, #26223d 0%, #141522 100%)',
    skylounge: 'radial-gradient(circle at 50% 35%, #1e293b 0%, #0f172a 100%)',
    omnialobby: 'radial-gradient(circle at 50% 40%, #1d1b4b 0%, #090a1a 100%)',
    nebula: 'radial-gradient(circle at 50% 45%, #2e1065 0%, #090514 100%)',
    miami: 'radial-gradient(circle at 50% 40%, #4c1d95 0%, #1f1135 100%)',
    crimson: 'radial-gradient(circle at 50% 45%, #381822 0%, #14090d 100%)',
    studio: 'radial-gradient(circle at 50% 45%, #1c1236 0%, #090d12 100%)'
  };
  stageWrap.style.background = map[bg] || map.studio;
};

window.setFx = (fx, btn) => {
  activateBtn(btn);
  const colors = { petals: 0xf472b6, embers: 0xf97316, bubbles: 0x38bdf8, sparks: 0xfde047, lasers: 0xa855f7, motes: 0xfef08a };
  particleMat.color.setHex(colors[fx] || 0xfef08a);
};

function setFingerTarget(side, finger, curl, spread = 0, t = 0, motionAmp = 0.06) {
  const dir = side === 'Left' ? 1 : -1;
  const idx = FINGERS.indexOf(finger);
  const wave = Math.sin(t * 2.8 + idx * 0.85) * motionAmp;
  const splayWave = Math.cos(t * 2.1 + idx * 0.6) * (motionAmp * 0.45);
  const c = curl + wave;
  const s = spread + splayWave;

  if (finger === 'Thumb') {
    setTarget(`${side}ThumbProximal`, 0.18 * c, dir * s, dir * (c * 0.45));
    setTarget(`${side}ThumbIntermediate`, 0.10 * c, 0, dir * (c * 0.55));
    setTarget(`${side}ThumbDistal`, 0.05 * c, 0, dir * (c * 0.50));
  } else {
    setTarget(`${side}${finger}Proximal`, 0, dir * s, dir * (c * 0.85));
    setTarget(`${side}${finger}Intermediate`, 0, 0, dir * (c * 0.95));
    setTarget(`${side}${finger}Distal`, 0, 0, dir * (c * 0.70));
  }
}

function updateTargets(t) {
  const breathe = Math.sin(t * 1.9) * 0.045;
  const armSway = Math.cos(t * 1.5) * 0.04;
  const wristRock = Math.sin(t * 2.4) * 0.08;

  ['Left', 'Right'].forEach(side => {
    const dir = side === 'Left' ? 1 : -1;
    setFingerTarget(side, 'Thumb', 0.36, -0.14, t, 0.05);
    setFingerTarget(side, 'Index', 0.22, -0.03, t, 0.06);
    setFingerTarget(side, 'Middle', 0.34, 0.00, t, 0.07);
    setFingerTarget(side, 'Ring', 0.44, 0.03, t, 0.07);
    setFingerTarget(side, 'Little', 0.52, 0.06, t, 0.08);

    setTarget(`${side}Shoulder`, 0, 0, dir * (0.04 + breathe * 0.4));
    setTarget(`${side}UpperArm`, 0.06 + breathe, armSway, dir * (-1.18 + breathe));
    setTarget(`${side}LowerArm`, 0, dir * (0.24 + breathe), dir * (-0.18 - armSway));
    setTarget(`${side}Hand`, wristRock * 0.4, 0, dir * (0.06 + wristRock * 0.5));
  });

  setTarget('Spine', breathe * 0.35, 0, 0);
  setTarget('Head', Math.sin(t * 1.1) * 0.03, Math.cos(t * 0.9) * 0.04, 0);
  setTarget('LeftUpperLeg', 0, 0, 0);
  setTarget('RightUpperLeg', 0, 0, 0);
  setTarget('LeftLowerLeg', 0, 0, 0);
  setTarget('RightLowerLeg', 0, 0, 0);

  const g = currentHand;
  if (g === 'crossedArms') {
    ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].forEach((f, i) => setFingerTarget('Left', f, 0.45 + i * 0.06, 0, t, 0.04));
    setTarget('LeftShoulder', 0.06, 0.14, 0.06 + breathe * 0.3);
    setTarget('LeftUpperArm', -0.42 + breathe * 0.5, 0.58, -0.62);
    setTarget('LeftLowerArm', 0.10, 1.88, -0.32);
    setTarget('LeftHand', 0.05, -0.25, -0.15);

    const tap1 = Math.sin(t * 3.2) * 0.09;
    const tap2 = Math.sin(t * 3.2 - 0.5) * 0.10;
    const tap3 = Math.sin(t * 3.2 - 1.0) * 0.11;
    const tap4 = Math.sin(t * 3.2 - 1.5) * 0.12;
    setFingerTarget('Right', 'Thumb', 0.35, -0.22, t, 0.04);
    setFingerTarget('Right', 'Index', 0.28 + tap1, 0.12, t, 0.05);
    setFingerTarget('Right', 'Middle', 0.34 + tap2, 0.04, t, 0.05);
