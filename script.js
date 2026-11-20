import * as THREE from "https://esm.sh/three";
import { GLTFLoader } from "https://esm.sh//three/examples/jsm/loaders/GLTFLoader.js";

const status = document.getElementById('status');
const box = document.getElementById('stage-box');
const canvas = document.getElementById('stage-canvas');
let vrmModel = null, spin = true, isDragging = false, prevX = 0;

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

const loader = new GLTFLoader();

function showAvatar(gltf, label) {
  if (vrmModel) scene.remove(vrmModel);
  vrmModel = gltf.scene;
  vrmModel.rotation.y = 0;
  scene.add(vrmModel);
  status.innerText = label + ' Active • Drag to Rotate';
}

status.innerText = 'Loading Niecee C...';
fetch('./niecee.vrm')
  .then(res => {
    if (!res.ok) throw new Error('File status ' + res.status);
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

});

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
  if (vrmModel && spin && !isDragging) vrmModel.rotation.y += 0.008;
  renderer.render(scene, camera);
}

setTimeout(() => {
  resizeStage();
  animate();
}, 250);
