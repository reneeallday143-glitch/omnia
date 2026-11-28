// Omnia VRM Studio — script v6.2 'Katana on the back': v6.1's three models,
// poses, fingers, dances and mocap are UNCHANGED — but now there is a first
// accessory: a katana carried diagonally across the back, handle over the
// right shoulder, built from code primitives like the crown (no model file).
// It rides EVERY model (Niecee, Ren, the realistic girl), toggled by the
// ⚔️ Katana button, default OFF so nobody's look changes until she turns it
// on. Per-model fit is measured (lab61/lab61b): the sheath sits just off
// each model's back, scaled by height. The crown is untouched and the two can
// be on at the same time. v6.2 includes v6.1, so pasting it also brings the
// realistic girl in (if realistic-girl.vrm is uploaded).
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

// ===== KATANA ACCESSORY (v6.2): the first Omnia accessory =====
// A katana carried diagonally across the back, handle over the right shoulder
// — the Slash logo is a katana slash, so this is the brand made wearable.
// Built from three.js primitives in code, exactly like the crown: no external
// model file. It rides EVERY model (Niecee, Ren, the realistic girl), unlike
// the crown which is Niecee's only. Default OFF — nobody's look changes until
// she turns it on.
let katanaGroup = null;
let katanaVisible = false;

// Per-model fit, measured lab61/lab61b (outside-in rays, back surface at chest
// height): back surface z is Niecee -0.111 (chest bone z 0.019), Ren -0.113
// (chest 0.023), realistic girl -0.038 (chest 0.000). `back` is the chest-local
// z of the katana centerline: back-surface distance + sheath radius + a small
// gap, so the sheath rides just off the back instead of clipping into it —
// plus 0.025 of motion margin, because lab61 found the lower sheath pressed
// ~0.017-0.019 into the torso mid-dougie and in the gangster lean (the chest
// twists but the hips don't follow it), so the first offsets were too tight —
// plus a second 0.025 after the CORRECTED skinned measurement (lab61 v2)
// still showed -0.016 mid-dougie on Niecee and the realistic girl, and -0.012
// at rest on the realistic girl's shoulder-blade bulge (her back bulges to
// -0.086 at mid-back). The clip is partly lateral (chest twist swings the
// sheath sideways into the curved back), so the bump buys less than its full
// size mid-dance — the renders are the check that the rest gap still reads
// like a katana on a back and not a floating stick. tiltX was flipped to
// +0.08 after the side renders showed the sheath floating ~6cm off the back:
// positive tiltX brings the handle/guard closer over the shoulder (where the
// eye reads the carry) and swings the lower sheath further back (where the
// dougie clip happens), like a real strapped katana — top held close, tip
// angled away.
// scale: katana length by height ratio (Ren 1.958/1.640 = 1.19, realistic
// 1.590/1.640 = 0.97). tiltZ: the diagonal — positive tips the handle toward
// -X, the anatomical right shoulder (chest local +X is her left, +Y up, +Z
// forward, measured lab61). tiltX: top forward over the shoulder, tip back.
const KATANA_FIT = {
  niecee:    { scale: 1.00, back: -0.205, y: 0.02, tiltZ: 0.66, tiltX: 0.08 },
  ren:       { scale: 1.19, back: -0.215, y: 0.02, tiltZ: 0.66, tiltX: 0.08 },
  realistic: { scale: 0.97, back: -0.115, y: 0.02, tiltZ: 0.66, tiltX: 0.08 },
};

