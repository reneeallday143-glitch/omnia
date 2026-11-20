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

function makeGlowTex(type) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (type === 'petal') {
    const g = ctx.createLinearGradient(64, 10, 64, 118);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#ffb3d9');
    g.addColorStop(1, '#d9468f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(64, 10);
    ctx.bezierCurveTo(106, 36, 102, 92, 64, 116);
    ctx.bezierCurveTo(26, 92, 22, 36, 64, 10);
    ctx.fill();
  } else if (type === 'bubble') {
    const g = ctx.createRadialGradient(64, 64, 18, 64, 64, 58);
    g.addColorStop(0, 'rgba(56,189,248,0.04)');
    g.addColorStop(0.65, 'rgba(168,85,247,0.28)');
    g.addColorStop(0.88, 'rgba(56,189,248,0.88)');
    g.addColorStop(0.96, 'rgba(253,224,71,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.ellipse(44, 40, 12, 6, -0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'ember') {
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate(-0.65);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, '#fde047');
    g.addColorStop(0.6, '#f97316');
    g.addColorStop(1, 'rgba(234,88,12,0)');
    ctx.fillStyle = g;
    ctx.scale(0.32, 1.0);
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (type === 'bokeh') {
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 56);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#fde68a');
    g.addColorStop(0.7, 'rgba(245,158,11,0.35)');
    g.addColorStop(1, 'rgba(245,158,11,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createLinearGradient(64, 0, 64, 128);
    g.addColorStop(0, 'rgba(163,230,53,0)');
    g.addColorStop(0.5, '#ecfccb');
    g.addColorStop(1, 'rgba(163,230,53,0)');
    ctx.fillStyle = g;
    ctx.fillRect(58, 0, 12, 128);
  }
  return new THREE.CanvasTexture(c);
}

const texMap = {
  petal: makeGlowTex('petal'),
  bubble: makeGlowTex('bubble'),
  ember: makeGlowTex('ember'),
  bokeh: makeGlowTex('bokeh'),
  laser: makeGlowTex('laser')
};

const P_COUNT = 240;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(P_COUNT * 3);
const pMeta = [];
for (let i = 0; i < P_COUNT; i++) {
  pPos.set([(Math.random() - 0.5) * 3.4, Math.random() * 2.8, (Math.random() - 0.5) * 2.8], i * 3);
  pMeta.push({ speed: 0.4 + Math.random() * 0.9, phase: Math.random() * Math.PI * 2, radius: 0.3 + Math.random() * 1.2 });
}
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
fxCrown.position.set(0, 1.72, 0);
fxCrown.visible = false;

const fxRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.018, 16, 64), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 }));
fxRing.rotation.x = Math.PI / 2;
fxRing.visible = false;

const fxHolo = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshBasicMaterial({ color: 0x38bdf8, wireframe: true, transparent: true, opacity: 0.85 }));
fxHolo.position.set(-0.28, 1.18, 0.45);
fxHolo.visible = false;
scene.add(fxCrown, fxRing, fxHolo);

const sceneGradients = {
  tokyo: 'linear-gradient(180deg, #07031a 0%, #2e0854 55%, #ff1e8a 100%)',
  sakuraNight: 'linear-gradient(180deg, #120724 0%, #4a1259 60%, #f472b6 100%)',
  penthouse: 'linear-gradient(180deg, #09152b 0%, #1d4ed8 60%, #38bdf8 100%)',
  lobby: 'radial-gradient(circle, #312e81 0%, #111827 65%, #030712 100%)',
  galaxy: 'radial-gradient(circle at 35% 30%, #6b21a8 0%, #1e1b4b 50%, #020617 100%)',
  miami: 'linear-gradient(180deg, #0891b2 0%, #9333ea 50%, #f43f5e 100%)',
  crimson: 'radial-gradient(circle, #991b1b 0%, #450a0a 55%, #09090b 100%)',
  studio: 'radial-gradient(circle, #cbd5e1 0%, #64748b 60%, #1e293b 100%)'
};

