// Omnia VRM Studio — script v5.2 'Real Motion': her filmed moves now drive the avatar
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
  } else if (kind === 'snow') {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(240,248,255,0.85)');
    g.addColorStop(1, 'rgba(220,240,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'rain') {
    const g = ctx.createLinearGradient(0, 8, 0, 120);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(59, 8, 10, 112);
  } else if (kind === 'confetti') {
    const cols = ['#ff2e88', '#ffc83b', '#00e5ff', '#a3ff5e', '#c084fc', '#ffffff'];
    const spots = [[30, 30], [66, 22], [98, 36], [44, 66], [84, 74], [24, 98], [70, 104], [104, 92]];
    spots.forEach((s, i) => {
      ctx.save();
      ctx.translate(s[0], s[1]);
      ctx.rotate(0.5 + i * 0.8);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-15, -7, 30, 14);
      ctx.restore();
    });
  } else if (kind === 'heart') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(64, 112);
    ctx.bezierCurveTo(10, 72, 16, 18, 46, 18);
    ctx.bezierCurveTo(58, 18, 64, 28, 64, 36);
    ctx.bezierCurveTo(64, 28, 70, 18, 82, 18);
    ctx.bezierCurveTo(112, 18, 118, 72, 64, 112);
    ctx.fill();
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
  motes:   { tex: 'glow',   color: 0xfef08a, size: 0.04,  count: 90, blending: THREE.AdditiveBlending },
  snow:    { tex: 'snow',   color: 0xffffff, size: 0.075, count: 240, blending: THREE.NormalBlending },
  pixie:   { tex: 'star',   color: 0xffa6e8, size: 0.05,  count: 130, blending: THREE.AdditiveBlending },
  rain:    { tex: 'rain',   color: 0x9fd8ff, size: 0.16,  count: 300, blending: THREE.NormalBlending },
  fireflies: { tex: 'glow', color: 0xa3ff5e, size: 0.045, count: 80, blending: THREE.AdditiveBlending },
  confetti: { tex: 'confetti', color: 0xffffff, size: 0.13, count: 170, blending: THREE.NormalBlending },
  hearts:  { tex: 'heart',  color: 0xff5e8a, size: 0.085, count: 70, blending: THREE.NormalBlending }
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
    } else if (currentFx === 'snow') {      // snowfall: fall slow, swaying
      y -= dt * 0.35 * sd.s;
      x += Math.sin(t * 1.1 + sd.p) * dt * 0.30;
      z += Math.cos(t * 0.9 + sd.p) * dt * 0.08;
      if (y < 0) { y = 3.0; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'pixie') {     // pixie dust: swirl upward, twinkling
      y += dt * 0.12 * sd.s;
      x += Math.sin(t * 2.2 + sd.p) * dt * 0.25;
      z += Math.cos(t * 1.8 + sd.p) * dt * 0.25;
      if (y > 3.0) { y = 0.05; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'rain') {      // neon rain: fast straight fall
      y -= dt * 2.8 * sd.s;
      x -= dt * 0.35 * sd.s;
      if (y < 0) { y = 3.0; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'fireflies') { // fireflies: slow wandering glow
      y += Math.sin(t * 0.9 + sd.p) * dt * 0.10;
      x += Math.cos(t * 0.6 + sd.p) * dt * 0.15;
      z += Math.sin(t * 0.5 + sd.p) * dt * 0.10;
      if (y > 2.9) y = 2.85;
      if (y < 0.1) y = 0.15;
    } else if (currentFx === 'confetti') {  // confetti: flutter down
      y -= dt * 0.55 * sd.s;
      x += Math.sin(t * 6.0 + sd.p) * dt * 0.45;
      z += Math.cos(t * 5.0 + sd.p) * dt * 0.20;
      if (y < 0) { y = 3.0; x = (Math.random() - 0.5) * 4.2; }
    } else if (currentFx === 'hearts') {    // hearts: float up, swaying
      y += dt * 0.28 * sd.s;
      x += Math.sin(t * 1.7 + sd.p) * dt * 0.22;
      if (y > 3.0) { y = 0.02; x = (Math.random() - 0.5) * 4.2; }
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
  if (currentFx === 'pixie') particleSystem.material.opacity = 0.55 + Math.sin(t * 5.0) * 0.30;
  if (currentFx === 'fireflies') particleSystem.material.opacity = 0.60 + Math.sin(t * 2.6) * 0.30;
}

buildParticles('motes');

let currentVrm = null;
let currentHand = 'relaxed';
let currentExpr = 'neutral';
let currentStance = 'none';
let isPaused = false;
let modelFlipped = false;
let crownGroup = null;
let crownOrbit = null;
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
  crownOrbit = null;

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83b, metalness: 0.92, roughness: 0.18 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x17171f, metalness: 0.95, roughness: 0.25 });
  const pinkGemMat = new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 0.85, roughness: 0.1 });
  const goldGemMat = new THREE.MeshStandardMaterial({ color: 0xffc83b, emissive: 0xff9d00, emissiveIntensity: 0.5, roughness: 0.1 });
  const cyanGemMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.55, roughness: 0.1 });

  // Black-chrome band with gold rims: the dark legendary base
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.110, 0.104, 0.030, 32, 1, true), chromeMat);
  band.material.side = THREE.DoubleSide;
  crownGroup.add(band);

  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.110, 0.0038, 10, 36), goldMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.015;
  crownGroup.add(rimTop);
  const rimBot = rimTop.clone();
  rimBot.position.y = -0.015;
  crownGroup.add(rimBot);

  // The Slash: a glowing Omnia-pink katana-slash gem across the front of the band
  const slash = new THREE.Mesh(new THREE.OctahedronGeometry(0.016, 0), pinkGemMat);
  slash.scale.set(0.32, 1.9, 0.45);
  slash.rotation.z = 0.65;
  slash.position.set(0, 0, 0.108);
  crownGroup.add(slash);

  // Gold spires with glowing orb tips; the front-center spire stands tallest
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const isFront = i === 0;
    const isMain = i % 2 === 0;
    const h = isFront ? 0.088 : (isMain ? 0.058 : 0.038);
    const holder = new THREE.Group();
    holder.rotation.y = angle;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(isFront ? 0.017 : 0.012, h, 4), goldMat);
    spire.position.set(0, 0.015 + h / 2, 0.107);
    spire.rotation.x = -0.13;
    holder.add(spire);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(isFront ? 0.0075 : 0.0052, 12, 10), isFront ? pinkGemMat : goldGemMat);
    orb.position.set(0, 0.015 + h + 0.006, 0.112);
    holder.add(orb);
    crownGroup.add(holder);
  }

  // The crown jewel: a big Omnia-pink diamond at the front peak
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.0155, 0), pinkGemMat);
  jewel.scale.set(1, 1.35, 1);
  jewel.position.set(0, 0.128, 0.115);
  crownGroup.add(jewel);

  // Halo orbit: three gems circle the crown on a tilted gold ring
  const tilt = new THREE.Group();
  tilt.rotation.x = 0.30;
  tilt.position.y = 0.055;
  crownOrbit = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.0016, 8, 48), goldMat);
  ring.rotation.x = Math.PI / 2;
  crownOrbit.add(ring);
  [pinkGemMat, goldGemMat, cyanGemMat].forEach((m, i) => {
    const a = (i / 3) * Math.PI * 2;
    const g = new THREE.Mesh(new THREE.OctahedronGeometry(0.0075, 0), m);
    g.position.set(Math.cos(a) * 0.148, 0, Math.sin(a) * 0.148);
    crownOrbit.add(g);
  });
  tilt.add(crownOrbit);
  crownGroup.add(tilt);

  const headBone = vrm.humanoid.getNormalizedBoneNode('head');
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


