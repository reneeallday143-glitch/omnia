import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

const stageWrap = document.getElementById('stage-wrap');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, stageWrap.clientWidth / stageWrap.clientHeight, 0.05, 30);
camera.position.set(0, 1.25, 2.35);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(stageWrap.clientWidth, stageWrap.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.id = 'stage-canvas';
stageWrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.05, 0);
controls.update();

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(1, 2, 2);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.85));

const grid = new THREE.GridHelper(6, 24, 0xc084fc, 0x6b21a8);
scene.add(grid);

// ---------- ATMOSPHERE PARTICLES (each FX has its own shape + motion) ----------
let currentFx = 'motes';
let particleSystem = null;
let particleSeeds = [];

function makeFxTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (kind === 'petal') {
    ctx.translate(64, 64);
    ctx.rotate(0.7);
    const g = ctx.createLinearGradient(0, -38, 0, 38);
    g.addColorStop(0, '#ffd7ea');
    g.addColorStop(0.55, '#fb9ec9');
    g.addColorStop(1, '#f472b6');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.bezierCurveTo(26, -22, 30, 12, 0, 42);
    ctx.bezierCurveTo(-30, 12, -26, -22, 0, -40);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-6, -8, 6, 18, 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'bubble') {
    const g = ctx.createRadialGradient(46, 44, 4, 64, 64, 56);
    g.addColorStop(0, 'rgba(255,255,255,0.20)');
    g.addColorStop(0.7, 'rgba(140,200,255,0.06)');
    g.addColorStop(1, 'rgba(160,220,255,0.30)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(190,235,255,0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(64, 64, 52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(44, 40, 10, 6, -0.7, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'star') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(64, 4);
    ctx.quadraticCurveTo(70, 52, 124, 64);
    ctx.quadraticCurveTo(70, 76, 64, 124);
    ctx.quadraticCurveTo(58, 76, 4, 64);
    ctx.quadraticCurveTo(58, 52, 64, 4);
    ctx.fill();
  } else if (kind === 'laser') {
    const g = ctx.createLinearGradient(44, 0, 84, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(44, 0, 40, 128);
  } else { // soft glow dot (embers + motes)
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 62, 0, Math.PI * 2);
    ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}

const FX_CONF = {
  petals:  { tex: 'petal',  color: 0xffffff, size: 0.11,  count: 70, blending: THREE.NormalBlending },
  embers:  { tex: 'glow',   color: 0xff8c3a, size: 0.055, count: 80, blending: THREE.AdditiveBlending },
  bubbles: { tex: 'bubble', color: 0xffffff, size: 0.13,  count: 55, blending: THREE.NormalBlending },
  sparks:  { tex: 'star',   color: 0xffe066, size: 0.07,  count: 80, blending: THREE.AdditiveBlending },
  lasers:  { tex: 'laser',  color: 0xc084fc, size: 0.30,  count: 42, blending: THREE.AdditiveBlending },
  motes:   { tex: 'glow',   color: 0xfef08a, size: 0.04,  count: 90, blending: THREE.AdditiveBlending }
};

function buildParticles(fx) {
  if (particleSystem) {
    scene.remove(particleSystem);
    particleSystem.geometry.dispose();
    if (particleSystem.material.map) particleSystem.material.map.dispose();
    particleSystem.material.dispose();
    particleSystem = null;
  }
  const conf = FX_CONF[fx] || FX_CONF.motes;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(conf.count * 3);
  particleSeeds = [];
  for (let i = 0; i < conf.count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 4.2;
    pos[i * 3 + 1] = Math.random() * 3.0;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 2.8;
    particleSeeds.push({ s: 0.5 + Math.random(), p: Math.random() * Math.PI * 2, d: (Math.random() - 0.5) });
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: conf.size, map: makeFxTexture(conf.tex), color: conf.color,
    transparent: true, opacity: 0.9, depthWrite: false,
    blending: conf.blending, sizeAttenuation: true
  });
  particleSystem = new THREE.Points(geo, mat);
  scene.add(particleSystem);
}

