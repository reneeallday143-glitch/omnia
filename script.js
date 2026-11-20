import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status');
const box = document.getElementById('stage-box');
const canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = true, isDragging = false, prevX = 0;
let currentStance = 'zerog', clock = new THREE.Clock();
let baseY = 0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1.3, 0.1, 20);
camera.position.set(0, 1.15, 2.65);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;

const light = new THREE.DirectionalLight(0xffffff, 1.5);
light.position.set(1, 2, 2);
const rim = new THREE.PointLight(0x7c5cff, 2.5, 8);
rim.position.set(-1.5, 1.5, -1.5);
scene.add(light, rim, new THREE.AmbientLight(0xffffff, 0.9), new THREE.GridHelper(3, 12, 0x7c5cff, 0x323d5e));

canvas.onmousedown = e => { isDragging = true; prevX = e.clientX; };
window.onmouseup = () => isDragging = false;
window.onmousemove = e => {
  if (!isDragging || !vrmModel) return;
  vrmModel.rotation.y += (e.clientX - prevX) * 0.015;
  prevX = e.clientX;
};

document.getElementById('spin-btn').onclick = () => spin = !spin;
document.getElementById('flip-btn').onclick = () => { if (vrmModel) vrmModel.rotation.y += Math.PI; };

document.querySelectorAll('.light-btns button').forEach(btn => {
  btn.onclick = () => rim.color.setHex(parseInt(btn.dataset.color));
});

const stanceMap = {
  'Zero-G Float': 'zerog',
  'Holo-Stream': 'holo',
  'Arcade Win': 'arcade',
  'Domain Seal': 'domain',
  'Cyber-Dash': 'dash',
  'Beat-Drop DJ': 'dj',
  'Star-Gazer': 'star',
  'Crown Summon': 'crown'
};

document.querySelectorAll('.panel button').forEach(btn => {
  if (btn.closest('.light-btns')) return;
  btn.onclick = () => {
    const label = btn.innerText.trim();
    for (const key in stanceMap) {
      if (label.includes(key)) {
        currentStance = stanceMap[key];
        status.innerText = 'Niecee C • ' + key + ' Active';
      }
    }
  };
});

const loader = new GLTFLoader();
function setupModel(gltf) {
  if (vrmModel) scene.remove(vrmModel);
  vrmModel = gltf.scene;
  vrmModel.rotation.y = Math.PI;
  baseY = vrmModel.position.y;
  scene.add(vrmModel);
  status.innerText = 'Niecee C Active • Drag to Rotate';
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
    loader.parse(ev.target.result, '', setupModel, err => {
      status.innerText = 'Error: ' + err;
    });
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
  if (vrmModel) {
    if (spin && !isDragging) vrmModel.rotation.y += 0.008;
    if (currentStance === 'zerog') vrmModel.position.y = baseY + Math.sin(t * 2) * 0.05;
    else if (currentStance === 'arcade') vrmModel.position.y = baseY + Math.abs(Math.sin(t * 5)) * 0.12;
    else if (currentStance === 'dj') vrmModel.position.y = baseY + Math.abs(Math.sin(t * 8)) * 0.04;
    else if (currentStance === 'dash') vrmModel.rotation.z = Math.sin(t * 3) * 0.08;
    else { vrmModel.position.y = baseY; vrmModel.rotation.z = 0; }
  }
  renderer.render(scene, camera);
}

setTimeout(() => {
  resizeStage();
  animate();
}, 250);