// ===== REAL MOTION v5.0: clips captured from Niecee's own filmed moves =====
// Her real body movement drives the body bones; finger shapes stay code-driven on top.
const MOCAP_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];
let mocapClip = null, mocapClipName = '', mocapTime = 0, mocapWeight = 0, mocapTargetWeight = 0, mocapRestHip = null, mocapFrom = null, mocapFade = 1;
const MOCAP_FADE = 0.35;
const _mocapQ = {}; MOCAP_BONES.forEach(n => _mocapQ[n] = new THREE.Quaternion());
const _mocapHip = new THREE.Vector3();
const _mqTmp = new THREE.Quaternion();
function mocapPlay(name) {
  const c = window.MOCAP_CLIPS && window.MOCAP_CLIPS[name];
  if (!c) return;
  if (currentVrm) {
    const from = { q: {}, hip: null };
    for (const bn of MOCAP_BONES) { const b = currentVrm.humanoid.getNormalizedBoneNode(bn); if (b) from.q[bn] = b.quaternion.clone(); }
    const hb = currentVrm.humanoid.getNormalizedBoneNode('hips');
    if (hb) from.hip = hb.position.clone();
    mocapFrom = from; mocapFade = 0;
  }
  mocapClip = c; mocapClipName = name; mocapTime = 0; mocapTargetWeight = 1;
}
function mocapStop() { mocapTargetWeight = 0; }
function mocapSample(clip, time) {
  const frames = clip.frames, n = frames.length, fps = clip.fps;
  let f = time * fps;
  if (clip.kind === 'loop') f = ((f % n) + n) % n; else f = Math.min(f, n - 1);
  const i0 = Math.floor(f), fr = f - i0;
  const i1 = clip.kind === 'loop' ? (i0 + 1) % n : Math.min(i0 + 1, n - 1);
  const A = frames[i0], Bf = frames[i1];
  for (const bn of MOCAP_BONES) {
    const qa = A.q[bn], qb = Bf.q[bn];
    _mocapQ[bn].set(qa[0], qa[1], qa[2], qa[3]);
    _mqTmp.set(qb[0], qb[1], qb[2], qb[3]);
    _mocapQ[bn].slerp(_mqTmp, fr);
  }
  _mocapHip.set(A.hip[0] + (Bf.hip[0] - A.hip[0]) * fr, A.hip[1] + (Bf.hip[1] - A.hip[1]) * fr, A.hip[2] + (Bf.hip[2] - A.hip[2]) * fr);
}
function applyMocap(dt) {
  if (!currentVrm) return;
  mocapWeight += (mocapTargetWeight - mocapWeight) * (1 - Math.exp(-dt / 0.12));
  if (mocapWeight < 0.01) { if (mocapTargetWeight === 0) { mocapClip = null; mocapClipName = ''; } return; }
  if (!mocapClip) return;
  mocapTime += dt; mocapFade += dt;
  mocapSample(mocapClip, mocapTime);
  const fadeK = mocapFrom ? THREE.MathUtils.smoothstep(Math.min(1, mocapFade / MOCAP_FADE), 0, 1) : 1;
  if (mocapFrom && fadeK >= 1) mocapFrom = null;
  for (const bn of MOCAP_BONES) {
    const bone = currentVrm.humanoid.getNormalizedBoneNode(bn);
    if (!bone) continue;
    if (mocapFrom && mocapFrom.q[bn]) { _mqTmp.copy(mocapFrom.q[bn]).slerp(_mocapQ[bn], fadeK); bone.quaternion.slerp(_mqTmp, mocapWeight); }
    else bone.quaternion.slerp(_mocapQ[bn], mocapWeight);
  }
  const hipsBone = currentVrm.humanoid.getNormalizedBoneNode('hips');
  if (hipsBone) {
    if (!mocapRestHip) mocapRestHip = hipsBone.position.clone();
    const dx = _mocapHip.x, dy = _mocapHip.y, dz = _mocapHip.z;
    let tx = dx, ty = dy, tz = dz;
    if (mocapFrom && mocapFrom.hip) { tx = mocapFrom.hip.x + (dx - mocapFrom.hip.x) * fadeK; ty = mocapFrom.hip.y + (dy - mocapFrom.hip.y) * fadeK; tz = mocapFrom.hip.z + (dz - mocapFrom.hip.z) * fadeK; }
    hipsBone.position.set(
      mocapRestHip.x + (tx - mocapRestHip.x) * mocapWeight,
      mocapRestHip.y + (ty - mocapRestHip.y) * mocapWeight,
      mocapRestHip.z + (tz - mocapRestHip.z) * mocapWeight);
  }
}

