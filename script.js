import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status');
const box = document.getElementById('stage-box');
const canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = false, isDragging = false, prevX = 0;
let currentAction = 'idle', currentHand = 'open', currentFace = 'neutral';
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

// 10 Custom Stage Backgrounds
const stageBackgrounds = {
  lobby:       { bg: 'radial-gradient(circle at 50% 35%, #253059 0%, #0b0d14 100%)', grid: 0x7c5cff },
  tokyo:       { bg: 'linear-gradient(180deg, #090418 0%, #3b0764 52%, #ec4899 100%)', grid: 0xf472b6 },
  penthouse:   { bg: 'linear-gradient(180deg, #0f172a 0%, #1e3a8a 55%, #38bdf8 100%)', grid: 0x38bdf8 },
  galaxy:      { bg: 'radial-gradient(circle at 30% 20%, #581c87 0%, #1e1b4b 55%, #030712 100%)', grid: 0xc084fc },
  studio:      { bg: 'radial-gradient(circle at 50% 40%, #94a3b8 0%, #334155 100%)', grid: 0xe2e8f0 },
  sunset:      { bg: 'linear-gradient(180deg, #311042 0%, #be185d 48%, #f59e0b 100%)', grid: 0xfbbf24 },
  sakuraNight: { bg: 'linear-gradient(180deg, #190a24 0%, #701a75 55%, #f9a8d4 100%)', grid: 0xf472b6 },
  matrix:      { bg: 'radial-gradient(circle at 50% 35%, #064e3b 0%, #022c22 60%, #020617 100%)', grid: 0x10b981 },
  crimson:     { bg: 'radial-gradient(circle at 50% 35%, #7f1d1d 0%, #450a0a 55%, #09090b 100%)', grid: 0xef4444 },
  miami:       { bg: 'linear-gradient(180deg, #06b6d4 0%, #8b5cf6 52%, #f43f5e 100%)', grid: 0x22d3ee }
};

document.querySelectorAll('.bg-btns button').forEach(btn => {
  btn.onclick = () => {
    const item = stageBackgrounds[btn.dataset.bg];
    if (item) {
      box.style.setProperty('background', item.bg, 'important');
      grid.material.color.setHex(item.grid);
      status.innerText = 'Background: ' + btn.innerText.trim();
    }
  };
});

// Original Omnia Atmospheres
const atmospheres = {
  eclipse:   { bg: 'radial-gradient(circle, #2a1215 0%, #07070c 100%)', key: 0xffb703, rim: 0xff2a5f, grid: 0xff2a5f },
  sakura:    { bg: 'radial-gradient(circle, #381836 0%, #0d1326 100%)', key: 0xffb3d9, rim: 0x00f5d4, grid: 0xff70a6 },
  biolume:   { bg: 'radial-gradient(circle, #092c38 0%, #040b14 100%)', key: 0x48cae4, rim: 0x00ff87, grid: 0x00b4d8 },
  prism:     { bg: 'radial-gradient(circle, #2e224d 0%, #110d1f 100%)', key: 0xfff1d0, rim: 0xc77dff, grid: 0xe0aaff },
  overdrive: { bg: 'radial-gradient(circle, #182617 0%, #050505 100%)', key: 0xd9ed92, rim: 0x70e000, grid: 0x9ef01a },
  solaris:   { bg: 'radial-gradient(circle, #3d1e10 0%, #100c24 100%)', key: 0xff9e00, rim: 0x7209b7, grid: 0xf77f00 }
};

document.querySelectorAll('.light-btns button').forEach(btn => {
  btn.onclick = () => {
    const theme = atmospheres[btn.dataset.theme];
    if (!theme) return;
    box.style.setProperty('background', theme.bg, 'important');
    light.color.setHex(theme.key);
    rim.color.setHex(theme.rim);
    grid.material.color.setHex(theme.grid);
    status.innerText = 'Atmosphere: ' + btn.innerText.trim();
  };
});

// 12 Facial Expressions Engine
function applyFacialExpression(expr) {
  currentFace = expr;
  const keywords = {
    joy:       ['joy', 'happy', 'smile'],
    grin:      ['joy', 'happy', 'aa', 'laugh'],
    sorrow:    ['sorrow', 'sad'],
    cry:       ['sorrow', 'sad', 'cry', 'tear'],
    angry:     ['angry', 'mad'],
    furious:   ['angry', 'mad', 'aa', 'shout'],
    surprised: ['surprised', 'oh', 'ou'],
    shocked:   ['surprised', 'shock', 'aa'],
    wink:      ['wink', 'fun'],
    smug:      ['fun', 'smug', 'smile'],
    sleepy:    ['blink', 'close', 'sleep']
  };
  faceMeshes.forEach(mesh => {
    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    Object.keys(mesh.morphTargetDictionary).forEach(key => {
      const idx = mesh.morphTargetDictionary[key];
      mesh.morphTargetInfluences[idx] = 0;
      if (expr !== 'neutral' && keywords[expr]) {
        const lower = key.toLowerCase();
        if (keywords[expr].some(k => lower.includes(k))) {
          mesh.morphTargetInfluences[idx] = 1.0;
        }
      }
    });
  });
}

document.querySelectorAll('.face-btns button').forEach(btn => {
  btn.onclick = () => {
    applyFacialExpression(btn.dataset.face);
    status.innerText = 'Expression: ' + btn.innerText.trim();
  };
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
      b.rotation.z = side === 'L' ? amount : -amount;
      b.rotation.x = amount * 0.45;
    }
  });
}

function applyHandPose(gesture) {
  ['L', 'R'].forEach(side => {
    ['Thumb', 'Index', 'Middle', 'Ring', 'Little'].forEach(f => curlFinger(side, f, 0.18));
  });
  if (gesture === 'peace') {
    ['Ring', 'Little', 'Thumb'].forEach(f => curlFinger('R', f, 1.35));
    ['Index', 'Middle'].forEach(f => curlFinger('R', f, 0));
  } else if (gesture === 'kheart') {
    ['Middle', 'Ring', 'Little'].forEach(f => curlFinger('R', f, 1.4));
    curlFinger('R', 'Index', 0.65);
    curlFinger('R', 'Thumb', 0.55);
  } else if (gesture === 'rock') {
    ['Middle', 'Ring', 'Thumb'].forEach(f => curlFinger('R', f, 1.35));
    ['Index', 'Little'].forEach(f => curlFinger('R', f, 0));
  } else if (gesture === 'omniaSign') {
    ['L', 'R'].forEach(s => {
      ['Middle', 'Ring', 'Little'].forEach(f => curlFinger(s, f, 1.3));
      ['Index', 'Thumb'].forEach(f => curlFinger(s, f, 0.25));
    });
  } else if (gesture === 'rebel1' || gesture === 'rebel2') {
    const sides = gesture === 'rebel2' ? ['L', 'R'] : ['R'];
    sides.forEach(s => {
      ['Index', 'Ring', 'Little', 'Thumb'].forEach(f => curlFinger(s, f, 1.45));
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
