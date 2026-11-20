import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh/three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status');
const box = document.getElementById('stage-box');
const canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = true, isDragging = false, prevX = 0;
let bones = {}, currentPose = 'zerog', clock = new THREE.Clock();

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

// Signature Omnia 3D Stage FX Group
const fxGroup = new THREE.Group();
scene.add(fxGroup);

const auraRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.55, 0.015, 16, 64),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
);
auraRing.rotation.x = Math.PI / 2;

const holoScreen = new THREE.Mesh(
  new THREE.PlaneGeometry(0.55, 0.35),
  new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
);

const crownRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.16, 0.018, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xfbbf24 })
);
crownRing.rotation.x = Math.PI / 2;

const orbs = [];
for (let i = 0; i < 3; i++) {
  const orb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055),
    new THREE.MeshBasicMaterial({ color: i === 1 ? 0xff5ca8 : 0x7c5cff })
  );
  orbs.push(orb);
  fxGroup.add(orb);
}
fxGroup.add(auraRing, holoScreen, crownRing);

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
    const isL = n.includes('left') || n.includes('_l_') || n.startsWith('l_');
    const isR = n.includes('right') || n.includes('_r_') || n.startsWith('r_');
    if (isL && n.includes('upperarm')) found.lUpperArm = obj;
    if (isR && n.includes('upperarm')) found.rUpperArm = obj;
    if (isL && n.includes('lowerarm')) found.lLowerArm = obj;
    if (isR && n.includes('lowerarm')) found.rLowerArm = obj;
    if (isL && n.includes('upperleg')) found.lUpperLeg = obj;
    if (isR && n.includes('upperleg')) found.rUpperLeg = obj;
    if (isL && n.includes('lowerleg')) found.lLowerLeg = obj;
    if (isR && n.includes('lowerleg')) found.rLowerLeg = obj;
    if (n.includes('hips')) found.hips = obj;
    if (n.includes('spine') || n.includes('chest')) found.spine = obj;
    if (n.includes('head') && !n.includes('top') && !n.includes('end')) found.head = obj;
  });
  return found;
}

function resetStage() {
  Object.values(bones).forEach(b => { if (b) b.rotation.set(0, 0, 0); });
  if (vrmModel) {
    vrmModel.position.set(0, 0, 0);
    vrmModel.rotation.x = 0;
    vrmModel.rotation.z = 0;
  }
  auraRing.visible = false;
  holoScreen.visible = false;
  crownRing.visible = false;
  orbs.forEach(o => o.visible = false);
}

