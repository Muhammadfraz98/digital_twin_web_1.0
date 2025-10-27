import * as THREE from './lib/three.module.js';
import { ARButton } from './lib/ARButton.js';
import { GLTFLoader } from './lib/GLTFLoader.js';

let scene, camera, renderer, reticle, controller;
let hitTestSource = null;
let hitTestSourceRequested = false;

// default model
let selectedModelUrl = '../3d/alteRathaus.glb';

init();
animate();

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    document.getElementById('ar-container').appendChild(renderer.domElement);

    // Scene & Camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.01, 20);

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    scene.add(light);

    // Reticle
    const geometry = new THREE.RingGeometry(0.05, 0.06, 32).rotateX(-Math.PI/2);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    reticle = new THREE.Mesh(geometry, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Controller
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // ARButton
    document.getElementById('ar-container').appendChild(
        ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
    );

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onSelect() {
    if (reticle.visible) {
        const loader = new GLTFLoader();
        loader.load(selectedModelUrl, gltf => {
            const model = gltf.scene;
            model.scale.set(0.1, 0.1, 0.1);
            model.position.setFromMatrixPosition(reticle.matrix);
            model.quaternion.setFromRotationMatrix(reticle.matrix);
            scene.add(model);
            document.getElementById('message').textContent = 'Model placed!';
        });
    }
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then(refSpace => {
                session.requestHitTestSource({ space: refSpace }).then(source => {
                    hitTestSource = source;
                });
            });
            session.addEventListener('end', () => {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });
            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace);
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);
                document.getElementById('message').textContent = 'Surface detected! Tap to place model.';
            } else {
                reticle.visible = false;
                document.getElementById('message').textContent = 'Scanning for surface...';
            }
        }
    }

    renderer.render(scene, camera);
}

document.getElementById('startAR').addEventListener('click', () => {
    document.getElementById('startAR').style.display = 'none';
    init();
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));
    animate();
});