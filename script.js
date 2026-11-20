import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status');
const box = document.getElementById('stage-box');
const canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = false, isDragging = false, prevX = 0;
let currentAction = 'idle', currentHand = 'open', currentFace = 'neutral', currentParticleMode = 'sakura';
let clock = new THREE.Clock(), baseY = 0, bones = {}, faceMeshes = [];
let camZ = 2.65, camY = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1.3, 0.1, 20);
camera.position.set(0, camY, camZ);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;

const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(1, 2, 2);
const rim = new THREE.PointLight(0x7c5cff, 2.5, 8);
rim.position.set(-1.5, 1.5, -1.5);
const grid = new THREE.GridHelper(3, 12, 0x7c5cff, 0x323d5e);
scene.add(light, rim, new THREE.AmbientLight(0xffffff, 0.9), grid);

// 3D Moving Particle System (160 Floating Petals / Embers / Bubbles / Sparks)
const particleCount = 160;
const pGeo = new THREE.BufferGeometry();
const pPositions = new Float32Array(particleCount * 3);
const pSpeeds = new Float32Array(particleCount);
for (let i = 0; i < particleCount; i++) {
  pPositions[i * 3] = (Math.random() - 0.5) * 3.4;
  pPositions[i * 3 + 1] = Math.random() * 2.6;
  pPositions[i * 3 + 2] = (Math.random() - 0.5) * 2.8;
  pSpeeds[i] = 0.4 + Math.random() * 0.9;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
const pMat = new THREE.PointsMaterial({ color: 0xff85c0, size: 0.055, transparent: true, opacity: 0.9 });
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

// Original Omnia 3D Stage FX Props
const fxRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.65, 0.015, 16, 64),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
);
fxRing.rotation.x = Math.PI / 2;
fxRing.visible = false;

const fxCrown = new THREE.Mesh(
  new THREE.ConeGeometry(0.14, 0.16, 5),
  new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, wireframe: true })
);
fxCrown.position.set(0, 1.72, 0);
fxCrown.visible = false;
scene.add(fxRing, fxCrown);

