import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { prepareAnimation } from './animation.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries(['stage', 'canvas', 'load-status', 'load-title', 'load-detail', 'load-progress', 'retry', 'play', 'play-icon', 'play-label', 'front', 'head', 'compare', 'reference-panel', 'reference', 'reference-error', 'motion-note'].map((id) => [id, $(id)]));
const asset = (name) => `${import.meta.env.BASE_URL}assets/${name}${/\.(glb|png)$/.test(name) ? `?v=${__ASSET_REVISION__}` : ''}`;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const originalCenter = new THREE.Vector3(0.13, 0.27, 0);
const MODES = {
  shrimp: { label: 'Shrimp', name: 'Doro Shrimp', head: 'Doro · 3D head', model: 'doro.glb', note: 'Doro is cute. So are shrimp.' },
  dog: { label: 'Puppy', name: 'Doro Puppy', head: 'Doro · 3D head', model: 'doro-dog.glb', note: 'The same little head, now with four tiny legs.' },
  palico: { label: 'Blue Cat', name: 'Blue Cat', head: 'Kit T head', model: 'palico.glb', note: 'Round face, big ears, standing still for you.', studio: true },
  siamese: { label: 'Cat on All Fours', name: 'Cat on All Fours', head: 'Kit T head', model: 'siamese.glb', note: 'That little face, with four little paws.', studio: true },
};
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-2.8, 2.8, 2.8, -2.8, 0.01, 100);
camera.up.set(0, 1, 0);
camera.position.set(0.13, 0.27, 12);
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xe1ddd6, 2);
scene.add(hemisphereLight);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-3, 5, 8);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0);
fillLight.position.set(4, 3, 5);
const rimLight = new THREE.DirectionalLight(0xffffff, 0);
rimLight.position.set(-1, 5, -4);
scene.add(fillLight, rimLight);

let renderer, controls, model, headNode, animation, dracoLoader;
let playing = !reducedMotion.matches;
let focusingHead = false;
let baseHeight = 5.6;
let fitWidth = 0;
const requestedMode = new URLSearchParams(location.search).get('model');
let selectedMode = Object.hasOwn(MODES, requestedMode) ? requestedMode : 'shrimp';
let viewerSettings = {};
let cameraDistance = 12;
let needsRender = true;
let lastFrame = performance.now();
let loadAbort;
let referenceRequested = false;
let loadGeneration = 0;
let pendingParse = null;
let shrimpReferenceOpen = innerWidth >= 980 && !reducedMotion.matches;

// Read-only diagnostics make export/clip conflicts inspectable during QA.
window.doroViewer = { state: 'loading', mode: selectedMode, animation: null, headFound: false };

ui.reference.addEventListener('error', () => {
  ui.reference.hidden = true;
  ui['reference-error'].hidden = false;
});

function setReference(open) {
  ui['reference-panel'].hidden = !open;
  document.querySelector('.exhibit').classList.toggle('is-comparing', open);
  ui.compare.setAttribute('aria-expanded', String(open));
  ui.compare.querySelector('.compare-mark').textContent = open ? '−' : '＋';
  // No automatic GIF request when the user prefers reduced motion.
  if (open && !referenceRequested) {
    referenceRequested = true;
    ui.reference.src = asset('reference.gif');
  }
}
ui.compare.addEventListener('click', () => {
  shrimpReferenceOpen = ui['reference-panel'].hidden;
  setReference(shrimpReferenceOpen);
});
setReference(selectedMode === 'shrimp' && shrimpReferenceOpen);

function updatePlayButton() {
  ui['play-label'].textContent = playing ? 'Pause' : 'Play';
  ui.play.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
  ui['play-icon'].innerHTML = playing ? '<path d="M5 3v10M11 3v10" />' : '<path d="m5 3 8 5-8 5Z" />';
}
updatePlayButton();
if (reducedMotion.matches) ui['motion-note'].textContent = 'Paused for reduced motion. Press Play whenever you like.';
ui.play.addEventListener('click', () => {
  playing = !playing;
  lastFrame = performance.now();
  updatePlayButton();
  ui['motion-note'].textContent = playing ? MODES[selectedMode].note : 'Paused. Take a look around.';
});
reducedMotion.addEventListener('change', (event) => {
  if (!event.matches) return;
  playing = false;
  updatePlayButton();
  setReference(false);
  ui['motion-note'].textContent = 'Paused for reduced motion. Press Play whenever you like.';
});

function resize() {
  const { width, height } = ui.stage.getBoundingClientRect();
  if (!renderer || width < 1 || height < 1) return;
  const aspect = width / height;
  const halfHeight = Math.max(baseHeight, fitWidth / aspect) / 2;
  camera.left = -halfHeight * aspect;
  camera.right = halfHeight * aspect;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  needsRender = true;
}

