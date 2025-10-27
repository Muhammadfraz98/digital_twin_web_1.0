// js/OldBambergAR.js
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/webxr/ARButton.js";

/**
 * Minimal Bouncer class: position, velocity, mesh + simple bounce on ground (y=0).
 * Replace with your Bouncer from OIO if you have a richer implementation.
 */
class Bouncer {
  constructor(mesh, initialPos = new THREE.Vector3(), initialY = 0) {
    this.mesh = mesh;
    this.mesh.position.copy(initialPos);
    this.velocity = new THREE.Vector3((Math.random()-0.5)*0.02, 0.02 + Math.random()*0.02, (Math.random()-0.5)*0.02);
    this.floorY = initialY;
  }
  applyGravity(g) { this.velocity.add(g); }
  update() {
    this.mesh.position.add(this.velocity);
    // simple ground collision
    if (this.mesh.position.y <= this.floorY) {
      this.mesh.position.y = this.floorY;
      this.velocity.y *= -0.45; // lose energy
      // small damping
      this.velocity.x *= 0.98;
      this.velocity.z *= 0.98;
    }
    // slow down over time
    this.velocity.multiplyScalar(0.999);
  }
}

/**
 * OldBambergAR class - encapsulates scene, hit-test, spawning bouncers, reticle/pointer.
 */
export class OldBambergAR {
  constructor(opts = {}) {
    this.container = document.getElementById(opts.arContainerId || "ar-view");
    this.buttonContainer = opts.buttonContainer || document.body;
    this.statusEl = document.getElementById(opts.statusId || "status");
    this.modelMap = opts.modelMap || {
      mask1: "media/models/alteRathaus.glb",
      mask2: "media/models/fileman.glb",
      mask3: "media/models/olymp.glb",
      mask4: "media/models/bohnlein.glb"
    };
    this.selectedKey = Object.keys(this.modelMap)[0];
    this.loader = new GLTFLoader();

    // three.js essentials
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // XR hit-test state
    this.hitTestSource = null;
    this.hitTestSourceRequested = false;
    this.localReferenceSpace = null;

    // Reticle & pointer
    this.reticle = null;
    this.pointer = null;

    // Spawns / physics
    this.bouncers = [];
    this.gravity = new THREE.Vector3(0, -0.01, 0);

    // internal flags
    this.isStarted = false;

    this._init();
  }

  _setStatus(txt) { if (this.statusEl) this.statusEl.textContent = "Status: " + txt; }

  _init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.container.appendChild(this.renderer.domElement);

    // AR button
    const arBtn = ARButton.createButton(this.renderer, { requiredFeatures: ["hit-test"], optionalFeatures: ["dom-overlay"], domOverlay: { root: document.body } });
    this.buttonContainer.appendChild(arBtn);