function updateCharacterPose(t) {
  if (!vrmModel || !bones.lUpperArm) return;
  resetStage();
  const hover = Math.sin(t * 2.5);

  if (currentPose === 'zerog') {
    vrmModel.position.y = 0.22 + hover * 0.05;
    vrmModel.rotation.x = 0.08;
    bones.lUpperArm.rotation.z = 0.95 + hover * 0.08;
    bones.rUpperArm.rotation.z = -0.95 - hover * 0.08;
    if (bones.lLowerArm) bones.lLowerArm.rotation.z = 0.35;
    if (bones.rLowerArm) bones.rLowerArm.rotation.z = -0.35;
    if (bones.lUpperLeg) bones.lUpperLeg.rotation.x = -0.25;
    if (bones.lLowerLeg) bones.lLowerLeg.rotation.x = 0.55;
    if (bones.rUpperLeg) bones.rUpperLeg.rotation.x = -0.1;
    if (bones.head) bones.head.rotation.x = -0.1;
    auraRing.visible = true;
    auraRing.position.set(0, 0.08 + hover * 0.03, 0);
    auraRing.scale.setScalar(1 + hover * 0.06);

  } else if (currentPose === 'holo') {
    bones.lUpperArm.rotation.z = 0.8;
    if (bones.lLowerArm) bones.lLowerArm.rotation.z = 1.3;
    bones.rUpperArm.rotation.z = -0.55;
    bones.rUpperArm.rotation.x = -0.85;
    if (bones.rLowerArm) bones.rLowerArm.rotation.x = -0.6 + Math.sin(t * 4) * 0.15;
    if (bones.spine) bones.spine.rotation.x = 0.08;
    holoScreen.visible = true;
    holoScreen.position.set(0.28, 1.18 + hover * 0.02, 0.45);
    holoScreen.rotation.y = -0.35;

  } else if (currentPose === 'arcade') {
    const hop = Math.abs(Math.sin(t * 4.5));
    vrmModel.position.y = hop * 0.16;
    bones.lUpperArm.rotation.z = 1.1;
    bones.rUpperArm.rotation.z = 0.45;
    if (bones.rLowerArm) bones.rLowerArm.rotation.z = 0.25;
    if (bones.lLowerLeg) bones.lLowerLeg.rotation.x = hop * 0.6;
    auraRing.visible = true;
    auraRing.position.set(0, 0.04, 0);
    auraRing.scale.setScalar(0.8 + hop * 0.5);

  } else if (currentPose === 'domain') {
    bones.lUpperArm.rotation.z = 0.65;
    bones.rUpperArm.rotation.z = -0.65;
    bones.lUpperArm.rotation.x = -0.75;
    bones.rUpperArm.rotation.x = -0.75;
    if (bones.lLowerArm) { bones.lLowerArm.rotation.x = -1.45; bones.lLowerArm.rotation.y = -0.5; }
    if (bones.rLowerArm) { bones.rLowerArm.rotation.x = -1.45; bones.rLowerArm.rotation.y = 0.5; }
    orbs.forEach((orb, idx) => {
      orb.visible = true;
      const angle = t * 2.5 + (idx * Math.PI * 2) / 3;
      orb.position.set(Math.cos(angle) * 0.55, 1.1 + Math.sin(t * 3 + idx) * 0.08, Math.sin(angle) * 0.55);
      orb.rotation.y = t * 3;
    });

  } else if (currentPose === 'cyberdash') {
    vrmModel.position.y = -0.26;
    if (bones.spine) bones.spine.rotation.x = 0.35;
    if (bones.head) bones.head.rotation.x = -0.28;
    bones.rUpperArm.rotation.z = -0.35;
    bones.rUpperArm.rotation.x = -0.65;
    bones.lUpperArm.rotation.z = 0.55;
    bones.lUpperArm.rotation.x = 0.65;
    if (bones.lUpperLeg) { bones.lUpperLeg.rotation.x = -0.85; bones.lUpperLeg.rotation.z = 0.25; }
    if (bones.lLowerLeg) bones.lLowerLeg.rotation.x = 1.45;
    if (bones.rUpperLeg) bones.rUpperLeg.rotation.x = 0.55;
    if (bones.rLowerLeg) bones.rLowerLeg.rotation.x = 0.95;
    auraRing.visible = true;
    auraRing.position.set(0, 0.02, 0);
    auraRing.scale.setScalar(1.35);

  } else if (currentPose === 'djmix') {
    const beat = Math.sin(t * 7);
    if (bones.head) { bones.head.rotation.x = beat * 0.14; bones.head.rotation.z = -0.15; }
    bones.lUpperArm.rotation.z = 0.35;
    if (bones.lLowerArm) bones.lLowerArm.rotation.z = 2.1;
    bones.rUpperArm.rotation.z = -0.75;
    bones.rUpperArm.rotation.x = -0.65;
    if (bones.rLowerArm) bones.rLowerArm.rotation.x = -0.9 + beat * 0.25;
    holoScreen.visible = true;
    holoScreen.position.set(0.18, 0.92, 0.38);
    holoScreen.rotation.x = Math.PI / 2.3;

  } else if (currentPose === 'stargaze') {
    vrmModel.position.y = 0.34 + hover * 0.04;
    vrmModel.rotation.x = -0.42;
    bones.lUpperArm.rotation.z = 0.25;
    bones.rUpperArm.rotation.z = -0.25;
    if (bones.lLowerArm) bones.lLowerArm.rotation.z = 2.2;
    if (bones.rLowerArm) bones.rLowerArm.rotation.z = -2.2;
    if (bones.lUpperLeg) bones.lUpperLeg.rotation.x = -0.45;
    if (bones.lLowerLeg) bones.lLowerLeg.rotation.x = 0.85;
    orbs.forEach((orb, idx) => {
      orb.visible = true;
      orb.position.set((idx - 1) * 0.45, 1.45 + Math.sin(t * 2 + idx) * 0.1, -0.2);
    });

  } else if (currentPose === 'crown') {
    bones.lUpperArm.rotation.z = 0.55;
    bones.rUpperArm.rotation.z = -0.55;
    if (bones.lLowerArm) bones.lLowerArm.rotation.z = 0.25;
    if (bones.rLowerArm) bones.rLowerArm.rotation.z = -0.25;
    if (bones.head) bones.head.rotation.x = -0.12;
    crownRing.visible = true;
    crownRing.position.set(0, 1.72 + hover * 0.03, 0);
    crownRing.rotation.z = t * 2;
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
