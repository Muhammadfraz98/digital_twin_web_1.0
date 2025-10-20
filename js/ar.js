import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/webxr/ARButton.js";

let camera, scene, renderer;
let controller, reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let selectedModelUrl = null;

// Preload your models (mapped to mask IDs)
const modelMap = {
  mask1: "../3d/alteRathaus.glb",
  mask2: "../3d/fileman.glb",
  mask3: "../3d/olymp.glb",
  mask4: "../3d/bohnlein.glb",
};

const loader = new GLTFLoader();

init();
animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ["hit-test"] }));

  // Lighting
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // Reticle
  const geometry = new THREE.RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  reticle = new THREE.Mesh(geometry, material);
  reticle.visible = false;
  scene.add(reticle);

  // Controller (for tapping to place)
  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);

  window.addEventListener("resize", onWindowResize);

  // Mask selection logic
  document.querySelectorAll(".mask").forEach((mask) => {
    mask.addEventListener("click", (e) => {
      document.querySelectorAll(".mask").forEach((m) => m.classList.remove("selected"));
      e.target.classList.add("selected");
      selectedModelUrl = modelMap[e.target.id];
    });
  });
}

function onSelect() {
  if (!reticle.visible || !selectedModelUrl) return;

  loader.load(selectedModelUrl, (gltf) => {
    const model = gltf.scene;
    model.scale.set(0.3, 0.3, 0.3);
    model.position.setFromMatrixPosition(reticle.matrix);
    scene.add(model);
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace("viewer").then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((source) => {
          hitTestSource = source;
        });
      });

      session.addEventListener("end", () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}
