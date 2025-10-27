import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/loaders/GLTFLoader.js";

let camera, scene, renderer;
let reticle, controller;
let model = null;
let hitTestSource = null;
let localSpace = null;
let xrSession = null;

const startButton = document.getElementById("startAR");
const overlay = document.getElementById("overlay");

startButton.addEventListener("click", startAR);

async function startAR() {
  if (!navigator.xr) {
    overlay.textContent = "WebXR not supported on this device.";
    return;
  }

  xrSession = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test", "dom-overlay"],
    domOverlay: { root: document.body },
  });

  setupThree();
  renderer.xr.setSession(xrSession);

  const referenceSpace = await xrSession.requestReferenceSpace("local");
  const viewerSpace = await xrSession.requestReferenceSpace("viewer");
  hitTestSource = await xrSession.requestHitTestSource({ space: viewerSpace });

  localSpace = referenceSpace;

  xrSession.addEventListener("select", onSelect);
  renderer.setAnimationLoop(onXRFrame);

  overlay.textContent = "Scan the floor to find a surface...";
  startButton.style.display = "none";
}

function setupThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // Reticle for hit test visualization
  const geometry = new THREE.RingGeometry(0.08, 0.1, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  reticle = new THREE.Mesh(geometry, material);
  reticle.visible = false;
  scene.add(reticle);

  controller = renderer.xr.getController(0);
  scene.add(controller);
}

function onSelect() {
  if (reticle.visible && model) {
    const placed = model.clone();
    placed.position.copy(reticle.position);
    placed.quaternion.copy(reticle.quaternion);
    scene.add(placed);
  }
}

function onXRFrame(timestamp, frame) {
  const session = frame.session;
  const pose = frame.getViewerPose(localSpace);

  if (!pose) return;

  const hitTestResults = frame.getHitTestResults(hitTestSource);

  if (hitTestResults.length > 0) {
    const hit = hitTestResults[0];
    const hitPose = hit.getPose(localSpace);

    reticle.visible = true;
    reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z);
    reticle.updateMatrixWorld(true);

    if (!model) loadModel();
  } else {
    reticle.visible = false;
  }

  renderer.render(scene, camera);
}

function loadModel() {
  const loader = new GLTFLoader();
  loader.load("../3d/alteRathaus.glb", (gltf) => {
    model = gltf.scene;
    overlay.textContent = "Tap to place the model";
  });
}
