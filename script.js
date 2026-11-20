import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status');
const box = document.getElementById('stage-box');
const canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = false, isDragging = false, prevX = 0;
let currentAction = 'idle', currentHand = 'open', currentParticleMode = 'sakura';
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

// --- TRUE 3D INSTANCED PARTICLE SYSTEMS ---
const P_COUNT = 140;
const dummy = new THREE.Object3D();
const pData = Array.from({ length: P_COUNT }, () => ({
  x: (Math.random() - 0.5) * 3.4,
  y: Math.random() * 2.8,
  z: (Math.random() - 0.5) * 2.8,
  rx: Math.random() * Math.PI * 2,
  ry: Math.random() * Math.PI * 2,
  rz: Math.random() * Math.PI * 2,
  speed: 0.45 + Math.random() * 0.85,
  phase: Math.random() * Math.PI * 2
}));

// 1. 3D Curved Sakura Petal Geometry
const petalShape = new THREE.Shape();
petalShape.moveTo(0, 0.032);
petalShape.bezierCurveTo(0.024, 0.018, 0.022, -0.018, 0, -0.03);
petalShape.bezierCurveTo(-0.022, -0.018, -0.024, 0.018, 0, 0.032);
const petalGeo = new THREE.ShapeGeometry(petalShape, 6);
const petalMat = new THREE.MeshBasicMaterial({ color: 0xff99cc, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
const sakuraMesh = new THREE.InstancedMesh(petalGeo, petalMat, P_COUNT);

// 2. 3D Glossy Bubble Spheres
const bubbleGeo = new THREE.SphereGeometry(0.026, 12, 12);
const bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 0.4, roughness: 0.1, transparent: true, opacity: 0.55 });
const bubbleMesh = new THREE.InstancedMesh(bubbleGeo, bubbleMat, P_COUNT);

// 3. 3D Glowing Fire Embers (Additive)
const emberGeo = new THREE.DodecahedronGeometry(0.015, 0);
const emberMat = new THREE.MeshBasicMaterial({ color: 0xff8c00, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95 });
const emberMesh = new THREE.InstancedMesh(emberGeo, emberMat, P_COUNT);

// 4. 3D Starburst Sparks (Additive)
const sparkGeo = new THREE.OctahedronGeometry(0.02, 0);
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xfde047, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.95 });
const sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, P_COUNT);

// 5. 3D Cyber Laser Beams (Additive)
const laserGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.32, 6);
const laserMat = new THREE.MeshBasicMaterial({ color: 0xa3e635, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9 });
const laserMesh = new THREE.InstancedMesh(laserGeo, laserMat, P_COUNT);

const particleMeshes = { sakura: sakuraMesh, bubble: bubbleMesh, ember: emberMesh, spark: sparkMesh, laser: laserMesh };
Object.values(particleMeshes).forEach(m => { m.visible = false; scene.add(m); });
sakuraMesh.visible = true;

// 3D Stage FX Props (Magic Domain Ring, Floating Holo-Screen, Royal Crown)
const fxRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.68, 0.018, 16, 64),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
);
fxRing.rotation.x = Math.PI / 2;
fxRing.visible = false;

const fxHolo = new THREE.Mesh(
  new THREE.PlaneGeometry(0.42, 0.28),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.85 })
);
fxHolo.position.set(-0.28, 1.18, 0.45);
fxHolo.visible = false;

