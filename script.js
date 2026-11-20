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

const atmospheres = {
  sakura:    { bg: 'radial-gradient(circle, #381836 0%, #0d1326 100%)', key: 0xffb3d9, rim: 0x00f5d4, grid: 0xff70a6, pColor: 0xff85c0, pSize: 0.065, mode: 'sakura' },
  eclipse:   { bg: 'radial-gradient(circle, #2a1215 0%, #07070c 100%)', key: 0xffb703, rim: 0xff2a5f, grid: 0xff2a5f, pColor: 0xff9e00, pSize: 0.055, mode: 'rise' },
  biolume:   { bg: 'radial-gradient(circle, #092c38 0%, #040b14 100%)', key: 0x48cae4, rim: 0x00ff87, grid: 0x00b4d8, pColor: 0x00f5d4, pSize: 0.06, mode: 'rise' },
  prism:     { bg: 'radial-gradient(circle, #2e224d 0%, #110d1f 100%)', key: 0xfff1d0, rim: 0xc77dff, grid: 0xe0aaff, pColor: 0xe0aaff, pSize: 0.055, mode: 'float' },
  overdrive: { bg: 'radial-gradient(circle, #182617 0%, #050505 100%)', key: 0xd9ed92, rim: 0x70e000, grid: 0x9ef01a, pColor: 0x9ef01a, pSize: 0.05, mode: 'fast' },
  solaris:   { bg: 'radial-gradient(circle, #3d1e10 0%, #100c24 100%)', key: 0xff9e00, rim: 0x7209b7, grid: 0xf77f00, pColor: 0xfbbf24, pSize: 0.055, mode: 'float' }
};

document.querySelectorAll('.light-btns button').forEach(btn => {
  btn.onclick = () => {
    const theme = atmospheres[btn.dataset.theme];
    if (!theme) return;
    box.style.setProperty('background-image', theme.bg, 'important');
    light.color.setHex(theme.key);
    rim.color.setHex(theme.rim);
    grid.material.color.setHex(theme.grid);
    pMat.color.setHex(theme.pColor);
    pMat.size = theme.pSize;
    currentParticleMode = theme.mode;
    status.innerText = 'Atmosphere: ' + btn.innerText.trim();
  };
});

function applyFacialExpression(expr) {
  currentFace = expr;
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
    fxRing.visible = ['holo', 'domain', 'zerog', 'spinKick'].includes(currentAction);
    fxCrown.visible = ['crown', 'arcade', 'royal'].includes(currentAction);
    status.innerText = 'Active: ' + btn.innerText.trim();
  };
});
document.querySelectorAll('.hand-btns button').forEach(btn => {
  btn.onclick = () => {
    currentHand = btn.dataset.hand;
    status.innerText = 'Gesture: ' + btn.innerText.trim();
  };
});

function findBone(namePart) {
  return Object.values(bones).find(b => b.name.toLowerCase().includes(namePart.toLowerCase()));
}

function curlFinger(side, finger, amount) {
  const sideTag = side === 'L' ? ['l_hand', 'left'] : ['r_hand', 'right'];
  ['1', '2', '3'].forEach(seg => {
    const b = Object.values(bones).find(bone => {
      const n = bone.name.toLowerCase();
      return sideTag.some(s => n.includes(s)) && n.includes(finger.toLowerCase()) && n.includes(seg);
    });
    if (b) {
      b.rotation.z = side === 'L' ? -amount : amount;
      b.rotation.x = amount * 0.5;
    }
  });
}

function applyHandPose(gesture) {
  ['L', 'R'].forEach(side => {
    ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].forEach(f => curlFinger(side, f, 0.22));
  });
  if (gesture === 'peace') {
    ['Ring', 'Little', 'Thumb'].forEach(f => curlFinger('R', f, 1.4));
    ['Index', 'Middle'].forEach(f => curlFinger('R', f, 0));
  } else if (gesture === 'kheart') {
    ['Middle', 'Ring', 'Little'].forEach(f => curlFinger('R', f, 1.45));
    curlFinger('R', 'Index', 0.7);
    curlFinger('R', 'Thumb', 0.6);
  } else if (gesture === 'rock') {
    ['Middle', 'Ring', 'Thumb'].forEach(f => curlFinger('R', f, 1.4));
    ['Index', 'Little'].forEach(f => curlFinger('R', f, 0));
  } else if (gesture === 'omniaSign') {
    ['L', 'R'].forEach(s => {
      ['Middle', 'Ring', 'Little'].forEach(f => curlFinger(s, f, 1.35));
      ['Index', 'Thumb'].forEach(f => curlFinger(s, f, 0.3));
    });
  } else if (gesture === 'rebel1' || gesture === 'rebel2') {
    const sides = gesture === 'rebel2' ? ['L', 'R'] : ['R'];
    sides.forEach(s => {
      ['Index', 'Ring', 'Little', 'Thumb'].forEach(f => curlFinger(s, f, 1.5));
      curlFinger(s, 'Middle', 0);
    });
  }
}

