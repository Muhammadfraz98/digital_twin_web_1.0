import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function startAR() {
    let camera, scene, renderer, controller, reticle, model;
    let hitTestSource = null, hitTestSourceRequested = false;

    init();
    animate();

    function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true;
        document.body.appendChild(renderer.domElement);
        document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

        reticle = new THREE.Mesh(
            new THREE.RingGeometry(0.1, 0.15, 32).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        reticle.visible = false;
        scene.add(reticle);

        controller = renderer.xr.getController(0);
        controller.addEventListener('select', onSelect);
        scene.add(controller);

        const loader = new GLTFLoader();
        loader.load('your_model.glb', gltf => {
            model = gltf.scene;
            model.scale.set(0.5, 0.5, 0.5);
        });

        const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
        light.position.set(0.5, 1, 0.25);
        scene.add(light);
    }

    function onSelect() {
        if (reticle.visible && model) {
            const clone = model.clone();
            clone.position.setFromMatrixPosition(reticle.matrix);
            scene.add(clone);
        }
    }

    function animate() { renderer.setAnimationLoop(render); }

    function render(timestamp, frame) {
        if (frame) handleHitTest(frame);
        renderer.render(scene, camera);
    }

    function handleHitTest(frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then(refSpace => {
                session.requestHitTestSource({ space: refSpace }).then(source => { hitTestSource = source; });
            });
            session.addEventListener('end', () => { hitTestSourceRequested = false; hitTestSource = null; });
            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length > 0) {
                const pose = hitTestResults[0].getPose(referenceSpace);
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }
}