window.setHand = (gesture, btn) => {
  currentHand = gesture;
  const mocapFor = { kheart: 'kheart', peace: 'peace', shaka: 'shaka', rock: 'rock', rebel2: 'rebel2', crossedArms: 'folded' };
  if (mocapFor[gesture]) mocapPlay(mocapFor[gesture]); else mocapStop();
  document.querySelectorAll('#hand-grid .pose-btn, #attitude-grid .pose-btn, #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.setExpr = (expr, btn) => { currentExpr = expr; activateBtn(btn); };

window.setStance = (stance, btn) => {
  const stanceMocap = { dance: 'dance', dj: 'dj', stargazer: 'stargazer', airguitar: 'airguitar', arcade: 'arcade', dab: 'dab', kpop: 'kpop', mj: 'mj', bboy: 'bboy' };
  if (stanceMocap[stance]) { mocapPlay(stanceMocap[stance]); currentStance = 'none'; }
  else { mocapStop(); currentStance = stance; }
  document.querySelectorAll('#stance-grid .pose-btn:not(#crown-toggle), #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.toggleCrown = () => {
  crownVisible = !crownVisible;
  if (crownVisible) mocapPlay('crown'); else if (mocapClipName === 'crown') mocapStop();
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
    winter: 'radial-gradient(circle at 50% 45%, #1e3a5f 0%, #0a1626 100%)',
    fairy: 'radial-gradient(circle at 50% 45%, #14352b 0%, #0a1a14 100%)',
    island: 'radial-gradient(circle at 50% 35%, #2b5ea7 0%, #122a4d 100%)',
    battlerealm: 'radial-gradient(circle at 50% 40%, #3d2b57 0%, #170f29 100%)',
    studio: 'radial-gradient(circle at 50% 45%, #1c1236 0%, #090d12 100%)'
  };
  const file = bg;
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
  const wave = Math.sin(t * 1.1 + idx * 0.15) * motionAmp * 0.25;
  const splayWave = Math.cos(t * 0.9 + idx * 0.10) * (motionAmp * 0.10);
  const c = curl + wave;
  const s = spread + splayWave;

  if (finger === 'Thumb') {
    // Human thumb fold = opposition: the metacarpal swings the thumb ACROSS the palm (Y axis).
    // The old recipe folded on Z only, which measured FARTHER from the palm than rest — thumb stuck out.
    setTarget(`${side}ThumbProximal`, 0.46 * c, dir * s, dir * (c * 0.31));
    setTarget(`${side}ThumbMetacarpal`, -0.23 * c, dir * (c * 0.62), dir * (c * 0.31));
    setTarget(`${side}ThumbDistal`, 0.08 * c, 0, dir * (c * 0.38));
  } else {
    setTarget(`${side}${finger}Proximal`, 0, dir * s, -dir * (c * 1.104));
    setTarget(`${side}${finger}Intermediate`, 0, 0, -dir * (c * 1.14));
    setTarget(`${side}${finger}Distal`, 0, 0, -dir * (c * 0.744));
  }
}

// Set all five fingers of one hand at once. curls/spreads order: [Thumb, Index, Middle, Ring, Little]
function poseFingers(side, curls, spreads, t, amp = 0.012) {
  FINGERS.forEach((f, i) => setFingerTarget(side, f, curls[i], spreads ? spreads[i] : 0, t, amp));
}

function updateTargets(t) {
  const breathe = (Math.sin(t * 1.9) * 0.65 + Math.sin(t * 1.31 + 1.7) * 0.35) * 0.045;
  const armSway = (Math.cos(t * 1.5) * 0.6 + Math.cos(t * 1.13 + 0.6) * 0.4) * 0.04;
  const wristRock = Math.sin(t * 2.4) * 0.08;

  ['Left', 'Right'].forEach(side => {
    const dir = side === 'Left' ? 1 : -1;
    setFingerTarget(side, 'Thumb', 0.14, -0.10, t, 0.03);
    setFingerTarget(side, 'Index', 0.14, -0.03, t, 0.03);
    setFingerTarget(side, 'Middle', 0.13, 0.00, t, 0.03);
    setFingerTarget(side, 'Ring', 0.12, 0.03, t, 0.03);
    setFingerTarget(side, 'Little', 0.12, 0.06, t, 0.03);

    setTarget(`${side}Shoulder`, 0, 0, dir * (0.04 + breathe * 0.4));
    setTarget(`${side}UpperArm`, 0.06 + breathe, armSway, dir * (-1.18 + breathe));
    setTarget(`${side}LowerArm`, 0, dir * (0.24 + breathe), dir * (-0.18 - armSway));
    setTarget(`${side}Hand`, wristRock * 0.4, 0, dir * (0.06 + wristRock * 0.5));
  });

  setTarget('Spine', breathe * 0.35, 0, 0);
  setTarget('Head', Math.sin(t * 1.1) * 0.03, Math.cos(t * 0.9) * 0.04, 0);

  if (currentStance === 'sprint') {
    const run = Math.sin(t * 8.0);
    setTarget('Spine', 0.18, run * 0.12, 0);
    setTarget('LeftUpperLeg', run * 0.75, 0, 0);
    setTarget('RightUpperLeg', -run * 0.75, 0, 0);
    setTarget('LeftLowerLeg', Math.max(0, run) * 0.95, 0, 0);
    setTarget('RightLowerLeg', Math.max(0, -run) * 0.95, 0, 0);
    poseFingers('Left', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    poseFingers('Right', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    setTarget('LeftUpperArm', -run * 0.65, 0, -0.95);
    setTarget('RightUpperArm', run * 0.65, 0, 0.95);
    setTarget('LeftLowerArm', 0, -0.95, 0);
    setTarget('RightLowerArm', 0, 0.95, 0);
  } else if (currentStance === 'arcade') {
    poseFingers('Left', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    setTarget('LeftUpperArm', -0.10, 0.20, 1.55);
    setTarget('LeftLowerArm', 0, -0.35, 0.10);
    setTarget('Head', -0.10, 0, 0);
  } else if (currentStance === 'vortex') {
    // Vortex spin: ramrod straight — upright spine, arms out in one clean line, legs together
    setTarget('Spine', 0, 0, 0);
    setTarget('Chest', 0, 0, 0);
    setTarget('Head', 0, 0, 0);
    setTarget('LeftUpperArm', 0, 0, -0.30);
    setTarget('RightUpperArm', 0, 0, 0.30);
    setTarget('LeftLowerArm', 0, 0, 0);
    setTarget('RightLowerArm', 0, 0, 0);
    setTarget('LeftUpperLeg', 0, 0, 0.01);
    setTarget('RightUpperLeg', 0, 0, -0.01);
    setTarget('LeftLowerLeg', 0, 0, 0);
    setTarget('RightLowerLeg', 0, 0, 0);
  } else if (currentStance === 'dash') {
    // Cyber-dash: pitched hard into the run, arms trailing behind, legs driving
    const run = Math.sin(t * 10.5);
    setTarget('Spine', 0.52, run * 0.05, 0);
    setTarget('Chest', 0.18, 0, 0);
    setTarget('Head', -0.38, 0, 0);
    setTarget('LeftUpperLeg', -0.10 + run * 0.85, 0, 0);
    setTarget('RightUpperLeg', -0.10 - run * 0.85, 0, 0);
    setTarget('LeftLowerLeg', 0.12 + Math.max(0, run) * 1.30, 0, 0);
    setTarget('RightLowerLeg', 0.12 + Math.max(0, -run) * 1.30, 0, 0);
    poseFingers('Left', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    poseFingers('Right', [1.10, 1.15, 1.17, 1.19, 1.21], [0, 0, 0, 0, 0], t);
    setTarget('LeftUpperArm', 0.80, 0, -0.55);
    setTarget('RightUpperArm', 0.80, 0, 0.55);
    setTarget('LeftLowerArm', 0, -0.30, -0.10);
    setTarget('RightLowerArm', 0, 0.30, 0.10);
  } else if (currentStance === 'dj') {
    // Beat-drop DJ: one hand on the headphones, the other pumping the air, whole body grooving
    const pump = Math.pow(Math.max(0, Math.sin(t * 1.15 + 1.2)), 4);
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.90, 0.93, 0.95, 0.97, 0.99], [0, 0, 0, 0, 0], t);
      if (side === 'Right' && pump > 0.03) {
        setTarget(`${side}UpperArm`, -0.30 - pump * 0.25, dir * (0.45 - pump * 0.15), dir * (-1.35 + pump * 0.80));
        setTarget(`${side}LowerArm`, 0, dir * (-2.60 + pump * 1.70), dir * (-0.10 + pump * 0.05));
      } else {
        setTarget(`${side}UpperArm`, -0.30, dir * 0.45, dir * -1.35);
        setTarget(`${side}LowerArm`, 0, dir * -2.60, dir * -0.10);
      }
      setTarget(`${side}Hand`, 0, 0, 0);
    });
    setTarget('Spine', 0.10, Math.sin(t * 2.3) * 0.08, Math.sin(t * 2.3) * 0.06);
    setTarget('Head', 0.12, Math.sin(t * 2.3) * 0.15, Math.sin(t * 2.3) * 0.08);
  } else if (currentStance === 'stargazer') {
    // Star-gazer: arms resting at her sides, head tipped back, lost in the sky
    const sway = Math.sin(t * 0.8) * 0.03;
    setTarget('Head', -0.55, Math.sin(t * 0.5) * 0.05, 0);
    setTarget('Spine', -0.10, sway, 0);
    setTarget('LeftUpperArm', 0.06 + breathe, 0, -1.16);
    setTarget('RightUpperArm', 0.06 + breathe, 0, 1.16);
    setTarget('LeftLowerArm', 0, 0.24, -0.18);
    setTarget('RightLowerArm', 0, -0.24, 0.18);
    poseFingers('Left', [0.14, 0.14, 0.13, 0.12, 0.12], [-0.14, -0.03, 0, 0.03, 0.06], t);
    poseFingers('Right', [0.14, 0.14, 0.13, 0.12, 0.12], [-0.14, -0.03, 0, 0.03, 0.06], t);
  } else if (currentStance === 'domain') {
    // Domain seal: forearms crossed in front of her chest, fingers curled into the seal
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.75, 0.80, 0.82, 0.84, 0.86], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, -0.15, dir * -0.60, dir * -0.50);
      setTarget(`${side}LowerArm`, 0, dir * -1.85, dir * -1.05);
    });
    setTarget('Head', 0.10, 0, 0);
  } else if (currentStance === 'float') {
    // Zero-G float: limbs drift loose and weightless while she hovers
    setTarget('Head', -0.06, Math.sin(t * 0.7) * 0.05, 0);
    setTarget('LeftUpperLeg', -0.08, 0, 0.04);
    setTarget('RightUpperLeg', -0.02, 0, -0.04);
    setTarget('LeftLowerLeg', 0.38, 0, 0);
    setTarget('RightLowerLeg', 0.30, 0, 0);
    if (currentHand === 'relaxed') {
      setTarget('LeftUpperArm', 0.05, 0, -0.55);
      setTarget('RightUpperArm', 0.05, 0, 0.55);
      setTarget('LeftLowerArm', 0, -0.35, -0.10);
      setTarget('RightLowerArm', 0, 0.35, 0.10);
    }
  } else if (currentStance === 'holo') {
    // Holo-stream: slow dreamy sway while she floats
    setTarget('Spine', breathe * 0.5, Math.sin(t * 0.8) * 0.10, 0);
    setTarget('Head', Math.sin(t * 0.9) * 0.04, Math.sin(t * 0.6) * 0.12, 0);
  } else if (currentStance === 'dance') {
    // Idol dance: FULL energy — arms seesaw overhead, hips pop side to side, torso twists, knees bounce hard
    const w = Math.sin(t * 5.6);
    setTarget('Spine', 0.10, w * 0.12, w * 0.14);
    setTarget('Chest', 0.04, -w * 0.08, -w * 0.06);
    setTarget('Head', 0.08, w * 0.12, w * 0.16);
    setTarget('LeftUpperArm', -0.15, 0, 0.45 + w * 1.15);
    setTarget('RightUpperArm', -0.15, 0, -0.45 + w * 1.15);
    setTarget('LeftLowerArm', 0, -0.45 - w * 0.35, -0.10);
    setTarget('RightLowerArm', 0, 0.45 - w * 0.35, 0.10);
    setTarget('LeftUpperLeg', -0.06 - w * 0.08, 0, 0.05 + w * 0.05);
    setTarget('RightUpperLeg', -0.06 + w * 0.08, 0, -0.05 + w * 0.05);
    setTarget('LeftLowerLeg', 0.14 + Math.max(0, w) * 0.22, 0, 0);
    setTarget('RightLowerLeg', 0.14 + Math.max(0, -w) * 0.22, 0, 0);
    poseFingers('Left', [0.45, 0.17, 0.17, 0.17, 0.17], [-0.25, -0.20, -0.08, 0.12, 0.25], t);
    poseFingers('Right', [0.45, 0.17, 0.17, 0.17, 0.17], [-0.25, -0.20, -0.08, 0.12, 0.25], t);
  } else if (currentStance === 'powerup') {
    // Power-up charge: squats low, fists clenched at her sides, body trembling with energy
    const shake = Math.sin(t * 42) * 0.012;
    setTarget('Spine', 0.30 + shake, 0, 0);
    setTarget('Head', 0.22, 0, 0);
    setTarget('LeftUpperLeg', -0.38, 0, 0.06);
    setTarget('RightUpperLeg', -0.38, 0, -0.06);
    setTarget('LeftLowerLeg', 0.55, 0, 0);
    setTarget('RightLowerLeg', 0.55, 0, 0);
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [1.20, 1.50, 1.52, 1.54, 1.56], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, 0.32, 0, dir * -1.32);
      setTarget(`${side}LowerArm`, 0, dir * -0.55, dir * -0.30);
      setTarget(`${side}Hand`, 0, 0, 0);
    });
  } else if (currentStance === 'dab') {
    // The dab: one arm slashes across her face, the other flings out, head tucked in
    setTarget('RightUpperArm', -0.65, -0.30, 0.25);
    setTarget('RightLowerArm', 0, 2.90, 0);
    setTarget('RightHand', 0, 0, 0);
    setTarget('LeftUpperArm', 0.05, 0, 0.45);
    setTarget('LeftLowerArm', 0, -0.10, -0.05);
    setTarget('Head', 0.38, -0.25, 0.20);
    setTarget('Spine', 0.10, 0, 0.06);
    poseFingers('Right', [0.60, 0.17, 0.17, 0.17, 0.17], [0, -0.10, 0, 0, 0.10], t);
    poseFingers('Left', [0.60, 0.17, 0.17, 0.17, 0.17], [0, -0.10, 0, 0, 0.10], t);
  } else if (currentStance === 'airguitar') {
    // Air guitar: legs planted wide, one hand on the neck, the other strumming wild
    const strum = Math.sin(t * 9.0);
    setTarget('Spine', 0.14, 0, Math.sin(t * 4.5) * 0.05);
    setTarget('Head', -0.12 + Math.sin(t * 4.5) * 0.10, 0, 0);
    setTarget('LeftUpperLeg', -0.05, 0, 0.20);
    setTarget('RightUpperLeg', -0.05, 0, -0.20);
    setTarget('LeftUpperArm', -1.05, 0.45, -0.40);
    setTarget('LeftLowerArm', 0, -0.85, -0.30);
    setTarget('RightUpperArm', -0.25, -0.30, 0.85);
    setTarget('RightLowerArm', 0, 1.05 + strum * 0.38, 0.55);
    poseFingers('Left', [0.85, 0.55, 0.65, 0.75, 0.85], [0, 0, 0, 0, 0], t);
    poseFingers('Right', [0.70, 0.04, 0.00, 0.05, 0.10], [0, 0, 0, 0, 0], t);
  } else if (currentStance === 'blowkiss') {
    // Blow a kiss: her hand floats to her lips, then opens toward you as she blows
    const k = (Math.sin(t * 1.7) + 1) / 2;
    setTarget('Head', 0.06, 0, 0.06);
    setTarget('RightUpperArm', -0.85 - k * 0.20, -0.05, 0.40 - k * 0.15);
    setTarget('RightLowerArm', 0, 2.55 - k * 1.35, 0.50 - k * 0.30);
    setTarget('RightHand', 0, 0.40, 0);
    poseFingers('Right', [0.85 - k * 0.67, 0.70 - k * 0.52, 0.90 - k * 0.72, 1.00 - k * 0.82, 1.10 - k * 0.92], [-0.15, 0.10, 0, 0, 0.10], t);
    setTarget('LeftUpperArm', 0.06, 0, -1.18);
    setTarget('LeftLowerArm', 0, 0.24, -0.18);
  } else if (currentStance === 'moonwalk') {
    // Moonwalk glide: legs scissor-slide smooth, body leaned back cool
    const s = Math.sin(t * 2.3);
    setTarget('Spine', -0.10, 0, 0);
    setTarget('Head', 0.18, 0, 0.12);
    setTarget('LeftUpperLeg', s * 0.44, 0, 0.02);
    setTarget('RightUpperLeg', -s * 0.44, 0, -0.02);
    setTarget('LeftLowerLeg', Math.max(0, -s) * 0.45, 0, 0);
    setTarget('RightLowerLeg', Math.max(0, s) * 0.45, 0, 0);
    setTarget('LeftFoot', Math.max(0, -s) * 0.75, 0, 0);
    setTarget('RightFoot', Math.max(0, s) * 0.75, 0, 0);
    setTarget('LeftUpperArm', 0.06 - s * 0.15, 0, -1.12);
    setTarget('RightUpperArm', 0.06, 0, 1.14);
    setTarget('LeftLowerArm', 0, 0.30, -0.15);
    setTarget('RightLowerArm', 0, -0.35, 0.25);
  }

  const g = currentHand;
  if (g === 'crossedArms') {
    poseFingers('Left', [0.30, 0.38, 0.40, 0.42, 0.44], [0, 0, 0, 0, 0], t);
    setTarget('LeftShoulder', 0.06, 0.14, 0.06 + breathe * 0.3);
    setTarget('LeftUpperArm', -0.15 + breathe * 0.5, -0.60, -0.50);
    setTarget('LeftLowerArm', 0, -1.85, -0.80);
    setTarget('LeftHand', 0.9, 0, 0.4);

    poseFingers('Right', [0.30, 0.38, 0.40, 0.42, 0.44], [0, 0, 0, 0, 0], t);
    setTarget('RightShoulder', 0.08, -0.16, -0.08 - breathe * 0.3);
    setTarget('RightUpperArm', -0.15 + breathe * 0.6, 0.60, 0.50);
    setTarget('RightLowerArm', 0, 1.85, 0.80);
    setTarget('RightHand', 0.9, 0, -0.4);
  } else if (g === 'peace') {
    const scissor = 0;
    setFingerTarget('Left', 'Ring', 1.35, 0, t, 0.03);
    setFingerTarget('Left', 'Little', 1.37, 0, t, 0.03);
    setFingerTarget('Left', 'Thumb', 1.30, 0, t, 0.03);
    setFingerTarget('Left', 'Index', 0.18, 0.34 + scissor, t, 0.04);
    setFingerTarget('Left', 'Middle', 0.18, -0.16 - scissor, t, 0.04);
    setTarget('LeftUpperArm', -0.75 + breathe, 0.15 + armSway, -0.30);
    setTarget('LeftLowerArm', 0, -2.05 - breathe * 1.2, -0.10);
    setTarget('LeftHand', 0.08 + wristRock * 0.8, 0.20, 0.35 + armSway * 1.5);
  } else if (g === 'hips') {
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.80, 0.95, 0.97, 0.99, 1.01], [-0.15, -0.08, 0, 0.08, 0.15], t);
      setTarget(`${side}UpperArm`, 0.10 + breathe, dir * 0.30, dir * -1.10);
      setTarget(`${side}LowerArm`, 0, dir * -0.55, dir * -1.05);
      setTarget(`${side}Hand`, 0, 0, 0);
    });
  } else if (g === 'kheart') {
    // Korean finger heart: right hand up by her chin, thumb + index tips crossed, rest curled
    poseFingers('Right', [1.60, 0.20, 1.45, 1.50, 1.52], [-0.20, 0.60, 0, 0, 0], t);
    setTarget('RightUpperArm', -0.65 + breathe, -0.15, 0.42);
    setTarget('RightLowerArm', 0, 2.05, 0.60);
    setTarget('RightHand', 0, 0.75, 0);
  } else if (g === 'rock') {
    // Rock on: both hands up, index + pinky out, middle + ring held down by the thumb
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.95, 0.18, 1.38, 1.40, 0.18], [0, 0.10, 0, 0, -0.10], t);
      setTarget(`${side}UpperArm`, -0.35 + breathe, dir * 0.20, dir * -0.55);
      setTarget(`${side}LowerArm`, dir * 0.4, dir * -1.95, dir * 0.7);
      setTarget(`${side}Hand`, 0, 0, 0);
    });
  } else if (g === 'omniaSign') {
    // Omnia Prism: both hands up in front of her face, index + thumb tips meeting into a triangle
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.20, 0.18, 0.18, 0.18, 0.18], [-0.30, 0.20, dir * 0.15, dir * 0.30, dir * 0.45], t);
      setTarget(`${side}UpperArm`, -0.25 + breathe, dir * -0.45, dir * -0.38);
      setTarget(`${side}LowerArm`, 0, dir * -2.25, 0);
      setTarget(`${side}Hand`, 0.3, dir * 0.3, dir * 0.3);
    });
  } else if (g === 'bird' || g === 'rebel2') {
    // Middle finger: one hand, or both for Double
    const sides = g === 'bird' ? ['Right'] : ['Left', 'Right'];
    sides.forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [1.25, 1.35, 0.18, 1.38, 1.40], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, -0.55 + breathe, dir * 0.10, dir * -0.50);
      setTarget(`${side}LowerArm`, 0, dir * -1.95, dir * -0.30);
      setTarget(`${side}Hand`, 0.6, dir * 0.45, dir * 0.6);
    });
  } else if (g === 'westside') {
    // West Coast W (her reference photo): thumb out, index+middle+ring+pinky up, ring crossed over middle, palm forward
    poseFingers('Right', [0.15, 0.18, 0.18, 0.18, 0.18], [-0.40, -0.15, 0, -0.60, 0.30], t);
    setTarget('RightUpperArm', -0.55 + breathe, -0.10, 0.60);
    setTarget('RightLowerArm', 0, 1.95, 2.0);
    setTarget('RightHand', 0, 1.35, -0.6);
  } else if (g === 'vulcan') {
    // Vulcan salute: palm up, fingers split down the middle
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.18, 0.18, 0.18, 0.18, 0.18], [-0.30, -0.25, -0.17, 0.21, 0.31], t);
      setTarget(`${side}UpperArm`, -0.70 + breathe, dir * 0.15, dir * -0.32);
      setTarget(`${side}LowerArm`, dir * -0.8, dir * -2.00, dir * -0.4);
      setTarget(`${side}Hand`, 0, dir * 0.45, dir * -0.6);
    });
  } else if (g === 'shaka') {
    // Shaka: thumb + pinky out, hand up by her ear like a phone
    poseFingers('Right', [-0.30, 1.38, 1.40, 1.40, 0.18], [-1.30, 0, 0, 0, 0.60], t);
    setTarget('RightUpperArm', -0.60 + breathe, -0.60, 0.60);
    setTarget('RightLowerArm', 0, 2.60, 0);
    setTarget('RightHand', 0.3, 0, -0.4);
  } else if (g === 'gangster') {
    // Gangster lean: hard side lean, chin down, arms crossed low in front, one knee soft
    setTarget('Spine', -0.08, 0, 0.10);
    setTarget('Head', -0.20, 0.12, 0.10);
    setTarget('LeftUpperArm', -0.05 + breathe, -0.60, -0.50);
    setTarget('LeftLowerArm', 0, -1.85, -0.80);
    setTarget('LeftHand', 0.9, 0, 0.4);
    setTarget('RightUpperArm', -0.05 + breathe, 0.60, 0.50);
    setTarget('RightLowerArm', 0, 1.85, 0.80);
    setTarget('RightHand', 0.9, 0, -0.4);
    setTarget('LeftUpperLeg', 0, 0, 0.04);
    setTarget('RightUpperLeg', 0, -0.42, -0.16);
    setTarget('RightLowerLeg', 0.05, 0, 0);
    poseFingers('Left', [0.30, 0.38, 0.40, 0.42, 0.44], [0, 0, 0, 0, 0], t);
    poseFingers('Right', [0.30, 0.38, 0.40, 0.42, 0.44], [0, 0, 0, 0, 0], t);
  } else if (g === 'worldFlex') {
    // Royal flex: both arms flexed up like a champion, chin high, fists clenched
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [1.15, 1.20, 1.22, 1.24, 1.26], [0, 0, 0, 0, 0], t);
      setTarget(`${side}UpperArm`, -0.25, dir * 0.30, dir * -0.15);
      setTarget(`${side}LowerArm`, 0, dir * -2.00, dir * -0.20);
      setTarget(`${side}Hand`, 0, 0, 0);
    });
    setTarget('Head', -0.14, 0, 0);
  } else if (g === 'wave') {
    // Hero wave: right hand high overhead, waving side to side
    const waveSway = Math.sin(t * 5.0) * 0.35;
    poseFingers('Right', [0.15, 0.18, 0.18, 0.18, 0.18], [-0.35, -0.03, 0, 0.03, 0.06], t);
    setTarget('RightUpperArm', 0.10, -0.10, -1.95);
    setTarget('RightLowerArm', 1.2, 0.35, waveSway);
    setTarget('RightHand', -0.4, 0.2, -0.2 + waveSway * 0.8);
  } else if (g === 'clap') {
    // Hyper clap: both hands in front, opening and closing together
    const clapOpen = Math.sin(t * 6.0) * 0.5 + 0.5;
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [0.22, 0.17, 0.17, 0.17, 0.17], [dir * -0.10, 0, 0, 0, 0], t, 0.02);
      setTarget(`${side}UpperArm`, -0.55 + breathe, dir * -(0.60 - clapOpen * 0.40), dir * -0.30);
      setTarget(`${side}LowerArm`, 0, dir * -(1.40 - clapOpen * 0.30), dir * -(0.90 - clapOpen * 0.40));
      setTarget(`${side}Hand`, 0, 0, 0);
    });
  }
}