function clearOrbitInertia() {
  controls.enableDamping = false;
  controls.update();
  controls.enableDamping = !reducedMotion.matches;
}

function frameSubject(resetDirection = false, useAuthoredDirection = false) {
  if (!model) return;
  model.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(focusingHead ? headNode : model, true);
  if (bounds.isEmpty()) return;
  const configuredCenter = Array.isArray(viewerSettings.center) && viewerSettings.center.length === 3 && viewerSettings.center.every(Number.isFinite)
    ? new THREE.Vector3(...viewerSettings.center) : null;
  const center = focusingHead ? bounds.getCenter(new THREE.Vector3())
    : configuredCenter || (selectedMode === 'shrimp' ? originalCenter.clone() : bounds.getCenter(new THREE.Vector3()));
  const offset = camera.position.clone().sub(controls.target).normalize();
  let direction = offset;
  if (resetDirection || useAuthoredDirection) direction = new THREE.Vector3(0, 0, 1);
  if (resetDirection && selectedMode === 'dog' && headNode) {
    // The dog turns its head toward the viewer; front means the face's front.
    direction.transformDirection(headNode.matrixWorld);
  }
  if (useAuthoredDirection && !resetDirection && Array.isArray(viewerSettings.cameraDirection)
      && viewerSettings.cameraDirection.length === 3 && viewerSettings.cameraDirection.every(Number.isFinite)) {
    const authored = new THREE.Vector3(...viewerSettings.cameraDirection);
    if (authored.lengthSq() > 1e-8) direction = authored.normalize();
  }
  if (focusingHead) {
    // Fit the visible projection of the animated head. A surrounding sphere
    // includes hidden depth and can shrink a close-up on a narrow screen.
    const point = new THREE.Vector3();
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    let halfWidth = 0, halfHeight = 0;
    headNode.traverse((node) => {
      if (!node.isMesh) return;
      const position = node.geometry.getAttribute('position');
      if (!position) return;
      for (let index = 0; index < position.count; index += 1) {
        node.getVertexPosition(index, point).applyMatrix4(node.matrixWorld).sub(center);
        halfWidth = Math.max(halfWidth, Math.abs(point.dot(right)));
        halfHeight = Math.max(halfHeight, Math.abs(point.dot(up)));
      }
    });
    baseHeight = halfHeight * 2 * 1.16;
    fitWidth = halfWidth * 2 * 1.16;
  } else {
    const configuredScale = Number.isFinite(viewerSettings.orthoScale) && viewerSettings.orthoScale > 0 ? viewerSettings.orthoScale : selectedMode === 'shrimp' ? 5.6 : 0;
    // Authored three-quarter views must include body depth in their framing.
    // Project the eight world-space box corners onto this camera's axes.
    const right = new THREE.Vector3(0, 1, 0).cross(direction);
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0); else right.normalize();
    const up = direction.clone().cross(right).normalize();
    let halfWidth = 0, halfHeight = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const corner = new THREE.Vector3(x, y, z).sub(center);
      halfWidth = Math.max(halfWidth, Math.abs(corner.dot(right)));
      halfHeight = Math.max(halfHeight, Math.abs(corner.dot(up)));
    }
    baseHeight = Math.max(configuredScale, 2 * halfHeight * 1.16);
    fitWidth = 2 * halfWidth * 1.16;
  }
  clearOrbitInertia();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, cameraDistance);
  camera.zoom = 1;
  camera.up.set(0, 1, 0);
  controls.update();
  resize();
}
ui.front.addEventListener('click', () => frameSubject(true));
ui.head.addEventListener('click', () => {
  focusingHead = !focusingHead;
  ui.head.textContent = focusingHead ? 'Full view' : 'Head';
  ui.head.setAttribute('aria-pressed', String(focusingHead));
  frameSubject();
});

const catCaption = document.getElementById('cat-caption');
function updateCatCaption() {
  catCaption.hidden = selectedMode !== 'siamese' || !model;
  const text = 'Meow meow, running all around.';
  if (catCaption.textContent !== text) catCaption.textContent = text;
}

function animate(now) {
  const delta = Math.max(0, Math.min((now - lastFrame) / 1000, 0.1));
  lastFrame = now;
  if (document.hidden || !model) return;
  const moved = controls.update();
  if (playing && animation?.actions.length) {
    animation.mixer.update(delta);
    needsRender = true;
  }
  updateCatCaption();
  if (needsRender || moved) {
    renderer.render(scene, camera);
    needsRender = false;
  }
}
document.addEventListener('visibilitychange', () => {
  lastFrame = performance.now();
  if (renderer) renderer.setAnimationLoop(document.hidden ? null : animate);
  needsRender = true;
});