canvas.onmousedown = e => { isDragging = true; prevX = e.clientX; };
window.onmouseup = () => { isDragging = false; };
window.onmousemove = e => { if (isDragging && vrmModel) { vrmModel.rotation.y += (e.clientX - prevX) * 0.015; prevX = e.clientX; } };
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  camZ = Math.max(0.75, Math.min(4.2, camZ + e.deltaY * 0.002));
  camera.position.set(0, camY, camZ);
}, { passive: false });

const spinBtn = document.getElementById('spin-btn');
if (spinBtn) spinBtn.onclick = () => { spin = !spin; spinBtn.innerText = spin ? '🔄 Spinning (Click to Stand Still)' : '🧍 Stand Still (Paused)'; };
const flipBtn = document.getElementById('flip-btn');
if (flipBtn) flipBtn.onclick = () => { if (vrmModel) vrmModel.rotation.y += Math.PI; };
const zoomInBtn = document.getElementById('zoom-in-btn');
if (zoomInBtn) zoomInBtn.onclick = () => { camZ = Math.max(0.75, camZ - 0.35); camera.position.set(0, camY, camZ); };
const zoomOutBtn = document.getElementById('zoom-out-btn');
if (zoomOutBtn) zoomOutBtn.onclick = () => { camZ = Math.min(4.2, camZ + 0.35); camY = 1.15; camera.position.set(0, camY, camZ); };
const faceCamBtn = document.getElementById('face-cam-btn');
if (faceCamBtn) faceCamBtn.onclick = () => { camY = 1.48; camZ = 0.95; camera.position.set(0, camY, camZ); };

document.querySelectorAll('.bg-btns button').forEach(btn => {
  btn.onclick = () => {
    const bg = sceneGradients[btn.dataset.bg] || sceneGradients.lobby;
    box.style.setProperty('background-image', bg, 'important');
    status.innerText = 'Scene: ' + btn.innerText.trim();
  };
});

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
    const t = atmospheres[btn.dataset.theme];
    if (!t) return;
    box.style.setProperty('background-image', t.bg, 'important');
    light.color.setHex(t.key);
    rim.color.setHex(t.rim);
    grid.material.color.setHex(t.grid);
    pMat.map = t.tex;
    pMat.size = t.size;
    pMat.blending = t.blend;
    pMat.needsUpdate = true;
    currentParticleMode = t.mode;
    status.innerText = 'Atmosphere: ' + btn.innerText.trim();
  };
});

document.querySelectorAll('.face-btns button').forEach(btn => {
  btn.onclick = () => {
    const expr = btn.dataset.face;
    const kw = {
      joy: ['joy', 'happy', 'smile'], grin: ['joy', 'happy', 'aa'],
      sorrow: ['sorrow', 'sad'], cry: ['sorrow', 'sad', 'cry'],
      angry: ['angry', 'mad'], furious: ['angry', 'mad', 'aa'],
      surprised: ['surprised', 'oh'], shocked: ['surprised', 'shock', 'aa'],
      wink: ['wink', 'fun'], smug: ['fun', 'smug'], sleepy: ['blink', 'close']
    };
    faceMeshes.forEach(m => {
      if (!m.morphTargetDictionary || !m.morphTargetInfluences) return;
      m.morphTargetInfluences.fill(0);
      Object.entries(m.morphTargetDictionary).forEach(([k, idx]) => {
        if (expr !== 'neutral' && kw[expr] && kw[expr].some(w => k.toLowerCase().includes(w))) {
          m.morphTargetInfluences.splice(idx, 1, 1);
        }
      });
    });
    status.innerText = 'Expression: ' + btn.innerText.trim();
  };
});

document.querySelectorAll('[data-action]').forEach(btn => {
  btn.onclick = () => {
    currentAction = btn.dataset.action;
    fxRing.visible = ['holo', 'domain', 'zerog', 'spinKick', 'star'].includes(currentAction);
    fxHolo.visible = (currentAction === 'holo');
    fxCrown.visible = ['crown', 'arcade', 'royal'].includes(currentAction);
    status.innerText = 'Pose/FX: ' + btn.innerText.trim();
  };
});

