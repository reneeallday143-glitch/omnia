import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status');
const box = document.getElementById('stage-box');
const canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = true, isDragging = false, prevX = 0;
let bones = {}, currentPose = 'relaxed', clock = new THREE.Clock();

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1.3, 0.1, 20);
camera.position.set(0, 1.15, 2.5);

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

document.querySelectorAll('.pose-btns button').forEach(btn => {
  btn.onclick = () => { currentPose = btn.dataset.pose; };
});

function findHumanoidBones(root) {
  const found = {};
  root.traverse(obj => {
    if (!obj.isBone) return;
    const n = obj.name.toLowerCase();
    if (n.includes('left') && n.includes('upper') && n.includes('arm')) found.lUpperArm = obj;
    if (n.includes('right') && n.includes('upper') && n.includes('arm')) found.rUpperArm = obj;
    if (n.includes('left') && n.includes('lower') && n.includes('arm')) found.lLowerArm = obj;
    if (n.includes('right') && n.includes('lower') && n.includes('arm')) found.rLowerArm = obj;
    if (n.includes('spine') || n.includes('chest')) found.spine = obj;
    if (n.includes('head') && !n.includes('top')) found.head = obj;
  });
  return found;
}

function updateCharacterPose(t) {
  if (!vrmModel) return;
  const breath = Math.sin(t * 2.4);

  // Subtle idle breathing & head sway
  if (bones.spine) bones.spine.rotation.x = breath * 0.025;
  if (bones.head) {
    bones.head.rotation.z = Math.sin(t * 1.3) * 0.03;
    bones.head.rotation.x = -breath * 0.02;
  }

  // Relaxed arms down by sides (default VRM T-pose arms stick out horizontally)
  if (bones.lUpperArm && bones.rUpperArm) {
    if (currentPose === 'relaxed') {
      bones.lUpperArm.rotation.z = 1.25 + breath * 0.03;
      bones.rUpperArm.rotation.z = -1.25 - breath * 0.03;
      if (bones.lLowerArm) bones.lLowerArm.rotation.z = 0.15;
      if (bones.rLowerArm) bones.rLowerArm.rotation.z = -0.15;
    } else if (currentPose === 'wave') {
      bones.lUpperArm.rotation.z = 1.25;
      bones.rUpperArm.rotation.z = 0.65 + Math.sin(t * 6) * 0.25;
      if (bones.rLowerArm) bones.rLowerArm.rotation.z = 0.85 + Math.sin(t * 6) * 0.3;
    } else if (currentPose === 'cheer') {
      bones.lUpperArm.rotation.z = -0.55 + Math.sin(t * 5) * 0.12;
      bones.rUpperArm.rotation.z = 0.55 - Math.sin(t * 5) * 0.12;
      if (bones.lLowerArm) bones.lLowerArm.rotation.z = -0.35;
      if (bones.rLowerArm) bones.rLowerArm.rotation.z = 0.35;
    }
  }
}

const loader = new GLTFLoader();

function showAvatar(gltf, label) {
  if (vrmModel) scene.remove(vrmModel);
  vrmModel = gltf.scene;
  vrmModel.rotation.y = 0;
  bones = findHumanoidBones(vrmModel);
  scene.add(vrmModel);
  status.innerText = label + ' Active • Drag to Rotate';
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
  updateCharacterPose(t);
  if (vrmModel && spin && !isDragging) vrmModel.rotation.y += 0.008;
  renderer.render(scene, camera);
}

setTimeout(() => {
  resizeStage();
  animate();
  status.innerText = 'Fetching Niecee C...';
  fetch('./Niecee%20C.vrm')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.arrayBuffer();
    })
    .then(buf => {
      loader.parse(buf, '', gltf => showAvatar(gltf, 'Niecee C'), err => {
        status.innerText = 'Parse error: ' + err.message;
      });
    })
    .catch(err => {
      status.innerText = 'Load error: ' + err.message;
    });
}, 250);

document.getElementById('file-picker').onchange = e => {
  const file = e.target.files.item(0);
  if (!file) return;
  status.innerText = 'Loading ' + file.name + '...';
  const reader = new FileReader();
  reader.onload = ev => {
    loader.parse(ev.target.result, '', gltf => showAvatar(gltf, file.name));
  };
  reader.readAsArrayBuffer(file);
};
