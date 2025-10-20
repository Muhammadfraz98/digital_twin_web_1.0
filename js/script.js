import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/webxr/ARButton.js";

        let camera, scene, renderer;
        let controller, reticle;
        let hitTestSource = null; 
        let selectedModelUrl = null;

        const statusMessage = document.getElementById("status-message");

        // IMPORTANT: Model paths must be correct relative to your server root.
        const modelMap = {
            mask1: "../3d/alteRathaus.glb",
            mask2: "../3d/fileman.glb",
            mask3: "../3d/olymp.glb",
            mask4: "../3d/bohnlein.glb",
        };

        const loader = new GLTFLoader();
        

        document.getElementById('explore-button').addEventListener('click', enterARMode);

        function enterARMode() {
            document.getElementById('splash').style.display = 'none';
            document.getElementById('ar-view').style.visibility = 'visible';
            
            init();
            animate();
            
            // Set default model selection
            document.getElementById('mask1').click();
        }


        function init() {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.xr.enabled = true;
            document.getElementById('ar-view').appendChild(renderer.domElement);

            // Create AR button and append to the custom container
            const arButton = ARButton.createButton(renderer, { 
                requiredFeatures: ["hit-test"],
                domElement: document.getElementById('ar-button-container') // Use custom container
            });
            document.getElementById('ar-button-container').appendChild(arButton);

            // FIX: Tie Hit-Test Setup to session events directly 
            renderer.xr.addEventListener('sessionstart', onSessionStart);
            renderer.xr.addEventListener('sessionend', onSessionEnd);

            // Lighting
            const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
            scene.add(light);

            // Reticle (the target ring)
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

            // Mask selection logic (re-attached for the visible UI)
            document.querySelectorAll(".mask").forEach((mask) => {
                mask.addEventListener("click", (e) => {
                    document.querySelectorAll(".mask").forEach((m) => m.classList.remove("selected"));
                    e.target.classList.add("selected");
                    selectedModelUrl = modelMap[e.target.id];
                    // Use the text from the mask for better user feedback
                    statusMessage.textContent = `Selected: ${e.target.textContent.trim()}. Press 'ENTER AR' to begin.`;
                });
            });
        }


        function onSessionStart(event) {
            statusMessage.textContent = "AR Session Started. Looking for a surface...";
            const session = event.target.getSession();
            
            session.requestReferenceSpace("viewer")
                .then((refSpace) => {
                    return session.requestHitTestSource({ space: refSpace });
                })
                .then((source) => {
                    hitTestSource = source;
                    statusMessage.textContent = "Hit Test Ready. Tap to place model!";
                })
                .catch((error) => {
                    statusMessage.textContent = `Error starting hit test: ${error.name}`;
                    console.error("Failed to request Hit Test Source:", error);
                });
        }

        function onSessionEnd() {
            hitTestSource = null;
            reticle.visible = false;
            statusMessage.textContent = "AR Session Ended.";
        }

        function onSelect() {
            if (!reticle.visible || !selectedModelUrl) {
                statusMessage.textContent = "Cannot place: No surface detected or no model selected.";
                return;
            }
            
            statusMessage.textContent = `Placing ${selectedModelUrl}...`;

            loader.load(selectedModelUrl, (gltf) => {
                const model = gltf.scene;
                model.scale.set(0.2, 0.2, 0.2); 
                
                // Position and orient the model using the reticle's matrix
                model.position.setFromMatrixPosition(reticle.matrix);
                model.quaternion.setFromRotationMatrix(reticle.matrix);

                scene.add(model);
                statusMessage.textContent = `Model placed successfully! Tap to place another.`;
            }, undefined, (error) => {
                 statusMessage.textContent = `Error loading model! Check console for details.`;
                 console.error('Error loading GLTF model:', error);
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
                if (hitTestSource) { 
                    const referenceSpace = renderer.xr.getReferenceSpace();
                    const hitTestResults = frame.getHitTestResults(hitTestSource);
                    
                    if (hitTestResults.length > 0) {
                        const hit = hitTestResults[0];
                        const pose = hit.getPose(referenceSpace);
                        
                        reticle.visible = true;
                        reticle.matrix.fromArray(pose.transform.matrix); 
                        // Only override status message if we are actively searching
                        if (statusMessage.textContent.includes('Searching') || statusMessage.textContent.includes('Surface detected')) {
                            statusMessage.textContent = "Surface detected. Tap to place.";
                        }
                    } else {
                        reticle.visible = false;
                        // Only override status message if we are actively searching
                        if (statusMessage.textContent.includes('detected') || statusMessage.textContent.includes('Ready')) {
                             statusMessage.textContent = "Searching for a flat surface...";
                        }
                    }
                } 
            }

            // Only render if the renderer is initialized (after explore click)
            if (renderer) {
                renderer.render(scene, camera);
            }
        }