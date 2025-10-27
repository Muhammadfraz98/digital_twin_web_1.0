import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "../lib/ARButton.js";

export class ARExperience {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    document.body.appendChild(this.renderer.domElement);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.5);
    this.scene.add(light);

    // Reticle for hit test
    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.12, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x00ff99 })
    );
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // Loader for 3D models
    this.loader = new GLTFLoader();

    // Hit test
    this.hitTestSource = null;
    this.hitTestSourceRequested = false;

    // Model placeholder
    this.model = null;

    // Controller
    this.controller = this.renderer.xr.getController(0);
    this.controller.addEventListener("select", this.onSelect.bind(this));
    this.scene.add(this.controller);

    window.addEventListener("resize", this.onWindowResize.bind(this));
  }

  start() {
    const message = document.getElementById("message");
    message.textContent = "Move your device to scan the floor...";

    document.body.appendChild(
      ARButton.createButton(this.renderer, {
        requiredFeatures: ["hit-test"],
      })
    );

    this.renderer.setAnimationLoop(this.render.bind(this));
  }

  onSelect() {
    if (!this.reticle.visible) return;

    if (this.model) {
      const clone = this.model.clone();
      clone.position.setFromMatrixPosition(this.reticle.matrix);
      this.scene.add(clone);
    } else {
      this.loader.load(
        "../3d/alteRathaus.glb",
        (gltf) => {
          this.model = gltf.scene;
          this.model.scale.set(0.2, 0.2, 0.2);
          this.model.position.setFromMatrixPosition(this.reticle.matrix);
          this.scene.add(this.model);
          document.getElementById("message").textContent = "Model placed!";
        },
        undefined,
        (err) => {
          console.error("Error loading model:", err);
        }
      );
    }
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render(timestamp, frame) {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    if (!this.hitTestSourceRequested) {
      session.requestReferenceSpace("viewer").then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((source) => {
          this.hitTestSource = source;
        });
      });

      session.addEventListener("end", () => {
        this.hitTestSourceRequested = false;
        this.hitTestSource = null;
      });

      this.hitTestSourceRequested = true;
    }

    if (frame && this.hitTestSource) {
      const referenceSpace = this.renderer.xr.getReferenceSpace();
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);

      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);

        this.reticle.visible = true;
        this.reticle.matrix.fromArray(pose.transform.matrix);

        const msg = document.getElementById("message");
        if (msg.textContent.includes("Move your device")) {
          msg.textContent = "Surface found! Tap to place the model.";
        }
      } else {
        this.reticle.visible = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
