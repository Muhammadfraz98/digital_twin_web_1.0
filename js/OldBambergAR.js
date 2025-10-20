// js/OldBambergAR.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/webxr/ARButton.js";

export class OldBambergAR {
  constructor({ arContainerId, buttonContainerId, statusId, modelMap }) {
    this.arContainer = document.getElementById(arContainerId);
    this.buttonContainer = document.getElementById(buttonContainerId);
    this.statusMessage = document.getElementById(statusId);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controller = null;
    this.reticle = null;
    this.hitTestSource = null;
    this.localSpace = null;
    this.loader = new GLTFLoader();
    this.selectedModelUrl = null;
    this.modelMap = modelMap; // { mask1: url, mask2: url, ... }

    this.init();
  }

  init() {
    // Scene and Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.arContainer.appendChild(this.renderer.domElement);

    // AR Button
    const arButton = ARButton.createButton(this.renderer, { requiredFeatures: ["hit-test"] });
    this.buttonContainer.appendChild(arButton);

    // Lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    this.scene.add(light);

    // Reticle
    const geometry = new THREE.RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.reticle = new THREE.Mesh(geometry, material);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // Controller
    this.controller = this.renderer.xr.getController(0);
    this.controller.addEventListener("select", () => this.placeModel());
    this.scene.add(this.controller);

    // XR session events
    this.renderer.xr.addEventListener("sessionstart", () => this.onSessionStart());
    this.renderer.xr.addEventListener("sessionend", () => this.onSessionEnd());

    window.addEventListener("resize", () => this.onWindowResize());

    this.animate();
  }

  async onSessionStart() {
    const session = this.renderer.xr.getSession();
    const viewerSpace = await session.requestReferenceSpace("viewer");
    this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    this.localSpace = await session.requestReferenceSpace("local");
    this.statusMessage.textContent = "AR ready. Look for a flat surface!";
  }

  onSessionEnd() {
    this.hitTestSource = null;
    this.reticle.visible = false;
    this.statusMessage.textContent = "AR session ended.";
  }

  selectModel(modelKey) {
    this.selectedModelUrl = this.modelMap[modelKey];
    this.statusMessage.textContent = `Selected model: ${modelKey}`;
  }

  placeModel() {
    if (!this.reticle.visible || !this.selectedModelUrl) return;

    this.loader.load(this.selectedModelUrl, (gltf) => {
      const model = gltf.scene;
      model.scale.set(0.1, 0.1, 0.1);
      model.position.setFromMatrixPosition(this.reticle.matrix);
      model.quaternion.setFromRotationMatrix(this.reticle.matrix);
      this.scene.add(model);
    }, undefined, console.error);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    this.renderer.setAnimationLoop((timestamp, frame) => this.render(timestamp, frame));
  }

  render(timestamp, frame) {
    if (frame && this.hitTestSource && this.localSpace) {
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(this.localSpace);
        this.reticle.visible = true;
        this.reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        this.reticle.visible = false;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