function applyModeLighting() {
  const studio = MODES[selectedMode].studio;
  renderer.toneMapping = studio ? THREE.AgXToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = studio ? 1.5 : 1;
  keyLight.intensity = studio ? 4.5 : 2.2;
  hemisphereLight.intensity = studio ? 1.2 : 2;
  fillLight.intensity = studio ? 1 : 0;
  rimLight.intensity = studio ? 1.3 : 0;
  needsRender = true;
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0xfaf8f4, 0);
  controls = new OrbitControls(camera, ui.canvas);
  controls.target.copy(originalCenter);
  controls.enablePan = false;
  controls.enableDamping = !reducedMotion.matches;
  controls.dampingFactor = 0.09;
  controls.minZoom = 0.45;
  controls.maxZoom = 4;
  controls.minPolarAngle = 0.02;
  controls.maxPolarAngle = Math.PI - 0.02;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.addEventListener('change', () => { needsRender = true; });
  new ResizeObserver(resize).observe(ui.stage);
  ui.canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    showError(new Error('WebGL context lost'));
    ui['load-title'].textContent = 'The viewer paused';
    ui['load-detail'].textContent = 'Reload to keep exploring.';
    ui.retry.onclick = () => location.reload();
  });
  ui.canvas.addEventListener('keydown', (event) => {
    if (!model) return;
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') return frameSubject(true);
    clearOrbitInertia();
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.1;
    if (event.key === 'ArrowRight') spherical.theta += 0.1;
    if (event.key === 'ArrowUp') spherical.phi -= 0.1;
    if (event.key === 'ArrowDown') spherical.phi += 0.1;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.02, Math.PI - 0.02);
    if (['+', '='].includes(event.key)) camera.zoom = Math.min(controls.maxZoom, camera.zoom * 1.15);
    if (['-', '_'].includes(event.key)) camera.zoom = Math.max(controls.minZoom, camera.zoom / 1.15);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    camera.updateProjectionMatrix();
    controls.update();
    needsRender = true;
  });
  resize();
  renderer.setAnimationLoop(animate);
}

function showError(error) {
  window.doroViewer.state = 'error';
  window.doroViewer.error = error.message;
  ui.stage.setAttribute('aria-busy', 'false');
  ui.canvas.hidden = true;
  ui['load-status'].hidden = false;
  ui['load-title'].textContent = 'The 3D model could not load';
  ui['load-detail'].textContent = 'Try again, or come back in a moment.';
  ui['load-progress'].hidden = true;
  ui.retry.hidden = false;
  ui.play.disabled = ui.front.disabled = ui.head.disabled = true;
  console.error('[Doro viewer]', error);
}