function buildKatana(scale) {
  const g = new THREE.Group();
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0d0d12, metalness: 0.6, roughness: 0.35 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x17171f, metalness: 0.95, roughness: 0.25 });
  const wrapMat = new THREE.MeshStandardMaterial({ color: 0x111116, metalness: 0.1, roughness: 0.9 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: 0xff2e88, emissive: 0xff2e88, emissiveIntensity: 0.85, roughness: 0.1 });
  const s = scale; // every size below is in Niecee metres, scaled per model

  // Sheath (saya): tapered black tube, tip at the bottom (-Y), mouth at the top.
  const sheath = new THREE.Mesh(new THREE.CylinderGeometry(0.017 * s, 0.012 * s, 0.60 * s, 20), blackMat);
  sheath.position.y = -0.14 * s;
  g.add(sheath);
  // Sheath tip cap (kojiri): pink.
  const tipCap = new THREE.Mesh(new THREE.CylinderGeometry(0.013 * s, 0.010 * s, 0.03 * s, 20), pinkMat);
  tipCap.position.y = -0.45 * s;
  g.add(tipCap);
  // Pink accent line down the outward face of the sheath (-Z = away from the back).
  const accent = new THREE.Mesh(new THREE.BoxGeometry(0.006 * s, 0.56 * s, 0.002 * s), pinkMat);
  accent.position.set(0, -0.14 * s, -0.016 * s);
  g.add(accent);
  // Guard (tsuba): black-chrome disc with a glowing pink edge.
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * s, 0.042 * s, 0.008 * s, 28), chromeMat);
  guard.position.y = 0.17 * s;
  g.add(guard);
  const guardEdge = new THREE.Mesh(new THREE.TorusGeometry(0.042 * s, 0.0025 * s, 8, 36), pinkMat);
  guardEdge.rotation.x = Math.PI / 2;
  guardEdge.position.y = 0.17 * s;
  g.add(guardEdge);
  // Handle (tsuka): black-wrapped grip above the guard, pink wrap bands.
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.015 * s, 0.26 * s, 16), wrapMat);
  handle.position.y = 0.31 * s;
  g.add(handle);
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0155 * s, 0.0022 * s, 8, 20), pinkMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = (0.20 + i * 0.055) * s;
    g.add(ring);
  }
  // Pommel cap (kashira): pink.
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * s, 0.014 * s, 0.012 * s, 16), pinkMat);
  pommel.position.y = 0.445 * s;
  g.add(pommel);
  // Cord (sageo): a pink loop around the sheath just below the guard.
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.020 * s, 0.0025 * s, 8, 24), pinkMat);
  cord.rotation.x = Math.PI / 2;
  cord.position.y = 0.145 * s;
  g.add(cord);
  return g;
}

function attachKatana(vrm, key) {
  if (katanaGroup && katanaGroup.parent) katanaGroup.parent.remove(katanaGroup);
  const fit = KATANA_FIT[key] || KATANA_FIT.niecee;
  katanaGroup = buildKatana(fit.scale);
  const chestBone = vrm.humanoid.getNormalizedBoneNode('chest');
  if (chestBone) {
    katanaGroup.position.set(0, fit.y, fit.back);
    katanaGroup.rotation.set(fit.tiltX, 0, fit.tiltZ);
    katanaGroup.visible = katanaVisible;
    chestBone.add(katanaGroup);
  }
}

// ===== MODEL SWITCHER (v6.1): Niecee + Ren + the realistic girl =====
// Ren's file must sit next to script.js in the repo as Ren_1_tfkr.vrm (the exact
// name Niecee exported). The realistic girl's file is realistic-girl.vrm —
// upload it to the repo root the same way (Upload files, NEVER the pencil
// icon, which wipes .vrm files to 2 bytes). Same Pages origin as Niecee C.vrm,
// so no CORS issue.
// She can rename Ren's file to Ren.vrm if she wants — but then MODELS.ren.url
// must change to './Ren.vrm' to match.
const MODELS = {
  niecee: { label: 'Niecee', url: './Niecee%20C.vrm' },
  ren: { label: 'Ren', url: './Ren_1_tfkr.vrm' },
  realistic: { label: 'Realistic Girl', url: './realistic-girl.vrm' }
};
let activeModel = 'niecee';
const loadedModels = {}; // key -> vrm (kept in memory so switching back is instant)
let modelLoading = null; // key currently loading, or null
let modelStatusEl = null; // status line under the switcher buttons (injected below)
// Camera framing per model, measured lab55: Ren is 1.19x her height
// (1.958 vs 1.640; hips 1.118 vs 0.939; head 1.723 vs 1.417). Niecee's
// numbers are exactly the v5.9 values — her framing does not change.
const CAMERA_HOME = {
  niecee: { camY: 1.25, targetY: 1.05 },
  ren: { camY: 1.49, targetY: 1.25 },
  // realistic girl: height ratio 1.590/1.640 = 0.970 x Niecee's (lab58)
  realistic: { camY: 1.21, targetY: 1.02 }
};
const CAMERA_FACE = {
  niecee: { cam: [0, 1.44, 0.90], target: [0, 1.42, 0] },
  ren: { cam: [0, 1.75, 1.07], target: [0, 1.73, 0] },
  // realistic girl: head height ratio 1.434/1.417 = 1.012 x Niecee's (lab58)
  realistic: { cam: [0, 1.46, 0.91], target: [0, 1.44, 0] }
};