// Human motion: every bone rides a spring toward its target — it speeds up, eases in and
// settles, instead of sliding at one robotic constant speed. Each body part gets its own
// timing: finger joints cascade knuckle-to-tip like a real finger closing, the hand trails
// the arm with a little weight and lag, and left/right are a hair off-mirror (humans are).
const boneVel = {};
function smoothTimeFor(boneName) {
  if (/Distal/.test(boneName)) return 0.12;
  if (/Intermediate/.test(boneName)) return 0.09;
  if (/Thumb|Index|Middle|Ring|Little/.test(boneName)) return 0.06;
  if (/Hand$/.test(boneName)) return 0.26;
  if (/LowerArm/.test(boneName)) return 0.16;
  if (/LeftUpperArm/.test(boneName)) return 0.21;
  if (/UpperArm/.test(boneName)) return 0.19;
  if (/Head/.test(boneName)) return 0.22;
  if (/Spine|Chest/.test(boneName)) return 0.24;
  if (/Leg/.test(boneName)) return 0.17;
  return 0.18;
}
function springAxis(boneName, axis, current, target, dt) {
  const key = boneName + '.' + axis;
  let vel = boneVel[key] || 0;
  const smoothTime = Math.max(0.01, smoothTimeFor(boneName));
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel + omega * change) * dt;
  vel = (vel - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  if ((target - current > 0) === (out > target)) { out = target; vel = 0; }
  boneVel[key] = vel;
  return out;
}