async function fetchModel(mode, signal, generation) {
  const response = await fetch(asset(MODES[mode].model), { signal });
  if (!response.ok) throw new Error(`Model request failed: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length'));
  const reader = response.body?.getReader();
  if (!reader) return response.arrayBuffer();
  const chunks = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (generation !== loadGeneration) continue;
    if (total > 0) {
      const fraction = Math.min(received / total, 1);
      ui['load-progress'].value = fraction;
      ui['load-detail'].textContent = `Loading 3D model · ${Math.round(fraction * 100)}%`;
    } else {
      ui['load-detail'].textContent = `Loading 3D model · ${(received / 1048576).toFixed(1)} MB`;
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  // Dev servers may return the HTML shell for a missing GLB; reject that before parsing.
  if (bytes.length < 12 || new DataView(bytes.buffer).getUint32(0, true) !== 0x46546c67) throw new Error('The model response is not a GLB file');
  return bytes.buffer;
}

function disposeScene(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.skeleton) skeletons.add(node.skeleton);
    for (const material of (Array.isArray(node.material) ? node.material : node.material ? [node.material] : [])) materials.add(material);
  });
  for (const material of materials) {
    for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  const images = new Set();
  for (const texture of textures) { if (texture.source?.data) images.add(texture.source.data); texture.dispose(); }
  for (const image of images) if (typeof image.close === 'function') image.close();
  for (const skeleton of skeletons) skeleton.dispose();
}

function releaseModel() {
  animation?.dispose();
  animation = null;
  if (model) { scene.remove(model); disposeScene(model); }
  model = null;
  headNode = null;
  viewerSettings = {};
  focusingHead = false;
  ui.head.textContent = 'Head';
  ui.head.setAttribute('aria-pressed', 'false');
  renderer?.renderLists.dispose();
}

async function loadModel() {
  const mode = selectedMode;
  const generation = ++loadGeneration;
  loadAbort?.abort();
  const controller = new AbortController();
  loadAbort = controller;
  const timeout = setTimeout(() => controller.abort(), 120000);
  releaseModel();
  catCaption.hidden = true;
  ui.canvas.hidden = true;
  ui.play.disabled = ui.front.disabled = ui.head.disabled = true;
  ui.canvas.setAttribute('aria-label', `Interactive 3D model of ${MODES[mode].name}`);
  ui['load-status'].hidden = false;
  window.doroViewer = { state: 'loading', mode, animation: null, headFound: false };
  ui.stage.setAttribute('aria-busy', 'true');
  ui['load-title'].textContent = `Here comes ${MODES[mode].name}…`;
  ui['load-detail'].textContent = 'Loading 3D model';
  ui['load-progress'].hidden = false;
  ui['load-progress'].removeAttribute('value');
  ui.retry.hidden = true;
  try {
    if (!renderer) initRenderer();
    applyModeLighting();
    updatePlayButton();
    const bytes = await fetchModel(mode, controller.signal, generation);
    // A fetch can be aborted; an in-progress Draco parse cannot. Serialize
    // decodes, dispose any obsolete result, and never display both models.
    if (pendingParse) await pendingParse.catch(() => {});
    if (generation !== loadGeneration) return;
    if (controller.signal.aborted) throw new Error('Model load timed out');
    ui['load-detail'].textContent = 'Almost there…';
    const loader = new GLTFLoader();
    // Both compressed and ordinary GLBs work. Decoder files match the pinned
    // Three.js package and are served from this site, including Pages subpaths.
    if (!dracoLoader) {
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath(new URL(asset('draco/'), location.href).href);
      dracoLoader.setWorkerLimit(2);
    }
    loader.setDRACOLoader(dracoLoader);
    // parseAsync uses the same-origin asset folder for any external resource.
    const parse = loader.parseAsync(bytes, new URL(asset(''), location.href).href);
    pendingParse = parse;
    let gltf;
    try { gltf = await parse; } finally { if (pendingParse === parse) pendingParse = null; }
    if (generation !== loadGeneration || controller.signal.aborted) {
      disposeScene(gltf.scene);
      if (generation === loadGeneration) throw new Error('Model load timed out');
      return;
    }
    let prepared;
    try { prepared = prepareAnimation(gltf.scene, gltf.animations); }
    catch (error) { disposeScene(gltf.scene); throw error; }
    model = gltf.scene;
    animation = prepared;
    viewerSettings = model.userData.viewer || {};
    const radius = new THREE.Box3().setFromObject(model, true).getBoundingSphere(new THREE.Sphere()).radius;
    cameraDistance = Number.isFinite(viewerSettings.cameraDistance) && viewerSettings.cameraDistance > radius ? viewerSettings.cameraDistance : Math.max(12, radius * 4);
    camera.far = Math.max(100, cameraDistance + radius * 8);
    model.traverse((node) => {
      if (node.userData.name === MODES[mode].head || node.name === MODES[mode].head
          || node.name === THREE.PropertyBinding.sanitizeNodeName(MODES[mode].head)
          || (MODES[mode].head === 'Doro · 3D head' && /doro.*3d[_\s·.-]*head/i.test(node.name))) headNode = node;
    });
    scene.add(model);
    frameSubject(false, true);
    ui.canvas.hidden = false;
    ui['load-status'].hidden = true;
    ui.stage.setAttribute('aria-busy', 'false');
    ui.play.disabled = !animation.actions.length;
    ui.front.disabled = false;
    ui.head.disabled = !headNode;
    if (!headNode) console.warn('[Doro viewer] Head node not found; head focus disabled.');
    window.doroViewer = {
      state: 'ready', mode, animation: animation.diagnostics, headFound: Boolean(headNode),
      inspect: () => ({ playing, time: animation?.mixer.time, focusingHead, cameraPosition: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }),
    };
    needsRender = true;
    lastFrame = performance.now();
  } catch (error) {
    if (generation === loadGeneration) showError(error);
  } finally {
    clearTimeout(timeout);
  }
}
ui.retry.addEventListener('click', loadModel);
function syncSelectedMode() {
  for (const option of document.querySelectorAll('[data-mode]')) {
    option.setAttribute('aria-pressed', String(option.dataset.mode === selectedMode));
  }
  ui.compare.hidden = selectedMode !== 'shrimp';
  setReference(selectedMode === 'shrimp' && shrimpReferenceOpen);
  ui['motion-note'].textContent = playing ? MODES[selectedMode].note : reducedMotion.matches ? 'Paused for reduced motion. Press Play whenever you like.' : 'Paused. Take a look around.';
}
for (const button of document.querySelectorAll('[data-mode]')) {
  button.addEventListener('click', () => {
    if (button.dataset.mode === selectedMode) return;
    selectedMode = button.dataset.mode;
    const url = new URL(location.href);
    url.searchParams.set('model', selectedMode);
    history.replaceState(history.state, '', url);
    syncSelectedMode();
    loadModel();
  });
}
syncSelectedMode();
loadModel();