document.querySelectorAll('.hand-btns button').forEach(btn => {
  btn.onclick = () => {
    currentHand = btn.dataset.hand;
    status.innerText = 'Gesture: ' + btn.innerText.trim();
  };
});

function findBone(part) {
  return Object.values(bones).find(b => b.name.toLowerCase().includes(part.toLowerCase()));
}

function curlFinger(side, finger, curl) {
  const sTags = side === 'L' ? ['l_', 'left'] : ['r_', 'right'];
  const segs = ['1', '2', '3', 'proximal', 'intermediate', 'distal'];
  Object.values(bones).forEach(b => {
    const n = b.name.toLowerCase();
    if (sTags.some(s => n.includes(s)) && n.includes(finger.toLowerCase()) && segs.some(g => n.includes(g))) {
      b.rotation.z = side === 'L' ? -curl : curl;
      b.rotation.x = curl * 0.45;
    }
  });
}

function applyHandPose(g) {
  ['L', 'R'].forEach(s => ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].forEach(f => curlFinger(s, f, 0.12)));
  if (g === 'peace') {
    ['Ring', 'Little', 'Thumb'].forEach(f => curlFinger('L', f, 1.35));
    ['Index', 'Middle'].forEach(f => curlFinger('L', f, -0.05));
  } else if (g === 'kheart') {
    ['Middle', 'Ring', 'Little'].forEach(f => curlFinger('L', f, 1.4));
    curlFinger('L', 'Index', 0.65);
    curlFinger('L', 'Thumb', 0.55);
  } else if (g === 'rock') {
    ['Middle', 'Ring', 'Thumb'].forEach(f => curlFinger('L', f, 1.35));
    ['Index', 'Little'].forEach(f => curlFinger('L', f, -0.05));
  } else if (g === 'omniaSign') {
    ['L', 'R'].forEach(s => {
      ['Middle', 'Ring', 'Little'].forEach(f => curlFinger(s, f, 1.3));
      ['Index', 'Thumb'].forEach(f => curlFinger(s, f, 0.25));
    });
  } else if (g === 'rebel1' || g === 'rebel2') {
    (g === 'rebel2' ? ['L', 'R'] : ['L']).forEach(s => {
      ['Index', 'Ring', 'Little', 'Thumb'].forEach(f => curlFinger(s, f, 1.45));
      curlFinger(s, 'Middle', -0.05);
    });
  }
}
const loader = new GLTFLoader();
function setupModel(gltf) {
  if (vrmModel) scene.remove(vrmModel);
  vrmModel = gltf.scene;
  bones = {};
  faceMeshes = [];
  vrmModel.traverse(o => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh && o.morphTargetDictionary) faceMeshes.push(o);
  });
  baseY = vrmModel.position.y;
  scene.add(vrmModel);
  status.innerText = 'Niecee C Ready';
}

loader.load('./Niecee%20C.vrm', setupModel, undefined, () => {
  status.innerText = 'Grid Ready • Choose File';
});

