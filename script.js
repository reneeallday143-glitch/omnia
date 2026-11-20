import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status'), box = document.getElementById('stage-box'), canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = false, isDragging = false, prevX = 0, currentAction = 'idle', currentHand = 'open', currentParticleMode = 'sakura';
let clock = new THREE.Clock(), baseY = 0, bones = {}, faceMeshes = [], camZ = 2.65, camY = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1.3, 0.1, 20);
camera.position.set(0, camY, camZ);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;

const light = new THREE.DirectionalLight(0xffffff, 1.5); light.position.set(1, 2, 2);
const rim = new THREE.PointLight(0x7c5cff, 2.5, 8); rim.position.set(-1.5, 1.5, -1.5);
const grid = new THREE.GridHelper(3, 12, 0x7c5cff, 0x323d5e);
scene.add(light, rim, new THREE.AmbientLight(0xffffff, 0.9), grid);

function makeGlowTex(type) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  if (type === 'petal') {
    const g = ctx.createLinearGradient(64, 10, 64, 118);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#ffb3d9'); g.addColorStop(1, '#d9468f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(64, 10);
    ctx.bezierCurveTo(106, 36, 102, 92, 64, 116); ctx.bezierCurveTo(26, 92, 22, 36, 64, 10); ctx.fill();
  } else if (type === 'bubble') {
    const g = ctx.createRadialGradient(64, 64, 18, 64, 64, 58);
    g.addColorStop(0, 'rgba(56,189,248,0.04)'); g.addColorStop(0.65, 'rgba(168,85,247,0.28)');
    g.addColorStop(0.88, 'rgba(56,189,248,0.88)'); g.addColorStop(0.96, 'rgba(253,224,71,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath(); ctx.ellipse(44, 40, 12, 6, -0.6, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'ember') {
    ctx.save(); ctx.translate(64, 64); ctx.rotate(-0.65);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, '#fde047'); g.addColorStop(0.6, '#f97316'); g.addColorStop(1, 'rgba(234,88,12,0)');
    ctx.fillStyle = g; ctx.scale(0.32, 1.0); ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  } else if (type === 'bokeh') {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 56);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#fde68a'); g.addColorStop(0.7, 'rgba(245,158,11,0.35)'); g.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2); ctx.fill();
  } else {
    const g = ctx.createLinearGradient(64, 0, 64, 128);
    g.addColorStop(0, 'rgba(163,230,53,0)'); g.addColorStop(0.5, '#ecfccb'); g.addColorStop(1, 'rgba(163,230,53,0)');
    ctx.fillStyle = g; ctx.fillRect(58, 0, 12, 128);
  }
  return new THREE.CanvasTexture(c);
}

const texMap = { petal: makeGlowTex('petal'), bubble: makeGlowTex('bubble'), ember: makeGlowTex('ember'), bokeh: makeGlowTex('bokeh'), laser: makeGlowTex('laser') };
const P_COUNT = 240, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(P_COUNT * 3);
const pMeta = Array.from({ length: P_COUNT }, (_, i) => {
  pPos[i * 3] = (Math.random() - 0.5) * 3.4; pPos[i * 3 + 1] = Math.random() * 2.8; pPos[i * 3 + 2] = (Math.random() - 0.5) * 2.8;
  return { speed: 0.4 + Math.random() * 0.9, phase: Math.random() * Math.PI * 2, radius: 0.3 + Math.random() * 1.2 };
});
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({ map: texMap.petal, size: 0.16, transparent: true, depthWrite: false });
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

const fxCrown = new THREE.Group();
const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.5, metalness: 0.8, roughness: 0.2 });
fxCrown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.045, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xd97706, side: THREE.DoubleSide })));
for (let i = 0; i < 5; i++) {
  const ang = (i / 5) * Math.PI * 2;
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.075, 4), goldMat);
  spire.position.set(Math.cos(ang) * 0.102, 0.055, Math.sin(ang) * 0.102);
  const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.015), new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x38bdf8 : 0xf43f5e }));
  jewel.position.set(Math.cos(ang) * 0.108, 0.098, Math.sin(ang) * 0.108);
  fxCrown.add(spire, jewel);
}
fxCrown.position.set(0, 1.72, 0); fxCrown.visible = false;
const fxRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.018, 16, 64), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }));
fxRing.rotation.x = Math.PI / 2; fxRing.visible = false;
const fxHolo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.85 }));
fxHolo.position.set(-0.28, 1.18, 0.45); fxHolo.visible = false;
scene.add(fxCrown, fxRing, fxHolo);

function makeSceneSVG(type) {
  const colors = { tokyo: ['#07031a', '#ff1e8a'], sakuraNight: ['#120724', '#f472b6'], penthouse: ['#09152b', '#38bdf8'], lobby: ['#111827', '#312e81'], galaxy: ['#020617', '#6b21a8'], miami: ['#0891b2', '#f43f5e'], crimson: ['#09090b', '#991b1b'], studio: ['#1e293b', '#cbd5e1'] };
  const c = colors[type] || colors.lobby;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://w3.org' viewBox='0 0 800 600'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='${c[0]}'/><stop offset='100%' stop-color='${c[1]}'/></linearGradient></defs><rect width='800' height='600' fill='url(#g)'/></svg>`)}")`;
}

