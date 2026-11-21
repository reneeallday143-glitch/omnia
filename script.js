const stageWrap = document.getElementById('stage-wrap');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, stageWrap.clientWidth / stageWrap.clientHeight, 0.05, 30);
camera.position.set(0, 1.32, 1.85);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(stageWrap.clientWidth, stageWrap.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.id = 'stage-canvas';
stageWrap.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.25, 0);
controls.update();

const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(1, 2, 2);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.85));

// Floor Grid
const grid = new THREE.GridHelper(6, 24, 0x2dd4bf, 0x134e4a);
scene.add(grid);

let currentVrm = null;
let currentHand = 'relaxed';
let currentExpr = 'neutral';
let currentStance = 'none';
let isPaused = false;
let modelFlipped = false;
let crownGroup = null;
let crownVisible = true;
const clock = new THREE.Clock();
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Little'];
const targetRot = {};

function setTarget(boneName, x, y, z) {
  targetRot[boneName] = { x, y, z };
}

// 3D Particles / Atmospheres
const particleCount = 110;
const particleGroup = new THREE.Group();
const particleMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.7 });
const particles = [];
for (let i = 0; i < particleCount; i++) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.08 + Math.random() * 0.08), particleMat);
  m.position.set((Math.random() - 0.5) * 3.8, Math.random() * 2.8, (Math.random() - 0.5) * 2.6);
  particleGroup.add(m);
  particles.push({ mesh: m, speed: 0.4 + Math.random() * 0.6, drift: (Math.random() - 0.5) * 0.3 });
}
scene.add(particleGroup);

// Custom 3D Crown
function attachCrown(vrm) {
  if (crownGroup && crownGroup.parent) crownGroup.parent.remove(crownGroup);
  crownGroup = new THREE.Group();
  
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xffc83b, metalness: 0.92, roughness: 0.18 });
  const darkGoldMat = new THREE.MeshStandardMaterial({ color: 0xb88214, metalness: 0.88, roughness: 0.28 });
  const gemColors = [0xff1744, 0x00e5ff, 0x2979ff, 0xff1744, 0x00e5ff, 0x2979ff, 0xff1744, 0x2979ff];

  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.108, 0.102, 0.026, 32, 1, true), goldMat);
  band.material.side = THREE.DoubleSide;
  crownGroup.add(band);

  const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.0035, 10, 36), darkGoldMat);
  rimTop.rotation.x = Math.PI / 2;
  rimTop.position.y = 0.013;
  crownGroup.add(rimTop);

  const rimBot = rimTop.clone();
  rimBot.position.y = -0.013;
  crownGroup.add(rimBot);

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const isFront = i === 0;
    const isMain = i % 2 === 0;
    const h = isFront ? 0.068 : (isMain ? 0.050 : 0.034);

    const spireHolder = new THREE.Group();
    spireHolder.rotation.y = angle;

    const spire = new THREE.Mesh(new THREE.ConeGeometry(isFront ? 0.018 : 0.013, h, 4), goldMat);
    spire.position.set(0, 0.013 + h / 2, 0.106);
    spire.rotation.x = -0.14;
    spireHolder.add(spire);

    const finial = new THREE.Mesh(
      new THREE.OctahedronGeometry(isFront ? 0.0085 : 0.0055, 0),
      new THREE.MeshStandardMaterial({ color: gemColors[i], emissive: gemColors[i], emissiveIntensity: 0.45, roughness: 0.1 })
    );
    finial.position.set(0, 0.013 + h + 0.010, 0.114);
    spireHolder.add(finial);

    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(isFront ? 0.010 : 0.0065, 1),
      new THREE.MeshStandardMaterial({ color: gemColors[i], emissive: gemColors[i], emissiveIntensity: 0.35, roughness: 0.15 })
    );
    gem.scale.set(1, 1, 0.55);
    gem.position.set(0, 0, 0.109);
    spireHolder.add(gem);

    crownGroup.add(spireHolder);
  }

  const headBone = vrm.humanoid.getNormalizedBoneNode('Head');
  if (headBone) {
    crownGroup.position.set(0, 0.145, -0.01);
    crownGroup.rotation.x = -0.12;
    crownGroup.visible = crownVisible;
    headBone.add(crownGroup);
  }
}

// Browser Cache (IndexedDB) to remember your VRM file
function openVrmDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('OmniaVrmCache', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('models');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveVrmToBrowser(blob, name) {
  try {
    const db = await openVrmDB();
    const tx = db.transaction('models', 'readwrite');
    tx.objectStore('models').put({ blob, name }, 'lastModel');
  } catch (e) {}
}

async function loadSavedVrmFromBrowser() {
  try {
    const db = await openVrmDB();
    const tx = db.transaction('models', 'readonly');
    const req = tx.objectStore('models').get('lastModel');
    req.onsuccess = () => {
      if (req.result && req.result.blob) {
        loadVrmFromUrl(URL.createObjectURL(req.result.blob), req.result.name);
      }
    };
  } catch (e) {}
}

function loadVrmFromUrl(url, labelName = 'Model.vrm') {
  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  document.getElementById('status').textContent = `Loading ${labelName}...`;
  
  loader.load(url, (gltf) => {
    if (currentVrm && currentVrm.scene) scene.remove(currentVrm.scene);
    const vrm = gltf.userData.vrm;
    if (!vrm) {
      document.getElementById('status').textContent = 'Error: Invalid VRM file';
      return;
    }
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    vrm.scene.rotation.y = modelFlipped ? 0 : Math.PI;
    scene.add(vrm.scene);
    currentVrm = vrm;
    attachCrown(vrm);
    document.getElementById('status').textContent = `Loaded: ${labelName}`;
  }, undefined, (err) => {
    console.error(err);
    document.getElementById('status').textContent = `Error: ${err.message}`;
  });
}

function handleFile(file) {
  if (!file) return;
  saveVrmToBrowser(file, file.name);
  loadVrmFromUrl(URL.createObjectURL(file), file.name);
}

document.getElementById('vrm-file').addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
});

stageWrap.addEventListener('dragover', (e) => e.preventDefault());
stageWrap.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFile(e.dataTransfer.files[0]);
  }
});

loadSavedVrmFromBrowser();

function activateBtn(btn) {
  if (!btn) return;
  btn.parentElement.querySelectorAll('.pose-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

window.setHand = (gesture, btn) => {
  currentHand = gesture;
  document.querySelectorAll('#hand-grid .pose-btn, #attitude-grid .pose-btn, #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
};

window.setExpr = (expr, btn) => { currentExpr = expr; activateBtn(btn); };

window.setStance = (stance, btn) => {
  currentStance = stance;
  document.querySelectorAll('#stance-grid .pose-btn:not(#crown-toggle), #action-grid .pose-btn').forEach(b => b.classList.remove('active'));