const loader = new GLTFLoader();
function setupModel(gltf) {
  if (vrmModel) scene.remove(vrmModel);
  vrmModel = gltf.scene;
  bones = {};
  faceMeshes = [];
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
  status.innerText = 'Loading ' + file.name + '...';
  const reader = new FileReader();
  reader.onload = ev => {
    loader.parse(ev.target.result, '', setupModel, err => { status.innerText = 'Error: ' + err; });
  };
  reader.readAsArrayBuffer(file);
};

function resizeStage() {
  const w = box.clientWidth || 500;
  const h = box.clientHeight || 400;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener('resize', resizeStage);

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  const posArr = particles.geometry.attributes.position.array;
  for (let i = 0; i < particleCount; i++) {
    const idx = i * 3;
    if (currentParticleMode === 'sakura') {
      posArr[idx + 1] -= 0.006 * pSpeeds[i];
      posArr[idx] += Math.sin(t * 2 + i) * 0.003;
      if (posArr[idx + 1] < 0) posArr[idx + 1] = 2.6;
    } else if (currentParticleMode === 'rise') {
      posArr[idx + 1] += 0.008 * pSpeeds[i];
      if (posArr[idx + 1] > 2.6) posArr[idx + 1] = 0;
    } else if (currentParticleMode === 'fast') {
      posArr[idx + 1] += 0.02 * pSpeeds[i];
      if (posArr[idx + 1] > 2.6) posArr[idx + 1] = 0;
    } else {
      posArr[idx + 1] += Math.sin(t * 1.5 + i) * 0.002;
    }
  }
  particles.geometry.attributes.position.needsUpdate = true;

  if (fxRing.visible) {
    fxRing.position.y = 0.6 + Math.sin(t * 3) * 0.45;
    fxRing.rotation.z = t * 2;
  }
  if (fxCrown.visible) {
    fxCrown.rotation.y = t * 2.5;
    fxCrown.position.y = 1.72 + Math.sin(t * 3) * 0.03;
  }

  if (vrmModel) {
    if (spin && !isDragging) vrmModel.rotation.y += 0.008;
    const lArm = findBone('L_UpperArm'), rArm = findBone('R_UpperArm');
    const lFore = findBone('L_LowerArm'), rFore = findBone('R_LowerArm');
    const lLeg = findBone('L_UpperLeg'), rLeg = findBone('R_UpperLeg');
    const lKnee = findBone('L_LowerLeg'), rKnee = findBone('R_LowerLeg');
    const spine = findBone('Spine'), head = findBone('Head');

    if (lArm && rArm) { lArm.rotation.set(0, 0, -1.25); rArm.rotation.set(0, 0, 1.25); }
    if (lFore && rFore) { lFore.rotation.set(0, 0, -0.06); rFore.rotation.set(0, 0, 0.06); }
    if (lLeg && rLeg) { lLeg.rotation.set(0, 0, 0); rLeg.rotation.set(0, 0, 0); }
    if (lKnee && rKnee) { lKnee.rotation.set(0, 0, 0); rKnee.rotation.set(0, 0, 0); }
    if (spine) spine.rotation.set(0, 0, 0);
    if (head) head.rotation.set(0, 0, 0);
    vrmModel.position.y = baseY;
    vrmModel.rotation.z = 0;

    if (currentAction === 'idle') {
      vrmModel.position.y = baseY + Math.sin(t * 2) * 0.008;
    } else if (currentAction === 'hips') {
      if (lArm && rArm) { lArm.rotation.set(0, 0, -0.65); rArm.rotation.set(0, 0, 0.65); }
      if (lFore && rFore) { lFore.rotation.set(0, -1.25, -1.1); rFore.rotation.set(0, 1.25, 1.1); }
      if (lLeg && rLeg) { lLeg.rotation.z = 0.06; rLeg.rotation.z = -0.06; }
    } else if (currentAction === 'folded') {
      if (lArm && rArm) { lArm.rotation.set(-0.55, 0.35, -0.85); rArm.rotation.set(-0.6, -0.35, 0.85); }
      if (lFore && rFore) { lFore.rotation.set(0, -1.55, -0.3); rFore.rotation.set(0, 1.55, 0.3); }
    } else if (currentAction === 'gangster') {
      if (spine) spine.rotation.set(-0.14, 0.18, -0.08);
      if (head) head.rotation.set(0.12, -0.15, 0.06);
      if (lArm && lFore) { lArm.rotation.set(0, 0, -0.7); lFore.rotation.set(0, -1.2, -1.0); }
      if (rArm && rFore) { rArm.rotation.set(-0.45, -0.2, 0.75); rFore.rotation.set(0, 0.7, 0.4); }
      if (lLeg && rLeg) { lLeg.rotation.set(-0.12, 0, 0.08); rLeg.rotation.set(0.12, 0, -0.08); }
    } else if (currentAction === 'royal') {
      if (spine) spine.rotation.x = -0.08;
      if (lArm && lFore) { lArm.rotation.set(0, 0, -0.7); lFore.rotation.set(0, -1.2, -1.0); }
      if (rArm && rFore) { rArm.rotation.set(-0.5, 0, -0.35); rFore.rotation.set(0, 0.5, 0.3); }
    } else if (currentAction === 'zerog') {
      vrmModel.position.y = baseY + 0.14 + Math.sin(t * 2.2) * 0.06;
      if (lArm && rArm) { lArm.rotation.set(0.2, 0, -0.75 - Math.sin(t * 2) * 0.15); rArm.rotation.set(0.2, 0, 0.75 + Math.sin(t * 2) * 0.15); }
      if (lKnee && rKnee) { lKnee.rotation.x = 0.35; rKnee.rotation.x = 0.2; }
    } else if (currentAction === 'holo') {
      if (rArm && rFore) { rArm.rotation.set(-0.85, -0.3, 0.4); rFore.rotation.set(0, 1.1, 0.3); }
    } else if (currentAction === 'arcade') {
      vrmModel.position.y = baseY + Math.abs(Math.sin(t * 5)) * 0.12;
      if (lArm && rArm) { lArm.rotation.set(-0.3, 0, 0.45); rArm.rotation.set(-0.3, 0, -0.45); }
    } else if (currentAction === 'domain') {
      if (lArm && rArm) { lArm.rotation.set(-0.8, 0.45, -0.55); rArm.rotation.set(-0.8, -0.45, 0.55); }
      if (lFore && rFore) { lFore.rotation.y = -1.1; rFore.rotation.y = 1.1; }
    } else if (currentAction === 'dash') {
      vrmModel.rotation.z = -0.14;
      if (lArm && rArm) { lArm.rotation.set(0.75, 0, -0.9); rArm.rotation.set(0.75, 0, 0.9); }
      if (lLeg && rLeg) { lLeg.rotation.x = -0.35; rLeg.rotation.x = 0.45; }
    } else if (currentAction === 'dj') {
      vrmModel.position.y = baseY + Math.abs(Math.sin(t * 8)) * 0.04;
      if (rArm && rFore) { rArm.rotation.set(-0.5, 0, 0.4); rFore.rotation.set(0, 1.3, 0.6); }
      if (lArm && lFore) { lArm.rotation.set(-0.6, 0.2, -0.7); lFore.rotation.y = -0.8 - Math.sin(t * 8) * 0.3; }
    } else if (currentAction === 'star') {
      if (head) head.rotation.x = -0.35;
    } else if (currentAction === 'crown') {
      if (rArm && rFore) { rArm.rotation.set(-0.4, 0, -0.35); rFore.rotation.set(0, 0.4, 0.3); }
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
      rArm.rotation.set(-0.85, -0.25, 0.55);
      rFore.rotation.set(0, 1.15, 0.45);
      if ((currentHand === 'rebel2' || currentHand === 'omniaSign') && lArm && lFore) {
        lArm.rotation.set(-0.85, 0.25, -0.55);
        lFore.rotation.set(0, -1.15, -0.45);
      }
    }
    applyHandPose(currentHand);
  }
  renderer.render(scene, camera);
}

setTimeout(() => {
  resizeStage();
  animate();
}, 250);