canvas.onmousedown = e => { isDragging = true; prevX = e.clientX; };
window.onmouseup = () => isDragging = false;
window.onmousemove = e => { if (isDragging && vrmModel) { vrmModel.rotation.y += (e.clientX - prevX) * 0.015; prevX = e.clientX; } };
canvas.addEventListener('wheel', e => { e.preventDefault(); camZ = Math.max(0.75, Math.min(4.2, camZ + e.deltaY * 0.002)); camera.position.set(0, camY, camZ); }, { passive: false });

const spinBtn = document.getElementById('spin-btn');
spinBtn.onclick = () => { spin = !spin; spinBtn.innerText = spin ? '🔄 Spinning (Click to Stand Still)' : '🧍 Stand Still (Paused)'; };
document.getElementById('flip-btn').onclick = () => { if (vrmModel) vrmModel.rotation.y += Math.PI; };
document.getElementById('zoom-in-btn').onclick = () => { camZ = Math.max(0.75, camZ - 0.35); camera.position.set(0, camY, camZ); };
document.getElementById('zoom-out-btn').onclick = () => { camZ = Math.min(4.2, camZ + 0.35); camY = 1.15; camera.position.set(0, camY, camZ); };
document.getElementById('face-cam-btn').onclick = () => { camY = 1.48; camZ = 0.95; camera.position.set(0, camY, camZ); };

box.style.backgroundSize = 'cover';
document.querySelectorAll('.bg-btns button').forEach(btn => { btn.onclick = () => { box.style.setProperty('background-image', makeSceneSVG(btn.dataset.bg), 'important'); status.innerText = 'Scene: ' + btn.innerText.trim(); }; });

const atmospheres = {
  sakura:    { bg: 'radial-gradient(circle, #2a0e29 0%, #070510 100%)', key: 0xffb3d9, rim: 0x00f5d4, grid: 0xff70a6, tex: texMap.petal, size: 0.16, blend: THREE.NormalBlending, mode: 'sakura' },
  eclipse:   { bg: 'radial-gradient(circle at 20% 85%, #451a03 0%, #090505 65%)', key: 0xffb703, rim: 0xff5400, grid: 0xff5400, tex: texMap.ember, size: 0.14, blend: THREE.AdditiveBlending, mode: 'ember' },
  biolume:   { bg: 'radial-gradient(circle, #062436 0%, #030712 100%)', key: 0x48cae4, rim: 0xa855f7, grid: 0x00b4d8, tex: texMap.bubble, size: 0.22, blend: THREE.AdditiveBlending, mode: 'bubble' },
  prism:     { bg: 'linear-gradient(135deg, #451a03 0%, #1c1008 45%, #09070d 100%)', key: 0xfde68a, rim: 0xf59e0b, grid: 0xfbbf24, tex: texMap.bokeh, size: 0.13, blend: THREE.AdditiveBlending, mode: 'beam' },
  overdrive: { bg: 'radial-gradient(circle, #142614 0%, #040604 100%)', key: 0xd9ed92, rim: 0x70e000, grid: 0x9ef01a, tex: texMap.laser, size: 0.24, blend: THREE.AdditiveBlending, mode: 'laser' },
  solaris:   { bg: 'radial-gradient(ellipse at center, #1e3a5f 0%, #050a14 75%)', key: 0xfde047, rim: 0x38bdf8, grid: 0xf59e0b, tex: texMap.bokeh, size: 0.14, blend: THREE.AdditiveBlending, mode: 'wave' }
};

document.querySelectorAll('.light-btns button').forEach(btn => {
  btn.onclick = () => {
    const t = atmospheres[btn.dataset.theme]; if (!t) return;
    box.style.setProperty('background-image', t.bg, 'important');
    light.color.setHex(t.key); rim.color.setHex(t.rim); grid.material.color.setHex(t.grid);
    pMat.map = t.tex; pMat.size = t.size; pMat.blending = t.blend; pMat.needsUpdate = true;
    currentParticleMode = t.mode; status.innerText = 'Atmosphere: ' + btn.innerText.trim();
  };
});

document.querySelectorAll('.face-btns button').forEach(btn => {
  btn.onclick = () => {
    const expr = btn.dataset.face;
    const kw = { joy: ['joy', 'happy', 'smile'], grin: ['joy', 'happy', 'aa'], sorrow: ['sorrow', 'sad'], cry: ['sorrow', 'sad', 'cry'], angry: ['angry', 'mad'], furious: ['angry', 'mad', 'aa'], surprised: ['surprised', 'oh'], shocked: ['surprised', 'shock', 'aa'], wink: ['wink', 'fun'], smug: ['fun', 'smug'], sleepy: ['blink', 'close'] };
    faceMeshes.forEach(m => {
      if (!m.morphTargetDictionary) return;
      Object.keys(m.morphTargetDictionary).forEach(k => { m.morphTargetInfluences[m.morphTargetDictionary[k]] = (expr !== 'neutral' && kw[expr] && kw[expr].some(w => k.toLowerCase().includes(w))) ? 1 : 0; });
    });