const filePicker = document.getElementById('file-picker');
if (filePicker) {
  filePicker.onchange = e => {
    const f = e.target.files.item(0);
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => loader.parse(ev.target.result, '', setupModel);
    r.readAsArrayBuffer(f);
  };
}

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
  const posAttr = particles.geometry.attributes.position;

  for (let i = 0; i < P_COUNT; i++) {
    let x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    const m = pMeta.at(i);
    if (currentParticleMode === 'sakura') {
      y -= 0.006 * m.speed;
      x += Math.sin(t * 1.6 + y * 2.2) * 0.006;
      if (y < 0) y = 2.8;
    } else if (currentParticleMode === 'ember') {
      x += 0.011 * m.speed;
      y += 0.011 * m.speed;
      if (x > 1.7 || y > 2.8) { x = -1.7 + Math.random() * 1.4; y = Math.random() * 0.8; }
    } else if (currentParticleMode === 'bubble') {
      y += 0.005 * m.speed;
      x += Math.sin(t * 2 + m.phase) * 0.003;
      if (y > 2.8) y = 0;
    } else if (currentParticleMode === 'beam') {
      x -= 0.004 * m.speed;
      y -= 0.004 * m.speed;
      if (x < -1.7 || y < 0) { x = Math.random() * 1.8; y = 2.2 + Math.random() * 0.6; }
    } else if (currentParticleMode === 'wave') {
      const ang = t * 1.4 + m.phase;
      x = Math.cos(ang) * m.radius * 1.3;
      z = Math.sin(ang) * m.radius * 1.3;
      y = 1.15 + Math.sin(x * 2.2 + t * 2) * 0.25;
    } else if (currentParticleMode === 'laser') {
      y += 0.045 * m.speed;
      if (y > 2.9) y = -0.1;
    }
    posAttr.setXYZ(i, x, y, z);
  }
  posAttr.needsUpdate = true;

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

    if (lArm && rArm) { lArm.rotation.set(0, 0, -1.25); rArm.rotation.set(0, 0, -1.25); }
    if (lFore && rFore) { lFore.rotation.set(0, 0, -0.06); rFore.rotation.set(0, 0, -0.06); }
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
      if (lArm && rArm) { lArm.rotation.set(0, 0, -0.58); rArm.rotation.set(0, 0, -0.58); }
      if (lFore && rFore) { lFore.rotation.set(0, -1.35, -1.15); rFore.rotation.set(0, 1.35, -1.15); }
    } else if (currentAction === 'folded') {
      if (lArm && rArm) { lArm.rotation.set(-0.6, 0.4, -0.85); rArm.rotation.set(-0.6, -0.4, -0.85); }
      if (lFore && rFore) { lFore.rotation.set(0, -1.65, -0.25); rFore.rotation.set(0, 1.65, -0.25); }
    } else if (currentAction === 'gangster') {
      if (spine) spine.rotation.set(-0.18, 0.25, -0.12);
      if (head) head.rotation.set(0.15, -0.2, 0.08);
      if (lArm && lFore) { lArm.rotation.set(0, 0, -0.62); lFore.rotation.set(0, -1.3, -1.1); }
      if (rArm && rFore) { rArm.rotation.set(-0.55, 0.3, -0.75); rFore.rotation.set(0, -0.9, -0.45); }
    } else if (currentAction === 'royal') {
      if (spine) spine.rotation.x = -0.12;
      if (lArm && lFore) { lArm.rotation.set(0, 0, -0.62); lFore.rotation.set(0, -1.3, -1.1); }
      if (rArm && rFore) { rArm.rotation.set(-0.65, 0, -0.45); rFore.rotation.set(0, -0.55, -0.35); }
    } else if (currentAction === 'zerog') {
      vrmModel.position.y = baseY + 0.16 + Math.sin(t * 2.2) * 0.06;
      if (lArm && rArm) { lArm.rotation.set(0.25, 0, -0.75); rArm.rotation.set(0.25, 0, -0.75); }
      if (lKnee && rKnee) { lKnee.rotation.x = 0.4; rKnee.rotation.x = 0.22; }
    } else if (currentAction === 'holo') {
      if (lArm && lFore) { lArm.rotation.set(-0.85, 0.25, -0.45); lFore.rotation.set(0, -1.15, -0.35); }
    } else if (currentAction === 'arcade') {
      vrmModel.position.y = baseY + Math.abs(Math.sin(t * 5)) * 0.12;
      if (lArm && rArm) { lArm.rotation.set(-0.35, 0, 0.45); rArm.rotation.set(-0.35, 0, 0.45); }
    } else if (currentAction === 'domain') {
      if (lArm && rArm) { lArm.rotation.set(-0.85, 0.5, -0.55); rArm.rotation.set(-0.85, -0.5, -0.55); }
      if (lFore && rFore) { lFore.rotation.y = -1.15; rFore.rotation.y = 1.15; }
    } else if (currentAction === 'dash') {
      vrmModel.rotation.z = -0.15;
      if (lArm && rArm) { lArm.rotation.set(0.8, 0, -0.9); rArm.rotation.set(0.8, 0, -0.9); }
      if (lLeg && rLeg) { lLeg.rotation.x = -0.4; rLeg.rotation.x = 0.5; }
    } else if (currentAction === 'dj') {
      vrmModel.position.y = baseY + Math.abs(Math.sin(t * 8)) * 0.04;
      if (lArm && lFore) { lArm.rotation.set(-0.65, 0.25, -0.7); lFore.rotation.y = -0.85 - Math.sin(t * 8) * 0.35; }
    } else if (currentAction === 'star') {
      if (head) head.rotation.x = -0.35;
      if (lArm && rArm) { lArm.rotation.set(-0.2, 0, -0.95); rArm.rotation.set(-0.2, 0, -0.95); }
    } else if (currentAction === 'crown') {
      if (lArm && lFore) { lArm.rotation.set(-0.45, 0, -0.4); lFore.rotation.set(0, -0.45, -0.35); }
    } else if (currentAction === 'run') {
      const s = Math.sin(t * 9);
      vrmModel.position.y = baseY + Math.abs(Math.cos(t * 9)) * 0.06;
      if (lLeg && rLeg) { lLeg.rotation.x = s * 0.75; rLeg.rotation.x = -s * 0.75; }
      if (lKnee && rKnee) { lKnee.rotation.x = Math.max(0, -s) * 0.9; rKnee.rotation.x = Math.max(0, s) * 0.9; }
      if (lArm && rArm) { lArm.rotation.x = -s * 0.7; rArm.rotation.x = s * 0.7; }
    } else if (currentAction === 'jump') {
      const j = Math.max(0, Math.sin(t * 4));
      vrmModel.position.y = baseY + j * 0.35;
      if (lArm && rArm) { lArm.rotation.z = -1.25 + j * 1.6; rArm.rotation.z = -1.25 + j * 1.6; }
    } else if (currentAction === 'clap') {
      const c = Math.abs(Math.sin(t * 7));
      const stomp = Math.sin(t * 7);
      vrmModel.position.y = baseY + Math.abs(stomp) * 0.05;
      if (lArm && rArm) { lArm.rotation.set(-0.85, 0.65 - c * 0.45, -0.45); rArm.rotation.set(-0.85, -0.65 + c * 0.45, -0.45); }
      if (lFore && rFore) { lFore.rotation.set(0, -1.15, -0.2); rFore.rotation.set(0, 1.15, -0.2); }
      if (lLeg && rLeg) { lLeg.rotation.x = Math.max(0, stomp) * 0.55; rLeg.rotation.x = Math.max(0, -stomp) * 0.55; }
      if (lKnee && rKnee) { lKnee.rotation.x = Math.max(0, stomp) * 0.85; rKnee.rotation.x = Math.max(0, -stomp) * 0.85; }
    } else if (currentAction === 'wave') {
      if (lArm && lFore) { lArm.rotation.z = 0.35; lFore.rotation.z = -0.5 + Math.sin(t * 7) * 0.35; }
    } else if (currentAction === 'spinKick') {
      vrmModel.rotation.y += 0.09;
      if (rLeg) rLeg.rotation.set(0, 0, 0.85);
    }

    if (currentHand !== 'open' && lArm && lFore) {
      lArm.rotation.set(-0.85, 0.25, -0.55);
      lFore.rotation.set(0, -1.25, -0.4);
      if (lHand) lHand.rotation.set(0, -1.2, 0.3);
      if ((currentHand === 'rebel2' || currentHand === 'omniaSign') && rArm && rFore) {
        rArm.rotation.set(-0.85, -0.25, -0.55);
        rFore.rotation.set(0, 1.25, -0.4);
        if (rHand) rHand.rotation.set(0, 1.2, -0.3);
      }
    }
    applyHandPose(currentHand);
  }
  renderer.render(scene, camera);
}

setTimeout(() => { resizeStage(); animate(); }, 250);