function setModelStatus(msg) { if (modelStatusEl) modelStatusEl.textContent = msg; }

const MODEL_BUTTON_LABELS = { niecee: '💗 Niecee', ren: '🖤 Ren', realistic: '💜 Realistic' };
function updateModelButtons() {
  document.querySelectorAll('.model-btn').forEach(b => {
    const k = b.dataset.model;
    b.classList.toggle('active', k === activeModel);
    b.textContent = (MODEL_BUTTON_LABELS[k] || k) + (modelLoading === k ? ' …' : '');
  });
}

function activateModel(key, vrm) {
  // Stop every trace of motion state from the previous model so nothing bleeds
  // across: a clip mid-play holds a snapshot of the OLD model's bones, and
  // mocapRestHip is the OLD model's rest hip height. Both must be cleared.
  mocapStop(); mocapClip = null; mocapClipName = ''; mocapFrom = null; mocapRestHip = null;
  mocapWeight = 0; mocapTargetWeight = 0; mocapTime = 0; mocapFade = 1;
  for (const k in boneVel) delete boneVel[k];
  if (currentVrm) scene.remove(currentVrm.scene);
  currentVrm = vrm;
  vrm.scene.rotation.y = modelFlipped ? Math.PI : 0;
  vrm.scene.position.set(0, 0, 0);
  scene.add(vrm.scene);
  activeModel = key;
  const home = CAMERA_HOME[key];
  camera.position.set(0, home.camY, 2.35);
  controls.target.set(0, home.targetY, 0);
  controls.update();
  // The gold crown is Niecee's only — it never attaches to Ren or the
  // realistic girl. On either of them the existing crown is taken off the
  // stage; switching back rebuilds it on her.
  if (key === 'niecee') attachCrown(vrm);
  else if (crownGroup && crownGroup.parent) crownGroup.parent.remove(crownGroup);
  // The katana rides EVERY model — re-attach it to the new model's chest when
  // it is on (same rebuild pattern as the crown, but not Niecee-only).
  if (katanaVisible) attachKatana(vrm, key);
  else if (katanaGroup && katanaGroup.parent) katanaGroup.parent.remove(katanaGroup);
  const ct = document.getElementById('crown-toggle');
  if (ct) {
    ct.style.opacity = key === 'niecee' ? '' : '0.35';
    ct.style.pointerEvents = key === 'niecee' ? '' : 'none';
  }
  updateModelButtons();
}

function loadModel(key) {
  if (key === activeModel && currentVrm) return;
  if (loadedModels[key]) { activateModel(key, loadedModels[key]); setModelStatus(''); return; }
  if (modelLoading === key) return; // already fetching — Niecee stays on stage meanwhile
  modelLoading = key;
  setModelStatus('Loading ' + MODELS[key].label + '…');
  updateModelButtons();
  loader.load(MODELS[key].url, (gltf) => {
    modelLoading = null;
    const vrm = gltf.userData.vrm;
    if (!vrm) {
      setModelStatus('Could not load ' + MODELS[key].label + ' — that file has no VRM in it.');
      updateModelButtons();
      return;
    }
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    vrm.scene.rotation.y = 0;
    loadedModels[key] = vrm;
    activateModel(key, vrm);
    setModelStatus('');
    console.log(MODELS[key].label + ' loaded successfully!');
  }, undefined, (err) => {
    modelLoading = null;
    console.error('VRM load error:', err);
    // Plain words, no silent fallback: Niecee stays on stage, the missing
    // model is not faked.
    setModelStatus('Could not load ' + MODELS[key].label + ' — upload ' + MODELS[key].url.replace('./', '') + ' to the repo first, then tap again.');
    updateModelButtons();
  });
}