    // Lighting
    const hemi = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.2);
    hemi.position.set(0.5,1,0.25);
    this.scene.add(hemi);

    // Reticle (ring)
    const ringGeom = new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI/2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, side: THREE.DoubleSide, transparent:true, opacity:0.9 });
    this.reticle = new THREE.Mesh(ringGeom, ringMat);
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    // Pointer (visual vertical indicator)
    const ptrGeom = new THREE.SphereGeometry(0.02, 8, 8);
    const ptrMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    this.pointer = new THREE.Mesh(ptrGeom, ptrMat);
    this.pointer.visible = false;
    this.scene.add(this.pointer);

    // Controller (select tap)
    this.controller = this.renderer.xr.getController(0);
    this.controller.addEventListener('select', () => this._onSelect());
    this.scene.add(this.controller);

    // XR session events
    this.renderer.xr.addEventListener('sessionstart', (ev) => this._onSessionStart(ev));
    this.renderer.xr.addEventListener('sessionend', () => this._onSessionEnd());

    window.addEventListener('resize', () => this._onWindowResize());
    this._setStatus("Ready");
    this._animate();
  }

  // called when session starts
  async _onSessionStart(ev) {
    this._setStatus("Session starting...");
    const session = this.renderer.xr.getSession();
    // request reference spaces
    this.localReferenceSpace = await session.requestReferenceSpace('local');
    // request viewer and then hit-test source
    const viewerSpace = await session.requestReferenceSpace('viewer');
    this.hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

    session.addEventListener('end', () => {
      if (this.hitTestSource) {
        try { this.hitTestSource.cancel(); } catch(e) {}
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
      }
    });

    this.hitTestSourceRequested = true;
    this._setStatus("Looking for surfaces...");
    this.isStarted = true;
  }

  _onSessionEnd() {
    this._setStatus("Session ended");
    this.reticle.visible = false;
    this.pointer.visible = false;
    this.isStarted = false;
  }

  _onWindowResize() {
    this.camera.aspect = window.innerWidth/window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // spawn a simple ball-like object at reticle position
  async _spawnBouncerFromReticle() {
    if (!this.reticle.visible) { this._setStatus("No surface to spawn on"); return; }
    const modelUrl = this.modelMap[this.selectedKey] || null;

    // simple fallback sphere if no model present
    if (!modelUrl) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffaa00 }));
      const pos = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
      // floorY = camera height - small offset
      const camY = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld).y;
      const b = new Bouncer(mesh, pos, camY - 0.8);
      this.scene.add(mesh);
      this.bouncers.push(b);
      this._setStatus("Spawned fallback ball");
      return;
    }

    // if model exists, load glb and spawn its scene root
    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(modelUrl, resolve, null, reject);
      });
      const model = gltf.scene.clone(true);
      model.scale.setScalar(0.08);
      const pos = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
      model.position.copy(pos);
      // place slightly above reticle so gravity shows effect
      model.position.y += 0.05;
      const camY = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld).y;
      const b = new Bouncer(model, pos, camY - 0.8);
      this.scene.add(model);
      this.bouncers.push(b);
      this._setStatus("Spawned model: " + this.selectedKey);
    } catch (err) {
      console.warn("Model load failed:", err);
      this._setStatus("Model load failed, spawning fallback");
      // fallback
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.08), new THREE.MeshStandardMaterial({ color:0xcc66ff }));
      const pos = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
      const camY = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld).y;
      const b = new Bouncer(mesh, pos, camY - 0.8);
      this.scene.add(mesh);
      this.bouncers.push(b);
    }
  }

  // public: select a model key
  selectModel(key) {
    if (this.modelMap[key]) this.selectedKey = key;
    this._setStatus("Selected: " + key);
  }

  // undo last
  undoLast() {
    const last = this.bouncers.pop();
    if (last) {
      try { this.scene.remove(last.mesh); this._setStatus("Removed one object"); } catch(e) {}
    } else {
      this._setStatus("No objects to remove");
    }
  }

  // nuke scene (bomb)
  bomb() {
    while (this.bouncers.length) {
      const b = this.bouncers.pop();
      try { this.scene.remove(b.mesh); } catch(e) {}
    }
    this._setStatus("Cleared objects");
  }

  // on user tap (select)
  _onSelect() {
    // if reticle visible -> spawn
    if (this.reticle.visible) {
      this._spawnBouncerFromReticle();
    } else {
      this._setStatus("No surface detected yet");
    }
  }

  // animation loop
  _animate() {
    this.renderer.setAnimationLoop((t, frame) => this._render(t, frame));
  }

  // render + hit-test handling + physics update
  _render(timestamp, frame) {
    if (frame) {
      if (this.hitTestSource) {
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          const pose = hit.getPose(this.localReferenceSpace);
          if (pose) {
            this.reticle.visible = true;
            this.reticle.matrix.fromArray(pose.transform.matrix);

            const retPos = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
            // pointer at reticle x/z but camera y so it looks like vertical pointer to user
            const camY = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld).y;
            this.pointer.visible = true;
            this.pointer.position.set(retPos.x, camY - 0.2, retPos.z);
          }
        } else {
          this.reticle.visible = false;
          this.pointer.visible = false;
        }
      }
    }

    // update bouncers physics
    for (let i = 0; i < this.bouncers.length; ++i) {
      this.bouncers[i].applyGravity(this.gravity);
      this.bouncers[i].update();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