function updateParticles(dt, t) {
  if (!particleSystem) return;
  const arr = particleSystem.geometry.attributes.position.array;
  const n = particleSeeds.length;
  for (let i = 0; i < n; i++) {
    const sd = particleSeeds[i];
    let x = arr[i * 3], y = arr[i * 3 + 1], z = arr[i * 3 + 2];
    if (currentFx === 'petals') {           // drift down, fluttering side to side
      y -= dt * 0.22 * sd.s;
      x += Math.sin(t * 1.6 + sd.p) * dt * 0.35;
      z += Math.cos(t * 1.2 + sd.p) * dt * 0.12;
      if (y < 0) { y = 3.0; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'bubbles') {   // rise and wobble
      y += dt * 0.30 * sd.s;
      x += Math.sin(t * 2.0 + sd.p) * dt * 0.18;
      if (y > 3.0) { y = 0.02; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'embers') {    // rise like fire sparks
      y += dt * 0.45 * sd.s;
      x += (Math.sin(t * 3.0 + sd.p) * 0.12 + sd.d * 0.10) * dt;
      if (y > 3.0) { y = 0.02; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'sparks') {    // fall fast like falling stars
      y -= dt * 1.15 * sd.s;
      x += sd.d * dt * 0.4;
      if (y < 0) { y = 3.0; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'lasers') {    // streak down diagonally, fast
      y -= dt * 2.4 * sd.s;
      x -= dt * 1.1 * sd.s;
      if (y < 0 || x < -2.4) { y = 3.0 + Math.random() * 0.5; x = (Math.random() - 0.1) * 4.2; }
    } else {                                 // motes: slow golden dust drift
      y += Math.sin(t * 0.7 + sd.p) * dt * 0.05 + dt * 0.02;
      x += Math.cos(t * 0.5 + sd.p) * dt * 0.06;
      if (y > 3.0) y = 0.05;
      if (y < 0) y = 2.9;
    }
    arr[i * 3] = x; arr[i * 3 + 1] = y; arr[i * 3 + 2] = z;
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
  if (currentFx === 'embers') particleSystem.material.opacity = 0.65 + Math.sin(t * 9.0) * 0.25;
}

buildParticles('motes');

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

// Automatically load your model file on startup
const loader = new GLTFLoader();
loader.register(parser => new VRMLoaderPlugin(parser));
loader.load('./Niecee%20C.vrm', (gltf) => {
  const vrm = gltf.userData.vrm;
  if (!vrm) { console.error('No VRM found in gltf'); return; }
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  vrm.scene.rotation.y = 0;
  scene.add(vrm.scene);
  currentVrm = vrm;
  attachCrown(vrm);
  console.log('Niecee C.vrm loaded successfully!');
}, undefined, (err) => console.error('VRM load error:', err));

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
  const toggleBtn = document.getElementById('crown-toggle');
  if (toggleBtn) toggleBtn.classList.toggle('active', crownVisible);
};

window.togglePause = () => {
  isPaused = !isPaused;
  const btn = document.getElementById('pause-btn');
  if (btn) {
    btn.textContent = isPaused ? '▶ Stand Still (Paused)' : '⏸ Stand Still (Playing)';
    btn.classList.toggle('active', isPaused);
  }
};

window.flipModel = () => {
  modelFlipped = !modelFlipped;
  if (currentVrm) currentVrm.scene.rotation.y = modelFlipped ? Math.PI : 0;
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
  const gradients = {
    cyber: 'radial-gradient(circle at 50% 35%, #12263a 0%, #090d16 100%)',
    sakura: 'radial-gradient(circle at 50% 45%, #26223d 0%, #141522 100%)',
    skylounge: 'radial-gradient(circle at 50% 35%, #1e293b 0%, #0f172a 100%)',
    omnialobby: 'radial-gradient(circle at 50% 40%, #1d1b4b 0%, #090a1a 100%)',
    nebula: 'radial-gradient(circle at 50% 45%, #2e1065 0%, #090514 100%)',
    miami: 'radial-gradient(circle at 50% 40%, #4c1d95 0%, #1f1135 100%)',
    crimson: 'radial-gradient(circle at 50% 45%, #381822 0%, #14090d 100%)',
    studio: 'radial-gradient(circle at 50% 45%, #1c1236 0%, #090d12 100%)'
  };
  const file = { cyber: 'cyber', sakura: 'sakura', skylounge: 'skylounge', omnialobby: 'omnialobby', nebula: 'nebula', miami: 'miami', crimson: 'crimson', studio: 'studio' }[bg] || 'studio';
  // Real illustrated scene from the backgrounds folder; the color stays as a fallback underneath.
  stageWrap.style.background = `url('./${file}.jpg') center / cover no-repeat, ${gradients[bg] || gradients.studio}`;
};

window.setFx = (fx, btn) => {
  activateBtn(btn);
  currentFx = fx;
  buildParticles(fx);
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

// Set all five fingers of one hand at once. curls/spreads order: [Thumb, Index, Middle, Ring, Little]
function poseFingers(side, curls, spreads, t, amp = 0.03) {
  FINGERS.forEach((f, i) => setFingerTarget(side, f, curls[i], spreads ? spreads[i] : 0, t, amp));
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

  const g = currentHand;
  if (g === 'crossedArms') {
    ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].forEach((f, i) => setFingerTarget('Left', f, 0.45 + i * 0.06, 0, t, 0.04));
    setTarget('LeftShoulder', 0.06, 0.14, 0.06 + breathe * 0.3);
    setTarget('LeftUpperArm', 0.34 + breathe * 0.5, 0.58, -0.62);
    setTarget('LeftLowerArm', 0.10, -1.88, -0.32);
    setTarget('LeftHand', 0.05, -0.25, -0.15);

    const tap1 = Math.sin(t * 3.2) * 0.09;
    const tap2 = Math.sin(t * 3.2 - 0.5) * 0.10;
    const tap3 = Math.sin(t * 3.2 - 1.0) * 0.11;
    const tap4 = Math.sin(t * 3.2 - 1.5) * 0.12;
    setFingerTarget('Right', 'Thumb', 0.35, -0.22, t, 0.04);
    setFingerTarget('Right', 'Index', 0.28 + tap1, 0.12, t, 0.05);
    setFingerTarget('Right', 'Middle', 0.34 + tap2, 0.04, t, 0.05);
    setFingerTarget('Right', 'Ring', 0.40 + tap3, -0.04, t, 0.05);
    setFingerTarget('Right', 'Little', 0.46 + tap4, -0.12, t, 0.05);

    setTarget('RightShoulder', 0.08, -0.16, -0.08 - breathe * 0.3);
    setTarget('RightUpperArm', 0.38 + breathe * 0.6, -0.64, 0.58);
    setTarget('RightLowerArm', -0.12, 1.92, 0.36);
    setTarget('RightHand', 0.12 + wristRock * 0.3, 0.35, 0.18);
  } else if (g === 'peace') {
    const scissor = Math.sin(t * 3.4) * 0.06;
    setFingerTarget('Left', 'Ring', 1.50, 0, t, 0.03);
    setFingerTarget('Left', 'Little', 1.54, 0, t, 0.03);
    setFingerTarget('Left', 'Thumb', 1.05, -0.32, t, 0.03);
    setFingerTarget('Left', 'Index', -0.06, 0.22 + scissor, t, 0.04);
    setFingerTarget('Left', 'Middle', -0.06, -0.22 - scissor, t, 0.04);
    setTarget('LeftUpperArm', 0.55 + breathe, 0.20 + armSway, -0.42);
    setTarget('LeftLowerArm', 0, -1.85 - breathe * 1.2, -0.30);
    setTarget('LeftHand', 0.08 + wristRock * 0.8, 1.15, 0.10 + armSway * 1.5);
  } else if (g === 'hips') {
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      FINGERS.forEach((f, i) => setFingerTarget(side, f, 0.45 + i * 0.05, 0, t, 0.04));
      setTarget(`${side}UpperArm`, 0.22 + breathe, dir * 0.42, dir * -0.92);
      setTarget(`${side}LowerArm`, 0, dir * -1.25, dir * -0.15);
      setTarget(`${side}Hand`, 0, dir * -0.50, dir * -0.30);
    });
  } else if (g === 'kheart') {
    // Korean finger heart: right hand up by her chin, thumb + index tips crossed, rest curled
    poseFingers('Right', [0.85, 0.55, 1.45, 1.50, 1.52], [-0.30, 0.30, 0, 0, 0], t);
    setTarget('RightUpperArm', 0.55 + breathe, -0.30, 0.55);
    setTarget('RightLowerArm', 0, 1.95, 0.30);
    setTarget('RightHand', 0.15, -0.55, 0.10);
  } else if (g === 'rock') {
    // Rock on: both hands up, index + pinky out, middle + ring held down by the thumb
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.95, -0.05, 1.50, 1.52, -0.05], [0, 0.10, 0, 0, -0.10], t);
      setTarget(`${side}UpperArm`, 0.45 + breathe, dir * 0.20, dir * -0.62);
      setTarget(`${side}LowerArm`, 0, dir * -1.85, dir * -0.30);
      setTarget(`${side}Hand`, 0, dir * 0.90, 0);
    });
  } else if (g === 'omniaSign') {
    // Omnia Prism: both hands up in front of her face, index + thumb tips meeting into a triangle
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.15, -0.05, 1.45, 1.50, 1.52], [dir * -0.35, dir * 0.35, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, 0.62 + breathe, dir * 0.42, dir * -0.50);
      setTarget(`${side}LowerArm`, 0, dir * -1.65, dir * -0.55);
      setTarget(`${side}Hand`, 0.10, dir * 0.50, dir * 0.20);
    });
  } else if (g === 'bird' || g === 'rebel2') {
    // Middle finger: one hand, or both for Double
    const sides = g === 'bird' ? ['Right'] : ['Left', 'Right'];
    sides.forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [1.30, 1.45, -0.06, 1.48, 1.50], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, 0.40 + breathe, dir * 0.15, dir * -0.66);
      setTarget(`${side}LowerArm`, 0, dir * -1.80, dir * -0.25);
      setTarget(`${side}Hand`, 0, dir * 0.30, 0);
    });
  } else if (g === 'westside') {
    // West Coast W: middle + ring up and split wide, index + pinky folded under the thumb
    poseFingers('Right', [1.25, 1.45, -0.05, -0.05, 1.45], [0, 0, -0.38, 0.38, 0], t);
    setTarget('RightUpperArm', 0.45 + breathe, -0.20, 0.62);
    setTarget('RightLowerArm', 0, 1.85, -0.30);
    setTarget('RightHand', 0, -0.90, 0);
  } else if (g === 'vulcan') {
    // Vulcan salute: palm up, fingers split down the middle
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.25, -0.04, -0.04, -0.04, -0.04], [-0.30, -0.22, -0.10, 0.24, 0.36], t);
      setTarget(`${side}UpperArm`, 0.50 + breathe, dir * 0.25, dir * -0.60);
      setTarget(`${side}LowerArm`, 0, dir * -1.80, dir * -0.30);
      setTarget(`${side}Hand`, 0, dir * 0.60, 0);
    });
  } else if (g === 'shaka') {
    // Shaka: thumb + pinky out, hand up by her ear like a phone
    poseFingers('Right', [-0.05, 1.48, 1.50, 1.50, -0.05], [-0.35, 0, 0, 0, 0.35], t);
    setTarget('RightUpperArm', 0.30 + breathe, -0.55, 0.95);
    setTarget('RightLowerArm', 0, 2.00, 0.40);
    setTarget('RightHand', 0, -0.30, 0.20);
  } else if (g === 'gangster') {
    // Gangster lean: whole body tilted, chin up, one arm hanging low and loose
    setTarget('Spine', 0.06, 0, 0.20);
    setTarget('Head', 0.05, 0.15, 0.14);
    setTarget('LeftUpperArm', 0.10, 0.10, -0.95);
    setTarget('LeftLowerArm', 0, 0.50, -0.20);
    setTarget('RightUpperArm', 0.10, -0.10, 1.30);
    setTarget('RightLowerArm', 0, -0.50, 0.20);
  } else if (g === 'worldFlex') {
    // Royal flex: both arms flexed up like a champion, chin high, fists clenched
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [1.15, 1.20, 1.22, 1.24, 1.26], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, 0.30, dir * 0.35, dir * -0.30);
      setTarget(`${side}LowerArm`, 0, dir * -2.15, dir * -0.25);
      setTarget(`${side}Hand`, 0, 0, dir * 0.30);
    });
    setTarget('Head', -0.14, 0, 0);
  } else if (g === 'wave') {
    // Hero wave: right hand high overhead, waving side to side
    const waveSway = Math.sin(t * 5.0) * 0.35;
    poseFingers('Right', [0.30, -0.04, -0.04, -0.04, -0.04], [-0.15, -0.06, 0, 0.06, 0.12], t);
    setTarget('RightUpperArm', 0.30, -0.20, -1.85);
    setTarget('RightLowerArm', 0, 0.35, waveSway);
    setTarget('RightHand', 0, 0, waveSway * 0.8);
  } else if (g === 'clap') {
    // Hyper clap: both hands in front, opening and closing together
    const clapOpen = Math.sin(t * 6.0) * 0.5 + 0.5;
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.30, 0.05, 0.05, 0.05, 0.05], [dir * -0.10, 0, 0, 0, 0], t, 0.02);
      setTarget(`${side}UpperArm`, 0.55 + breathe, dir * (0.15 + clapOpen * 0.22), dir * -0.55);
      setTarget(`${side}LowerArm`, 0, dir * -(1.15 + clapOpen * 0.30), dir * -0.20);
      setTarget(`${side}Hand`, 0, dir * 0.40, 0);
    });
  }

  if (currentStance === 'sprint') {
    const run = Math.sin(t * 8.0);
    setTarget('Spine', 0.18, run * 0.12, 0);
    setTarget('LeftUpperLeg', run * 0.75, 0, 0);
    setTarget('RightUpperLeg', -run * 0.75, 0, 0);
    setTarget('LeftLowerLeg', Math.max(0, -run) * 0.95, 0, 0);
    setTarget('RightLowerLeg', Math.max(0, run) * 0.95, 0, 0);
    poseFingers('Left', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    poseFingers('Right', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    setTarget('LeftUpperArm', -run * 0.65, 0, -0.62);
    setTarget('RightUpperArm', run * 0.65, 0, 0.62);
    setTarget('LeftLowerArm', 0, -0.95, 0);
    setTarget('RightLowerArm', 0, 0.95, 0);
  } else if (currentStance === 'arcade') {
    poseFingers('Left', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    setTarget('LeftUpperArm', 0.20, 0.30, 1.85);
    setTarget('LeftLowerArm', 0, -0.55, 0.20);
    setTarget('Head', -0.10, 0, 0);
  } else if (currentStance === 'dash') {
    // Cyber-dash: leaned hard forward, arms swept back, legs driving
    const run = Math.sin(t * 10.0);
    setTarget('Spine', 0.34, run * 0.06, 0);
    setTarget('Head', -0.18, 0, 0);
    setTarget('LeftUpperLeg', run * 0.60, 0, 0);
    setTarget('RightUpperLeg', -run * 0.60, 0, 0);
    setTarget('LeftLowerLeg', Math.max(0, -run) * 0.80, 0, 0);
    setTarget('RightLowerLeg', Math.max(0, run) * 0.80, 0, 0);
    setTarget('LeftUpperArm', -0.70, 0, -0.85);
    setTarget('RightUpperArm', -0.70, 0, 0.85);
  } else if (currentStance === 'dj') {
    // Beat-drop DJ: hands clamped on her headphones, head bobbing to the beat
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.90, 0.93, 0.95, 0.97, 0.99], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, 0.15, dir * 0.75, dir * -1.15);
      setTarget(`${side}LowerArm`, 0, dir * -2.25, dir * -0.35);
      setTarget(`${side}Hand`, 0, dir * 0.30, dir * 0.20);
    });
    setTarget('Spine', 0.10, Math.sin(t * 2.3) * 0.08, 0);
    setTarget('Head', 0.12, Math.sin(t * 2.3) * 0.15, 0);
  } else if (currentStance === 'stargazer') {
    // Star-gazer: head tilted to the sky, one arm reaching up and pointing
    setTarget('Head', -0.42, 0, 0);
    setTarget('Spine', -0.08, 0, 0);
    setTarget('RightUpperArm', 0.15, -0.10, -2.20);
    setTarget('RightLowerArm', 0, 0.25, 0.10);
    poseFingers('Right', [0.20, -0.05, 0.50, 0.70, 0.80], [0, 0, 0, 0, 0], t);
  } else if (currentStance === 'domain') {
    // Domain seal: forearms crossed in front of her chest, fingers curled into the seal
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.75, 0.80, 0.82, 0.84, 0.86], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, 0.48, dir * 0.35, dir * -0.55);
      setTarget(`${side}LowerArm`, 0, dir * -1.95, dir * -0.30);
    });
    setTarget('Head', 0.10, 0, 0);
  } else if (currentStance === 'float') {
    // Zero-G float: limbs drift loose and weightless while she hovers
    setTarget('Head', -0.06, Math.sin(t * 0.7) * 0.05, 0);
    setTarget('LeftUpperLeg', 0.10, 0, 0.03);
    setTarget('RightUpperLeg', 0.16, 0, -0.03);
    setTarget('LeftLowerLeg', 0.30, 0, 0);
    setTarget('RightLowerLeg', 0.22, 0, 0);
    if (currentHand === 'relaxed') {
      setTarget('LeftUpperArm', 0.10, 0, -0.82);
      setTarget('RightUpperArm', 0.10, 0, 0.82);
      setTarget('LeftLowerArm', 0, -0.35, -0.10);
      setTarget('RightLowerArm', 0, 0.35, 0.10);
    }
  } else if (currentStance === 'holo') {
    // Holo-stream: slow dreamy sway while she floats
    setTarget('Spine', breathe * 0.5, Math.sin(t * 0.8) * 0.10, 0);
    setTarget('Head', Math.sin(t * 0.9) * 0.04, Math.sin(t * 0.6) * 0.12, 0);
  }
}