window.switchModel = (key) => { loadModel(key); };

// Inject the model switcher into the sidebar (no index.html change needed).
// Runs at module load, after the sidebar exists in the DOM.
(function injectModelSwitcher() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="section-title">MODEL — WHO IS ON STAGE</div>' +
    '<div class="grid-2">' +
    '<button class="pose-btn model-btn active" data-model="niecee" onclick="switchModel(\'niecee\')">💗 Niecee</button>' +
    '<button class="pose-btn model-btn" data-model="ren" onclick="switchModel(\'ren\')">🖤 Ren</button>' +
    '<button class="pose-btn model-btn" data-model="realistic" onclick="switchModel(\'realistic\')">💜 Realistic</button>' +
    '</div>' +
    '<div id="model-status" style="font-size:11px;color:#f0abfc;margin-top:6px;min-height:14px;"></div>';
  sidebar.insertBefore(wrap, sidebar.firstChild);
  modelStatusEl = document.getElementById('model-status');
})();

// Automatically load your model file on startup (Niecee first, as always)
const loader = new GLTFLoader();
loader.register(parser => new VRMLoaderPlugin(parser));
loadModel('niecee');

function activateBtn(btn) {
  if (!btn) return;
  btn.parentElement.querySelectorAll('.pose-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}


// ===== REAL MOTION v5.0: clips captured from Niecee's own filmed moves =====
// Her real body movement drives the body bones; finger shapes stay code-driven on top.
const MOCAP_BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];
let mocapClip = null, mocapClipName = '', mocapTime = 0, mocapWeight = 0, mocapTargetWeight = 0, mocapRestHip = null, mocapFrom = null, mocapFade = 1;
// v6.0: every mocap clip was captured from NIecee, so its hip track is HER metres.
// HER_REST_HIP is her hips bone at rest, measured on her real model (lab55).
// The clip's hip DEVIATION from that rest is scaled by (active model's rest hip
// height / her rest hip height) — 1.0 for her (behaviour unchanged, exactly),
// ~1.19 for Ren — so his longer legs get proportionally bigger hip travel and
// his feet stay on the floor instead of sinking through it (lab56: -0.055m).
const MOCAP_FADE = 0.22;
const _mocapQ = {}; MOCAP_BONES.forEach(n => _mocapQ[n] = new THREE.Quaternion());
const _mocapHip = new THREE.Vector3();
const _mqTmp = new THREE.Quaternion();
const _mqTmp2 = new THREE.Quaternion();
const _mocapSnap = {};
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
  mocapWeight += (mocapTargetWeight - mocapWeight) * (1 - Math.exp(-dt / 0.05));
  if (mocapWeight < 0.01) { if (mocapTargetWeight === 0) { mocapClip = null; mocapClipName = ''; } return; }
  if (!mocapClip) return;
  mocapTime += dt; mocapFade += dt;
  mocapSample(mocapClip, mocapTime);
  for (const bn of MOCAP_BONES) { const b0 = currentVrm.humanoid.getNormalizedBoneNode(bn); if (b0) _mocapSnap[bn] = _mocapSnap[bn] ? _mocapSnap[bn].copy(b0.quaternion) : b0.quaternion.clone(); }
  const fadeK = mocapFrom ? THREE.MathUtils.smoothstep(Math.min(1, mocapFade / MOCAP_FADE), 0, 1) : 1;
  if (mocapFrom && fadeK >= 1) mocapFrom = null;
  for (const bn of MOCAP_BONES) {
    const bone = currentVrm.humanoid.getNormalizedBoneNode(bn);
    if (!bone) continue;
    const ampW = Math.min(1.35, mocapWeight * 1.22); // EXCITEMENT: overshoot the source swing by 22%
    if (mocapFrom && mocapFrom.q[bn]) { _mqTmp.copy(mocapFrom.q[bn]).slerp(_mocapQ[bn], fadeK); bone.quaternion.copy(_mocapSnap[bn]).slerp(_mqTmp, ampW); }
    else bone.quaternion.copy(_mocapSnap[bn]).slerp(_mocapQ[bn], ampW);
  }
  const hipsBone = currentVrm.humanoid.getNormalizedBoneNode('hips');
  if (hipsBone) {
    if (!mocapRestHip) mocapRestHip = hipsBone.position.clone();
    const dx = _mocapHip.x, dy = _mocapHip.y, dz = _mocapHip.z;
    // v6.0 per-model hip scale (see decl above): deviation from HER rest hip,
    // scaled to the active model's size. The crossfade reference r0 is chosen
    // so the hips are continuous at clip start (no snap) and land on the
    // scaled clip deviation at full fade — for Niecee (scale 1.0) this reduces
    // to the exact v5.9 formula.
    const HER_REST_HIP = { x: 0, y: 0.9392, z: 0.0036 };
    const hipScale = mocapRestHip.y / HER_REST_HIP.y;
    let tx = dx, ty = dy, tz = dz;
    let rx = HER_REST_HIP.x, ry = HER_REST_HIP.y, rz = HER_REST_HIP.z;
    if (mocapFrom && mocapFrom.hip) {
      const fh = mocapFrom.hip;
      tx = fh.x + (dx - fh.x) * fadeK; ty = fh.y + (dy - fh.y) * fadeK; tz = fh.z + (dz - fh.z) * fadeK;
      const r0x = fh.x - (fh.x - mocapRestHip.x) / hipScale, r0y = fh.y - (fh.y - mocapRestHip.y) / hipScale, r0z = fh.z - (fh.z - mocapRestHip.z) / hipScale;
      rx = r0x + (HER_REST_HIP.x - r0x) * fadeK; ry = r0y + (HER_REST_HIP.y - r0y) * fadeK; rz = r0z + (HER_REST_HIP.z - r0z) * fadeK;
    }
    hipsBone.position.set(
      mocapRestHip.x + (tx - rx) * hipScale * mocapWeight,
      mocapRestHip.y + (ty - ry) * hipScale * mocapWeight * 1.25,
      mocapRestHip.z + (tz - rz) * hipScale * mocapWeight);
  }
}