function applyPoseAndExpressions(dt, t) {
  if (!currentVrm) return;
  const speed = Math.min(1, dt * 10);
  const sdt = Math.min(dt, 0.033);

  for (const [boneName, rot] of Object.entries(targetRot)) {
    const formattedName = boneName.charAt(0).toLowerCase() + boneName.slice(1);
    const bone = currentVrm.humanoid.getNormalizedBoneNode(formattedName) || currentVrm.humanoid.getNormalizedBoneNode(boneName);

    if (!bone) continue;
    bone.rotation.x = springAxis(boneName, 'x', bone.rotation.x, rot.x, sdt);
    bone.rotation.y = springAxis(boneName, 'y', bone.rotation.y, rot.y, sdt);
    bone.rotation.z = springAxis(boneName, 'z', bone.rotation.z, rot.z, sdt);
  }

  if (currentVrm.expressionManager) {
    ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'oh', 'blink', 'blinkLeft', 'blinkRight'].forEach(k => {
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
    const targetY = 0.22 + Math.sin(t * 2.4) * 0.05;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'skyleap') {
    const targetY = 0.40 + Math.sin(t * 2.4) * 0.06;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'dj') {
    const targetY = Math.pow(Math.sin(t * 4.6), 2) * 0.085;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'dash') {
    const targetY = Math.pow(Math.sin(t * 10.0), 2) * 0.03;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'dance') {
    const targetY = Math.pow(Math.sin(t * 5.6), 2) * 0.095;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'airguitar') {
    const targetY = Math.pow(Math.sin(t * 4.5), 2) * 0.035;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, targetY, speed);
  } else if (currentStance === 'powerup') {
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, -0.07, speed);
  } else if (currentStance === 'vortex') {
    currentVrm.scene.rotation.y += dt * 3.2;
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, 0, speed);
  } else {
    currentVrm.scene.position.y = THREE.MathUtils.lerp(currentVrm.scene.position.y, 0, speed);
  }

  if (currentStance !== 'vortex') {
    const targetRotY = modelFlipped ? Math.PI : 0;
    let ry = currentVrm.scene.rotation.y % (Math.PI * 2);
    if (ry > Math.PI) ry -= Math.PI * 2;
    if (ry < -Math.PI) ry += Math.PI * 2;
    currentVrm.scene.rotation.y = THREE.MathUtils.lerp(ry, targetRotY, speed);
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
      applyMocap(dt);
    }
  }

  if (crownOrbit && crownVisible) crownOrbit.rotation.y += dt * 0.9;
  if (currentVrm) currentVrm.update(dt);
  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = stageWrap.clientWidth / stageWrap.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(stageWrap.clientWidth, stageWrap.clientHeight);
});