function applyPoseAndExpressions(dt, t) {
  if (!currentVrm) return;
  const speed = Math.min(1, dt * 10);

  for (const [boneName, rot] of Object.entries(targetRot)) {
    const formattedName = boneName.charAt(0).toLowerCase() + boneName.slice(1);
    const bone = currentVrm.humanoid.getNormalizedBoneNode(formattedName) || currentVrm.humanoid.getNormalizedBoneNode(boneName);

    if (!bone) continue;
    bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, rot.x, speed);
    bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, rot.y, speed);
    bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, rot.z, speed);
  }

  if (currentVrm.expressionManager) {
    ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'oh'].forEach(k => {
      currentVrm.expressionManager.setValue(k, 0);
    });

    if (currentExpr === 'happy' || currentExpr === 'smug') {
      currentVrm.expressionManager.setValue('happy', currentExpr === 'smug' ? 0.55 : 1.0);
    }
    if (currentExpr === 'oh') currentVrm.expressionManager.setValue('oh', 0.85);
    if (currentExpr === 'sad' || currentExpr === 'sorrow') currentVrm.expressionManager.setValue('sad', 1.0);
    if (currentExpr === 'angry' || currentExpr === 'furious') currentVrm.expressionManager.setValue('angry', 1.0);
    if (currentExpr === 'surprised' || currentExpr === 'shocked') currentVrm.expressionManager.setValue('surprised', 1.0);
    if (currentExpr === 'relaxed') currentVrm.expressionManager.setValue('relaxed', 1.0);
    if (currentExpr === 'wink') currentVrm.expressionManager.setValue('blinkLeft', 1.0);
  }

  if (currentStance === 'float' || currentStance === 'holo' || currentStance === 'domain') {
    const targetY = 0.14 + Math.sin(t * 2.4) * 0.05;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'skyleap') {
    const targetY = 0.28 + Math.sin(t * 2.4) * 0.05;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'dj') {
    const targetY = Math.abs(Math.sin(t * 4.6)) * 0.045;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'dash') {
    const targetY = Math.abs(Math.sin(t * 10.0)) * 0.03;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'vortex') {
    currentVrm.scene.rotation.y += dt * 3.2;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, 0, speed);
  } else {
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, 0, speed);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  if (!isPaused) {
    updateParticles(dt, t);
    if (currentVrm) {
      updateTargets(t);
      applyPoseAndExpressions(dt, t);
    }
  }

  if (currentVrm) currentVrm.update(dt);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = stageWrap.clientWidth / stageWrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(stageWrap.clientWidth, stageWrap.clientHeight);
});