window.setHand = (gesture, btn) => {
  currentHand = gesture;
  // v5.9: the 7 measured signs are PURE code poses — no mocap clip. The clips used
  // to override the code arms and morph the sign (Korean Heart showed three looks
  // in seconds), so they are decoupled: only crossedArms still plays its clip.
  // Tapping a sign also clears any active stance, so the avatar STANDS STILL
  // while holding the sign instead of grooving underneath it.
  const SIGN_POSES = ['kheart', 'peace', 'shaka', 'rock', 'bird', 'rebel2', 'omniaSign'];
  const mocapFor = { crossedArms: 'folded' };
  if (mocapFor[gesture]) mocapPlay(mocapFor[gesture]); else mocapStop();
  if (SIGN_POSES.includes(gesture)) {
    currentStance = 'none';
    document.querySelectorAll('#stance-grid .pose-btn:not(#crown-toggle), #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  }
  document.querySelectorAll('#hand-grid .pose-btn, #attitude-grid .pose-btn, #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.setExpr = (expr, btn) => { currentExpr = expr; activateBtn(btn); };

window.setStance = (stance, btn) => {
  const stanceMocap = { dance: 'dance', dj: 'dj', stargazer: 'stargazer', airguitar: 'airguitar', arcade: 'arcade', dab: 'dab', carlton: 'carlton', dougie: 'dougie', bboy: 'bboy', chickennoodle: 'chickennoodle' };
  if (stanceMocap[stance]) { mocapPlay(stanceMocap[stance]); currentStance = 'none'; }
  else { mocapStop(); currentStance = stance; }
  document.querySelectorAll('#stance-grid .pose-btn:not(#crown-toggle), #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.toggleCrown = () => {
  // v6.0/v6.1: the crown is Niecee's only — on Ren or the realistic girl the
  // button is dimmed and this is a no-op.
  if (activeModel !== 'niecee') return;
  crownVisible = !crownVisible;
  if (crownVisible) mocapPlay('crown'); else if (mocapClipName === 'crown') mocapStop();
  if (crownGroup) crownGroup.visible = crownVisible;
  const toggleBtn = document.getElementById('crown-toggle');
  if (toggleBtn) toggleBtn.classList.toggle('active', crownVisible);
};

window.toggleKatana = () => {
  // v6.2: the katana works on every model, and the crown + katana can be on
  // at the same time. Turning it on attaches it to the active model's chest;
  // turning it off takes it off the stage entirely.
  katanaVisible = !katanaVisible;
  if (katanaVisible && currentVrm) attachKatana(currentVrm, activeModel);
  else if (katanaGroup && katanaGroup.parent) katanaGroup.parent.remove(katanaGroup);
  const btn = document.getElementById('katana-toggle');
  if (btn) btn.classList.toggle('active', katanaVisible);
};

// Inject the katana toggle into the sidebar, right under the model switcher
// (no index.html change needed — she still pastes ONE file). Runs after the
// switcher IIFE above, so modelStatusEl already exists.
(function injectKatanaToggle() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="section-title">ACCESSORY</div>' +
    '<div class="grid-2">' +
    '<button id="katana-toggle" class="pose-btn" onclick="toggleKatana()">⚔️ Katana</button>' +
    '</div>';
  const statusWrap = modelStatusEl ? modelStatusEl.parentElement : null;
  if (statusWrap && statusWrap.nextSibling) sidebar.insertBefore(wrap, statusWrap.nextSibling);
  else sidebar.appendChild(wrap);
})();

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
  // v6.0: Face Cam frames the ACTIVE model's face — Ren's head sits higher.
  const f = CAMERA_FACE[activeModel] || CAMERA_FACE.niecee;
  camera.position.set(f.cam[0], f.cam[1], f.cam[2]);
  controls.target.set(f.target[0], f.target[1], f.target[2]);
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

// Thumb hold (v5.8, measured from her close-up hand video): when the thumb holds
// folded fingers down (Peace / Rock / Bird / Double), the stock opposition recipe
// leaves its tip ~8cm from the ring fingertip — it rests near the index instead.
// The hold pose folds the metacarpal down harder (X) and swings it further across
// the palm (Y), so the tip lands on the held fingers (sim: Peace 3.6cm from the
// ring tip, Bird 5.0cm from the index tip; her video: 1.3cm / 2.4cm).
// Hold A (peace, bird, rebel2): strong swing. Hold B (rock): gentler, so the tip
// stays clear of the extended pinky. Call AFTER poseFingers so it overrides the thumb.
function poseThumbHold(side, curl, hold, t, amp = 0.012) {
  const dir = side === 'Left' ? 1 : -1;
  const wave = Math.sin(t * 1.1) * amp * 0.25;
  const c = curl + wave;
  const mx = hold === 'A' ? -0.80 : -0.50;
  const my = hold === 'A' ? 1.00 : 0.75;
  const px = hold === 'A' ? 0.65 : 0.50;
  setTarget(`${side}ThumbMetacarpal`, mx * c, dir * (my * c), dir * (c * 0.31));
  setTarget(`${side}ThumbProximal`, px * c, 0, dir * (c * 0.31));
  setTarget(`${side}ThumbDistal`, 0.08 * c, 0, dir * (c * 0.38));
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

  // v5.9: the mocap player drives chest/neck/hips/legs/feet, but nothing in the
  // code pose ever reset them — after a clip stopped, the torso stayed twisted
  // and the legs stayed frozen mid-dance, so a sign landed ~8cm off its pose
  // (lab54: chest stuck at (-0.07, 0.11, 0.07) after the kheart clip). The idle
  // defaults now re-drive every mocap bone to rest, so the avatar always comes
  // back to standing when no stance or clip is active. Stance branches run
  // after this and override the ones they need.
  setTarget('Chest', 0, 0, 0);
  setTarget('Neck', 0, 0, 0);
  setTarget('Hips', 0, 0, 0);
  ['Left', 'Right'].forEach(side => {
    setTarget(`${side}UpperLeg`, 0, 0, 0);
    setTarget(`${side}LowerLeg`, 0, 0, 0);
    setTarget(`${side}Foot`, 0, 0, 0);
  });

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
    // v5.8: measured from her close-up hand video (0-2s). Ring/little fold only
    // partway (she holds them with the thumb, tips tucked not pressed flat);
    // index/middle stay straight. Thumb uses the hold pose so its tip lands
    // on the folded ring finger (sim: 3.6cm away; her video: 1.3cm).
    // v5.9: RIGHT hand now — her video hand. Pure code pose: she stands still,
    // hand up beside her face, palm to the camera, V clear (lab53: palm 1.00).
    const scissor = 0;
    setFingerTarget('Right', 'Ring', 1.02, 0, t, 0.03);
    setFingerTarget('Right', 'Little', 1.16, 0, t, 0.03);
    poseThumbHold('Right', 1.20, 'A', t, 0.03);
    setFingerTarget('Right', 'Index', 0.23, 0.34 + scissor, t, 0.04);
    setFingerTarget('Right', 'Middle', 0.13, -0.16 - scissor, t, 0.04);
    setTarget('RightUpperArm', -0.815 + breathe, -0.145 + armSway, 0.450);
    setTarget('RightLowerArm', 0, 2.010 + breathe * 1.2, 0.100);
    setTarget('RightHand', 0.430 + wristRock * 0.8, -0.300, -0.685 + armSway * 1.5);
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
    // v5.8: measured from her close-up hand video (2.5-6s). The OLD code had it
    // BACKWARDS — index nearly straight (0.20) and thumb curled (1.60). Her video
    // shows the index bent right over (157 deg) and the thumb straight across (52 deg).
    poseFingers('Right', [1.10, 1.09, 1.39, 1.40, 1.39], [-0.20, 0.60, 0, 0, 0], t);
    // v5.9: wrist flipped — v5.8 had the hand upside down (palm to the floor,
    // fingers pointing down), which read as a small edge-on claw. Now the hand
    // is upright by her cheek, palm to the camera, pinch facing you (lab53b:
    // palm 1.00, hand axis 1.00).
    setTarget('RightUpperArm', -0.735 + breathe, -0.245, 1.030);
    setTarget('RightLowerArm', -0.220, 2.010, 0.640);
    setTarget('RightHand', 0.790, -0.380, -0.745);
  } else if (g === 'rock') {
    // Rock on: both hands up, index + pinky out, middle + ring held down by the thumb
    // v5.8: measured from her close-up hand video (7-10s). Middle/ring fold partway
    // (not pressed flat); the pinky stays up with its natural curve (0.45).
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      poseFingers(side, [1.10, 0.16, 1.08, 1.06, 0.45], [0, 0.10, 0, 0, -0.10], t);
      poseThumbHold(side, 1.10, 'B', t);
      // v5.9: symmetric now — v5.8 mirrored the LowerArm x (dir*0.4), which put
      // the right hand BEHIND her body. Both hands up at shoulder height, palms
      // to the camera, index + pinky up (lab53: palms 0.98, fingers up 0.93).
      setTarget(`${side}UpperArm`, -0.465 + breathe, dir * -0.255, dir * -0.830);
      setTarget(`${side}LowerArm`, -0.090, dir * -1.640, dir * 0.555);
      setTarget(`${side}Hand`, 0.610, dir * -0.200, dir * 0.610);
    });
  } else if (g === 'omniaSign') {
    // Omnia Prism: both hands up in front of her face, index + thumb tips meeting into a triangle
    // v5.8: measured from her close-up hand video (25.5-38.5s). Her fingers are pressed
    // TOGETHER (index-middle 5-9 deg) — the old code fanned them OUT. Spreads flattened.
    ['Left', 'Right'].forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      const idxCurl = side === 'Left' ? 0.20 : 0.22;
      poseFingers(side, [0.18, idxCurl, 0.12, 0.12, 0.12], [-0.30, 0, 0, 0, 0], t);
      // v5.9: hands FORWARD at upper-chest height, palms to the camera, triangle
      // held out from the body — v5.8 had them on her face, palms sideways, the
      // triangle plastered over her mouth. Index tips meet at the top, thumbs
      // meet at the bottom, her face fully visible above and through it (lab53b:
      // palms 1.00, index tips 1.7cm apart, thumb tips 0.2cm apart).
      setTarget(`${side}UpperArm`, -0.360 + breathe, dir * -0.710, dir * -0.520);
      setTarget(`${side}LowerArm`, -0.175, dir * -1.490, dir * -0.370);
      setTarget(`${side}Hand`, 1.195, dir * 0.435, dir * 0.960);
    });
  } else if (g === 'bird' || g === 'rebel2') {
    // Middle finger: one hand, or both for Double
    // v5.8: measured from her close-up hand video (bird 19-22s, double 22.5-23s).
    // The held fingers fold only partway (index held by the thumb, not pressed
    // flat); her left middle bends more than her right, so the two hands differ.
    const sides = g === 'bird' ? ['Right'] : ['Left', 'Right'];
    sides.forEach(side => {
      const dir = side === 'Left' ? 1 : -1;
      const curls = g === 'bird' ? [1.20, 0.95, 0.24, 1.03, 1.10]
        : side === 'Left' ? [1.20, 1.13, 0.47, 1.19, 1.15]
        : [1.20, 0.91, 0.25, 1.04, 1.05];
      poseFingers(side, curls, [0, 0, 0, 0, 0], t);
      poseThumbHold(side, 1.20, 'A', t);
      // v5.9: palms squared to the camera, middle finger vertical. Bird and
      // Double now have their own arm values (they shared one block before).
      if (g === 'bird') {
        setTarget(`${side}UpperArm`, -0.650 + breathe, dir * -0.155, dir * -0.730);
        setTarget(`${side}LowerArm`, -0.080, dir * -1.620, dir * -0.300);
        setTarget(`${side}Hand`, 0.635, dir * 0.360, dir * 1.125);
      } else { // rebel2: both hands up, middle fingers vertical
        setTarget(`${side}UpperArm`, -0.795 + breathe, dir * 0.005, dir * -0.770);
        setTarget(`${side}LowerArm`, -0.120, dir * -1.460, dir * -0.275);
        setTarget(`${side}Hand`, 0.745, dir * 0.060, dir * 1.050);
      }
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
    // v5.8: measured from her close-up hand video (12-18.5s). The OLD thumb curl
    // was -0.30 — negative curl bends the thumb BACKWARD in the v4.17 convention,
    // which is why it stuck out wrong. Thumb is straight out (0.15); pinky spread
    // widened to match her 59-deg ring-pinky gap.
    poseFingers('Right', [0.15, 1.19, 1.36, 1.18, 0.18], [-1.30, 0, 0, 0, 0.80], t);
    // v5.9: hand upright by her ear, palm to the camera — v5.8 had the hand
    // edge-on with the fingers pointing AT the camera (lab53: palm 1.00).
    setTarget('RightUpperArm', -0.675 + breathe, -0.095, 0.510);
    setTarget('RightLowerArm', 0, 1.990, 0);
    setTarget('RightHand', 0.485, -0.325, -0.650);
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