// Illustrated SVG Stage Scenes (Renders full Cyber Tokyo Skyline, Sakura Shrine, Penthouse, etc.)
function makeSceneSVG(type) {
  const scenes = {
    tokyo: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#07031a"/><stop offset="55%" stop-color="#2e0854"/><stop offset="100%" stop-color="#ff1e8a"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="620" cy="140" r="65" fill="#ff5ca8" opacity="0.35"/><rect x="40" y="210" width="90" height="390" fill="#0d0824"/><rect x="150" y="150" width="110" height="450" fill="#130b33"/><rect x="280" y="240" width="85" height="360" fill="#09051a"/><rect x="470" y="170" width="120" height="430" fill="#12092e"/><rect x="610" y="120" width="100" height="480" fill="#0b0621"/><rect x="720" y="220" width="80" height="380" fill="#160c38"/><g fill="#38bdf8" opacity="0.85"><rect x="170" y="180" width="12" height="22"/><rect x="200" y="180" width="12" height="22"/><rect x="170" y="220" width="12" height="22"/><rect x="630" y="150" width="14" height="26"/><rect x="665" y="150" width="14" height="26"/><rect x="630" y="200" width="14" height="26"/></g><g fill="#ff5ca8" opacity="0.9"><rect x="60" y="240" width="50" height="8"/><rect x="490" y="210" width="80" height="10"/><rect x="490" y="235" width="55" height="8"/></g></svg>`,
    sakuraNight: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#120724"/><stop offset="60%" stop-color="#4a1259"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="400" cy="180" r="95" fill="#fbcfe8" opacity="0.28"/><path d="M180 340 L620 340 L580 310 L220 310 Z" fill="#1f092b"/><rect x="250" y="340" width="24" height="260" fill="#1f092b"/><rect x="526" y="340" width="24" height="260" fill="#1f092b"/><rect x="210" y="385" width="380" height="18" fill="#1f092b"/><circle cx="110" cy="160" r="120" fill="#ff70a6" opacity="0.45"/><circle cx="690" cy="140" r="140" fill="#ff9ebb" opacity="0.4"/></svg>`,
    penthouse: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#09152b"/><stop offset="60%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><line x1="0" y1="120" x2="800" y2="120" stroke="#7dd3fc" stroke-width="3" opacity="0.4"/><line x1="200" y1="0" x2="200" y2="600" stroke="#7dd3fc" stroke-width="3" opacity="0.3"/><line x1="600" y1="0" x2="600" y2="600" stroke="#7dd3fc" stroke-width="3" opacity="0.3"/><rect x="80" y="310" width="140" height="290" fill="#0f172a" opacity="0.8"/><rect x="560" y="270" width="160" height="330" fill="#0f172a" opacity="0.8"/><circle cx="640" cy="110" r="45" fill="#e0f2fe" opacity="0.35"/></svg>`,
    lobby: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#312e81"/><stop offset="60%" stop-color="#111827"/><stop offset="100%" stop-color="#030712"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/><polygon points="400,70 670,230 670,470 400,560 130,470 130,230" fill="none" stroke="#7c5cff" stroke-width="4" opacity="0.55"/><polygon points="400,120 620,250 620,440 400,515 180,440 180,250" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.45"/></svg>`,
    galaxy: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#6b21a8"/><stop offset="45%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020617"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/><ellipse cx="420" cy="260" rx="340" ry="95" transform="rotate(-18 420 260)" fill="#c084fc" opacity="0.22"/><circle cx="140" cy="110" r="3" fill="#fff"/><circle cx="290" cy="80" r="4" fill="#38bdf8"/><circle cx="650" cy="130" r="3" fill="#fff"/><circle cx="540" cy="210" r="2.5" fill="#f472b6"/><circle cx="210" cy="290" r="3" fill="#fff"/></svg>`,
    miami: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0891b2"/><stop offset="50%" stop-color="#9333ea"/><stop offset="100%" stop-color="#f43f5e"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="400" cy="290" r="130" fill="#fde047" opacity="0.75"/><rect x="0" y="340" width="800" height="260" fill="#1e1b4b" opacity="0.65"/></svg>`,
    crimson: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#991b1b"/><stop offset="55%" stop-color="#450a0a"/><stop offset="100%" stop-color="#09090b"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/><polygon points="100,600 220,160 270,600" fill="#18181b" opacity="0.7"/><polygon points="530,600 580,160 700,600" fill="#18181b" opacity="0.7"/></svg>`,
    studio: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="50%" cy="42%" r="65%"><stop offset="0%" stop-color="#cbd5e1"/><stop offset="60%" stop-color="#64748b"/><stop offset="100%" stop-color="#1e293b"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/></svg>`
  };
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(scenes[type] || scenes.lobby)}")`;
}

canvas.onmousedown = e => { isDragging = true; prevX = e.clientX; };
window.onmouseup = () => isDragging = false;
window.onmousemove = e => {
  if (!isDragging || !vrmModel) return;
  vrmModel.rotation.y += (e.clientX - prevX) * 0.015;
  prevX = e.clientX;
};
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  camZ = Math.max(0.75, Math.min(4.2, camZ + e.deltaY * 0.002));
  camera.position.set(0, camY, camZ);
}, { passive: false });

const spinBtn = document.getElementById('spin-btn');
spinBtn.onclick = () => {
  spin = !spin;
  spinBtn.innerText = spin ? '🔄 Spinning (Click to Stand Still)' : '🧍 Stand Still (Paused)';
  status.innerText = spin ? 'Auto-Spin Active' : 'Standing Still • Drag or Zoom';
};
document.getElementById('flip-btn').onclick = () => { if (vrmModel) vrmModel.rotation.y += Math.PI; };
document.getElementById('zoom-in-btn').onclick = () => {
  camZ = Math.max(0.75, camZ - 0.35);
  camera.position.set(0, camY, camZ);
};
document.getElementById('zoom-out-btn').onclick = () => {
  camZ = Math.min(4.2, camZ + 0.35);
  camY = 1.15;
  camera.position.set(0, camY, camZ);
};
document.getElementById('face-cam-btn').onclick = () => {
  camY = 1.48;
  camZ = 0.95;
  camera.position.set(0, camY, camZ);
  status.innerText = 'Face Close-Up • Test Facial Expressions';
};

// Apply Illustrated Stage Backgrounds
box.style.backgroundSize = 'cover';
box.style.backgroundPosition = 'center';
document.querySelectorAll('.bg-btns button').forEach(btn => {
  btn.onclick = () => {
    const bgType = btn.dataset.bg;
    box.style.setProperty('background-image', makeSceneSVG(bgType), 'important');
    box.style.backgroundSize = 'cover';
    status.innerText = 'Scene: ' + btn.innerText.trim();
  };
});

// Atmospheres + Moving 3D Particles
const atmospheres = {