const fxCrown = new THREE.Mesh(
  new THREE.CylinderGeometry(0.12, 0.09, 0.11, 6, 1, true),
  new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, side: THREE.DoubleSide })
);
fxCrown.position.set(0, 1.72, 0);
fxCrown.visible = false;
scene.add(fxRing, fxHolo, fxCrown);
function makeSceneSVG(type) {
  const scenes = {
    tokyo: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#07031a"/><stop offset="55%" stop-color="#2e0854"/><stop offset="100%" stop-color="#ff1e8a"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="620" cy="140" r="65" fill="#ff5ca8" opacity="0.35"/><rect x="40" y="210" width="90" height="390" fill="#0d0824"/><rect x="150" y="150" width="110" height="450" fill="#130b33"/><rect x="280" y="240" width="85" height="360" fill="#09051a"/><rect x="470" y="170" width="120" height="430" fill="#12092e"/><rect x="610" y="120" width="100" height="480" fill="#0b0621"/><rect x="720" y="220" width="80" height="380" fill="#160c38"/><g fill="#38bdf8" opacity="0.85"><rect x="170" y="180" width="12" height="22"/><rect x="200" y="180" width="12" height="22"/><rect x="630" y="150" width="14" height="26"/><rect x="665" y="150" width="14" height="26"/></g></svg>`,
    sakuraNight: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#120724"/><stop offset="60%" stop-color="#4a1259"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="400" cy="180" r="95" fill="#fbcfe8" opacity="0.28"/><path d="M180 340 L620 340 L580 310 L220 310 Z" fill="#1f092b"/><rect x="250" y="340" width="24" height="260" fill="#1f092b"/><rect x="526" y="340" width="24" height="260" fill="#1f092b"/><rect x="210" y="385" width="380" height="18" fill="#1f092b"/></svg>`,
    penthouse: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#09152b"/><stop offset="60%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><rect x="80" y="310" width="140" height="290" fill="#0f172a" opacity="0.8"/><rect x="560" y="270" width="160" height="330" fill="#0f172a" opacity="0.8"/></svg>`,
    lobby: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#312e81"/><stop offset="60%" stop-color="#111827"/><stop offset="100%" stop-color="#030712"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/><polygon points="400,70 670,230 670,470 400,560 130,470 130,230" fill="none" stroke="#7c5cff" stroke-width="4" opacity="0.55"/></svg>`,
    galaxy: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#6b21a8"/><stop offset="45%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#020617"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/><ellipse cx="420" cy="260" rx="340" ry="95" transform="rotate(-18 420 260)" fill="#c084fc" opacity="0.22"/></svg>`,
    miami: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0891b2"/><stop offset="50%" stop-color="#9333ea"/><stop offset="100%" stop-color="#f43f5e"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><circle cx="400" cy="290" r="130" fill="#fde047" opacity="0.75"/><rect x="0" y="340" width="800" height="260" fill="#1e1b4b" opacity="0.65"/></svg>`,
    crimson: `<svg xmlns="http://w3.org" viewBox="0 0 800 600"><defs><radialGradient id="g" cx="50%" cy="40%" r="65%"><stop offset="0%" stop-color="#991b1b"/><stop offset="55%" stop-color="#450a0a"/><stop offset="100%" stop-color="#09090b"/></radialGradient></defs><rect width="800" height="600" fill="url(#g)"/></svg>`,
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
document.getElementById('zoom-in-btn').onclick = () => { camZ = Math.max(0.75, camZ - 0.35); camera.position.set(0, camY, camZ); };
document.getElementById('zoom-out-btn').onclick = () => { camZ = Math.min(4.2, camZ + 0.35); camY = 1.15; camera.position.set(0, camY, camZ); };
document.getElementById('face-cam-btn').onclick = () => { camY = 1.48; camZ = 0.95; camera.position.set(0, camY, camZ); status.innerText = 'Face Close-Up'; };

box.style.backgroundSize = 'cover';
box.style.backgroundPosition = 'center';
document.querySelectorAll('.bg-btns button').forEach(btn => {
  btn.onclick = () => {
    box.style.setProperty('background-image', makeSceneSVG(btn.dataset.bg), 'important');
    box.style.backgroundSize = 'cover';
    status.innerText = 'Scene: ' + btn.innerText.trim();
  };
});

const atmospheres = {
  sakura:    { bg: 'radial-gradient(circle, #381836 0%, #0d1326 100%)', key: 0xffb3d9, rim: 0x00f5d4, grid: 0xff70a6, mesh: 'sakura', color: 0xff99cc },
  eclipse:   { bg: 'radial-gradient(circle, #2a1215 0%, #07070c 100%)', key: 0xffb703, rim: 0xff2a5f, grid: 0xff2a5f, mesh: 'ember', color: 0xff7b00 },
  biolume:   { bg: 'radial-gradient(circle, #092c38 0%, #040b14 100%)', key: 0x48cae4, rim: 0x00ff87, grid: 0x00b4d8, mesh: 'bubble', color: 0x67e8f9 },
  prism:     { bg: 'radial-gradient(circle, #2e224d 0%, #110d1f 100%)', key: 0xfff1d0, rim: 0xc77dff, grid: 0xe0aaff, mesh: 'spark', color: 0xf3e8ff },
  overdrive: { bg: 'radial-gradient(circle, #182617 0%, #050505 100%)', key: 0xd9ed92, rim: 0x70e000, grid: 0x9ef01a, mesh: 'laser', color: 0xa3e635 },
  solaris:   { bg: 'radial-gradient(circle, #3d1e10 0%, #100c24 100%)', key: 0xff9e00, rim: 0x7209b7, grid: 0xf77f00, mesh: 'spark', color: 0xfde047 }
};

document.querySelectorAll('.light-btns button').forEach(btn => {
  btn.onclick = () => {
    const theme = atmospheres[btn.dataset.theme];
    if (!theme) return;
    box.style.setProperty('background-image', theme.bg, 'important');
    light.color.setHex(theme.key);
    rim.color.setHex(theme.rim);
    grid.material.color.setHex(theme.grid);
    Object.values(particleMeshes).forEach(m => m.visible = false);
    const activeMesh = particleMeshes[theme.mesh];
    if (activeMesh) {
      activeMesh.material.color.setHex(theme.color);
      activeMesh.visible = true;
    }
    currentParticleMode = theme.mesh;
    status.innerText = 'Atmosphere: ' + btn.innerText.trim();
  };
});

function applyFacialExpression(expr) {
  const keywords = {
    joy: ['joy', 'happy', 'smile'], grin: ['joy', 'happy', 'aa', 'laugh'],
    sorrow: ['sorrow', 'sad'], cry: ['sorrow', 'sad', 'cry', 'tear'],
    angry: ['angry', 'mad'], furious: ['angry', 'mad', 'aa', 'shout'],
    surprised: ['surprised', 'oh', 'ou'], shocked: ['surprised', 'shock', 'aa'],
    wink: ['wink', 'fun'], smug: ['fun', 'smug', 'smile'], sleepy: ['blink', 'close', 'sleep']
  };
  faceMeshes.forEach(mesh => {
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    Object.keys(mesh.morphTargetDictionary).forEach(key => {
      const idx = mesh.morphTargetDictionary[key];
      mesh.morphTargetInfluences[idx] = 0;
      if (expr !== 'neutral' && keywords[expr]) {
        const lower = key.toLowerCase();
        if (keywords[expr].some(k => lower.includes(k))) mesh.morphTargetInfluences[idx] = 1.0;
      }
    });
  });
}

document.querySelectorAll('.face-btns button').forEach(btn => {
  btn.onclick = () => { applyFacialExpression(btn.dataset.face); status.innerText = 'Expression: ' + btn.innerText.trim(); };
});
document.querySelectorAll('[data-action]').forEach(btn => {
  btn.onclick = () => {
    currentAction = btn.dataset.action;
    fxRing.visible = ['holo', 'domain', 'zerog', 'spinKick', 'star'].includes(currentAction);
    fxHolo.visible = (currentAction === 'holo');
    fxCrown.visible = ['crown', 'arcade', 'royal'].includes(currentAction);
    status.innerText = 'Active: ' + btn.innerText.trim();
  };
});
document.querySelectorAll('.hand-btns button').forEach(btn => {
  btn.onclick = () => { currentHand = btn.dataset.hand; status.innerText = 'Gesture: ' + btn.innerText.trim(); };
});

function findBone(namePart) {
  return Object.values(bones).find(b => b.name.toLowerCase().includes(namePart.toLowerCase()));
}

function curlFinger(side, finger, amount) {
  const sideTags = side === 'L' ? ['l_', 'left'] : ['r_', 'right'];
  const segTags = ['1', '2', '3', 'proximal', 'intermediate', 'distal'];
  Object.values(bones).forEach(bone => {
    const n = bone.name.toLowerCase();
    if (sideTags.some(s => n.includes(s)) && n.includes(finger.toLowerCase()) && segTags.some(g => n.includes(g))) {
      bone.rotation.x = amount;
      bone.rotation.z = side === 'L' ? -amount * 0.45 : amount * 0.45;
    }
  });
}

function applyHandPose(gesture) {
  ['L', 'R'].forEach(side => ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].forEach(f => curlFinger(side, f, 0.15)));
  if (gesture === 'peace') {
    ['Ring', 'Little', 'Thumb'].forEach(f => curlFinger('R', f, 1.35));
    ['Index', 'Middle'].forEach(f => curlFinger('R', f, -0.05));
  } else if (gesture === 'kheart') {
    ['Middle', 'Ring', 'Little'].forEach(f => curlFinger('R', f, 1.4));
    curlFinger('R', 'Index', 0.65); curlFinger('R', 'Thumb', 0.55);
  } else if (gesture === 'rock') {
    ['Middle', 'Ring', 'Thumb'].forEach(f => curlFinger('R', f, 1.35));
    ['Index', 'Little'].forEach(f => curlFinger('R', f, -0.05));
  } else if (gesture === 'omniaSign') {
    ['L', 'R'].forEach(s => {
      ['Middle', 'Ring', 'Little'].forEach(f => curlFinger(s, f, 1.3));
      ['Index', 'Thumb'].forEach(f => curlFinger(s, f, 0.25));
    });
  } else if (gesture === 'rebel1' || gesture === 'rebel2') {
    const sides = gesture === 'rebel2' ? ['L', 'R'] : ['R'];
    sides.forEach(s => {
      ['Index', 'Ring', 'Little', 'Thumb'].forEach(f => curlFinger(s, f, 1.45));
      curlFinger(s, 'Middle', -0.05);
    });
  }
}

const loader = new GLTFLoader();
function setupModel(gltf) {
  if (vrmModel) scene.remove(vrmModel);
  vrmModel = gltf.scene;
  bones = {}; faceMeshes = [];
  vrmModel.traverse(obj => {
    if (obj.isBone) bones[obj.name] = obj;
    if (obj.isMesh && obj.morphTargetDictionary) faceMeshes.push(obj);
  });
  baseY = vrmModel.position.y;
  scene.add(vrmModel);
  status.innerText = 'Niecee C Standing Still • Ready';
}

loader.load('./Niecee%20C.vrm', setupModel, undefined, () => {
  status.innerText = '3D Grid Active • Click Choose File';
});

document.getElementById('file-picker').onchange = e => {
  const file = e.target.files.item(0);
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => loader.parse(ev.target.result, '', setupModel);
  reader.readAsArrayBuffer(file);
};

function resizeStage() {
  const w = box.clientWidth || 500, h = box.clientHeight || 400;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resizeStage);

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  const activeMesh = particleMeshes[currentParticleMode];
  if (activeMesh) {
    for (let i = 0; i < P_COUNT; i++) {
      const p = pData[i];
      if (currentParticleMode === 'sakura') {
        p.y -= 0.007 * p.speed;
        p.x += Math.sin(t * 1.8 + p.phase) * 0.005;
        p.rx += 0.03 * p.speed; p.ry += 0.04 * p.speed; p.rz += 0.02;
        if (p.y < 0) p.y = 2.8;
      } else if (currentParticleMode === 'bubble') {
        p.y += 0.006 * p.speed;
        p.x += Math.sin(t * 2.2 + p.phase) * 0.004;
        if (p.y > 2.8) p.y = 0;
      } else if (currentParticleMode === 'ember') {
        p.y += 0.012 * p.speed;
        p.x += Math.sin(t * 3.5 + p.phase) * 0.006;
        p.rx += 0.08; p.ry += 0.08;
        if (p.y > 2.8) p.y = 0;
      } else if (currentParticleMode === 'spark') {
        p.y += Math.sin(t * 2 + p.phase) * 0.003;
        p.ry += 0.09; p.rz += 0.06;
      } else if (currentParticleMode === 'laser') {
        p.y += 0.045 * p.speed;
        if (p.y > 3.0) p.y = -0.2;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(currentParticleMode === 'laser' ? 0 : p.rx, currentParticleMode === 'laser' ? 0 : p.ry, currentParticleMode === 'laser' ? 0 : p.rz);
      const pulse = currentParticleMode === 'spark' ? (0.6 + Math.sin(t * 8 + p.phase) * 0.5) : 1;
      dummy.scale.setScalar(pulse);
      dummy.updateMatrix();
      activeMesh.setMatrixAt(i, dummy.matrix);
    }
    activeMesh.instanceMatrix.needsUpdate = true;
  }

  if (fxRing.visible) { fxRing.position.y = 0.6 + Math.sin(t * 3) * 0.45; fxRing.rotation.z = t * 2; }
  if (fxHolo.visible) { fxHolo.position.y = 1.18 + Math.sin(t * 3) * 0.03; fxHolo.rotation.y = Math.sin(t * 1.5) * 0.25; }
  if (fxCrown.visible) { fxCrown.rotation.y = t * 2.5; fxCrown.position.y = 1.72 + Math.sin(t * 3) * 0.03; }

  if (vrmModel) {
    if (spin && !isDragging) vrmModel.rotation.y += 0.008;
    const lArm = findBone('L_UpperArm'), rArm = findBone('R_UpperArm');
    const lFore = findBone('L_LowerArm'), rFore = findBone('R_LowerArm');
    const lHand = findBone('L_Hand'), rHand = findBone('R_Hand');
    const lLeg = findBone('L_UpperLeg'), rLeg = findBone('R_UpperLeg');
    const lKnee = findBone('L_LowerLeg'), rKnee = findBone('R_LowerLeg');
    const spine = findBone('Spine'), head = findBone('Head');

    if (lArm && rArm) { lArm.rotation.set(0, 0, -1.25); rArm.rotation.set(0, 0, 1.25); }
    if (lFore && rFore) { lFore.rotation.set(0, 0, -0.06); rFore.rotation.set(0, 0, 0.06); }
    if (lHand && rHand) { lHand.rotation.set(0, 0, 0); rHand.rotation.set(0, 0, 0); }
    if (lLeg && rLeg) { lLeg.rotation.set(0, 0, 0); rLeg.rotation.set(0, 0, 0); }
    if (lKnee && rKnee) { lKnee.rotation.set(0, 0, 0); rKnee.rotation.set(0, 0, 0); }
    if (spine) spine.rotation.set(0, 0, 0);
    if (head) head.rotation.set(0, 0, 0);
    vrmModel.position.y = baseY;
    vrmModel.rotation.z = 0;

    if (currentAction === 'idle') {
      vrmModel.position.y = baseY + Math.sin(t * 2) * 0.008;
    } else if (currentAction === 'hips') {
      if (lArm && rArm) { lArm.rotation.set(0, 0, -0.62); rArm.rotation.set(0, 0, 0.62); }
      if (lFore && rFore) { lFore.rotation.set(0, -1.35, -1.15); rFore.rotation.set(0, 1.35, 1.15); }
      if (lLeg && rLeg) { lLeg.rotation.z = 0.07; rLeg.rotation.z = -0.07; }
    } else if (currentAction === 'folded') {
      if (lArm && rArm) { lArm.rotation.set(-0.6, 0.4, -0.85); rArm.rotation.set(-0.65, -0.4, 0.85); }
      if (lFore && rFore) { lFore.rotation.set(0, -1.65, -0.25); rFore.rotation.set(0, 1.65, 0.25); }
    } else if (currentAction === 'gangster') {
      if (spine) spine.rotation.set(-0.16, 0.22, -0.1);
      if (head) head.rotation.set(0.14, -0.18, 0.08);
      if (lArm && lFore) { lArm.rotation.set(0, 0, -0.65); lFore.rotation.set(0, -1.3, -1.1); }
      if (rArm && rFore) { rArm.rotation.set(-0.55, -0.25, 0.75); rFore.rotation.set(0, 0.85, 0.45); }
      if (lLeg && rLeg) { lLeg.rotation.set(-0.15, 0, 0.09); rLeg.rotation.set(0.15, 0, -0.09); }
    } else if (currentAction === 'royal') {
      if (spine) spine.rotation.x = -0.1;
      if (lArm && lFore) { lArm.rotation.set(0, 0, -0.65); lFore.rotation.set(0, -1.3, -1.1); }
      if (rArm && rFore) { rArm.rotation.set(-0.55, 0, -0.4); rFore.rotation.set(0, 0.55, 0.35); }
    } else if (currentAction === 'zerog') {
      vrmModel.position.y = baseY + 0.16 + Math.sin(t * 2.2) * 0.06;
      if (lArm && rArm) { lArm.rotation.set(0.25, 0, -0.7 - Math.sin(t * 2) * 0.18); rArm.rotation.set(0.25, 0, 0.7 + Math.sin(t * 2) * 0.18); }
      if (lKnee && rKnee) { lKnee.rotation.x = 0.4; rKnee.rotation.x = 0.22; }
    } else if (currentAction === 'holo') {
      if (rArm && rFore) { rArm.rotation.set(-0.85, -0.25, 0.45); rFore.rotation.set(0, 1.15, 0.35); }
    } else if (currentAction === 'arcade') {
      vrmModel.position.y = baseY + Math.abs(Math.sin(t * 5)) * 0.12;
      if (lArm && rArm) { lArm.rotation.set(-0.35, 0, 0.45); rArm.rotation.set(-0.35, 0, -0.45); }
    } else if (currentAction === 'domain') {
      if (lArm && rArm) { lArm.rotation.set(-0.85, 0.5, -0.55); rArm.rotation.set(-0.85, -0.5, 0.55); }
      if (lFore && rFore) { lFore.rotation.y = -1.15; rFore.rotation.y = 1.15; }
    } else if (currentAction === 'dash') {
      vrmModel.rotation.z = -0.15;
      if (lArm && rArm) { lArm.rotation.set(0.8, 0, -0.9); rArm.rotation.set(0.8, 0, 0.9); }
      if (lLeg && rLeg) { lLeg.rotation.x = -0.4; rLeg.rotation.x = 0.5; }
    } else if (currentAction === 'dj') {
      vrmModel.position.y = baseY + Math.abs(Math.sin(t * 8)) * 0.04;
      if (rArm && rFore) { rArm.rotation.set(-0.55, 0, 0.4); rFore.rotation.set(0, 1.35, 0.65); }
      if (lArm && lFore) { lArm.rotation.set(-0.65, 0.25, -0.7); lFore.rotation.y = -0.85 - Math.sin(t * 8) * 0.35; }
    } else if (currentAction === 'star') {
      if (head) head.rotation.x = -0.35;
      if (lArm && rArm) { lArm.rotation.set(-0.2, 0, -0.95); rArm.rotation.set(-0.2, 0, 0.95); }
    } else if (currentAction === 'crown') {
      if (rArm && rFore) { rArm.rotation.set(-0.45, 0, -0.4); rFore.rotation.set(0, 0.45, 0.35); }
    } else if (currentAction === 'run') {
      const s = Math.sin(t * 9);
      vrmModel.position.y = baseY + Math.abs(Math.cos(t * 9)) * 0.06;
      if (lLeg && rLeg) { lLeg.rotation.x = s * 0.75; rLeg.rotation.x = -s * 0.75; }
      if (lKnee && rKnee) { lKnee.rotation.x = Math.max(0, -s) * 0.9; rKnee.rotation.x = Math.max(0, s) * 0.9; }
      if (lArm && rArm) { lArm.rotation.x = -s * 0.7; rArm.rotation.x = s * 0.7; }
    } else if (currentAction === 'jump') {
      const j = Math.max(0, Math.sin(t * 4));
      vrmModel.position.y = baseY + j * 0.35;
      if (lArm && rArm) { lArm.rotation.z = -1.25 + j * 1.6; rArm.rotation.z = 1.25 - j * 1.6; }
    } else if (currentAction === 'clap') {
      const c = Math.abs(Math.sin(t * 8)) * 0.35;
      if (lArm && rArm) { lArm.rotation.set(-0.7, 0.5 - c, -0.5); rArm.rotation.set(-0.7, -0.5 + c, 0.5); }
      if (lFore && rFore) { lFore.rotation.y = -0.8; rFore.rotation.y = 0.8; }
    } else if (currentAction === 'wave') {
      if (rArm && rFore) { rArm.rotation.z = -0.35; rFore.rotation.z = 0.5 + Math.sin(t * 7) * 0.35; }
    } else if (currentAction === 'spinKick') {
      vrmModel.rotation.y += 0.09;
      if (rLeg) rLeg.rotation.set(0, 0, 0.85);
      if (lArm && rArm) { lArm.rotation.z = -0.5; rArm.rotation.z = 0.5; }
    }

    if (currentHand !== 'open' && rArm && rFore) {
      rArm.rotation.set(-0.85, -0.2, 0.55);
      rFore.rotation.set(0, 1.15, 0.45);
      if (rHand) rHand.rotation.set(0, -0.8, 0);
      if ((currentHand === 'rebel2' || currentHand === 'omniaSign') && lArm && lFore) {
        lArm.rotation.set(-0.85, 0.2, -0.55);
        lFore.rotation.set(0, -1.15, -0.45);
        if (lHand) lHand.rotation.set(0, 0.8, 0);
      }
    }
    applyHandPose(currentHand);
  }
  renderer.render(scene, camera);
}

setTimeout(() => { resizeStage(); animate(); }, 250);
