window.gltfLoader = new THREE.GLTFLoader();
window.models = {};

class Reticle extends THREE.Object3D {
  constructor(initialMaskURL = "https://bambergwebar.netlify.app/2d/alteRathaus_mask.png") {
    super();
    this.visible = false;

    // Plane geometry for reticle
    const geometry = new THREE.PlaneGeometry(0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({ transparent: true });
    this.reticleMesh = new THREE.Mesh(geometry, material);
    // Set initial default rotation (before hit-test positions it)
    this.reticleMesh.rotation.x = 0; 
    this.reticleMesh.rotation.y = 0;
    this.reticleMesh.rotation.z = 0;

    this.add(this.reticleMesh);

    // Load initial mask
    this.setMask(initialMaskURL);
  }

  
  // Method to dynamically update reticle mask
  setMask(maskURL) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      maskURL,
      (texture) => {
        this.reticleMesh.material.map = texture;
        this.reticleMesh.material.needsUpdate = true;
        console.log("Reticle mask updated:", maskURL);
      },
      undefined,
      (error) => console.error("Error loading reticle mask:", error)
    );
  }

  updatePosition(position, normal) {
    this.position.copy(position);
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
    this.quaternion.copy(quaternion);
    this.visible = true;
  }

  // constructor() {
  //   super();
  //   this.visible = false;
    
  //   const textureLoader = new THREE.TextureLoader();
  //   const texture = textureLoader.load(
  //     "https://bambergwebar.netlify.app/2d/alteRathaus_mask.png",
  //     () => console.log("Reticle texture loaded"),
  //     undefined,
  //     (error) => console.error("Error loading reticle texture:", error)
  //   );

  //   // Create a plane geometry and apply the texture
  //   const geometry = new THREE.PlaneGeometry(0.5, 0.5); // adjust size
  //   const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  //   const reticle = new THREE.Mesh(geometry, material);

  //   // Make the plane to stand up straight
  //   reticle.rotation.y = 0  
  //   reticle.rotation.x = 0;  
  //   reticle.rotation.z = 0;  

  //   // Add plane to this Reticle object
  //   this.add(reticle);
  //   this.reticleMesh = reticle;

  //   // this.loader = new THREE.GLTFLoader();
  //   // this.loader.load(
  //   //   "https://immersive-web.github.io/webxr-samples/media/gltf/reticle/reticle.gltf", 
  //   //   (gltf) => {
  //   //     this.add(gltf.scene);
  //   //     // Optional: Add any reticle-specific setup here
  //   //   },
  //   //   undefined,
  //   //   (error) => {
  //   //     console.error("Error loading reticle:", error);
  //   //   }
  //   // );
  // }
}

// Load ALL static models at once
async function preloadAllModels() {
  const urls = {
    alteRathaus: "https://bambergwebar.netlify.app/3d/alteRathaus.glb",
    bohnlein: "https://bambergwebar.netlify.app/3d/bohnlein.glb",
    fileman: "https://bambergwebar.netlify.app/3d/fileman.glb",
    olymp: "https://bambergwebar.netlify.app/3d/olymp.glb"
  };

  const loader = window.gltfLoader;

  window.models = window.models || {};

  try {
    for (const key in urls) {
      window.models[key] = await new Promise((resolve, reject) => {
      loader.load(urls[key], gltf => {
        const model = gltf.scene;
        model.scale.set(0.05, 0.05, 0.05);
        resolve(model);
      }, undefined, reject);
    });
    }
    console.log("All models loaded successfully");
  } catch (error) {
    console.error("Error preloading models:", error);
  }
}
 

window.DemoUtils = {
  /**
   * Creates a THREE.Scene containing lights that case shadows,
   * and a mesh that will receive shadows.
   *
   * @return {THREE.Scene}
   */
  createLitScene() {
    const scene = new THREE.Scene();

    // The materials will render as a black mesh
    // without lights in our scenes. Let's add an ambient light
    // so our material can be visible, as well as a directional light
    // for the shadow.
    const light = new THREE.AmbientLight(0xffffff, 1);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 15, 10);

    // We want this light to cast shadow.
    directionalLight.castShadow = true;

    // Make a large plane to receive our shadows
    const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
    // Rotate our plane to be parallel to the floor
    planeGeometry.rotateX(-Math.PI / 2);

    // Create a mesh with a shadow material, resulting in a mesh
    // that only renders shadows once we flip the `receiveShadow` property.
    const shadowMesh = new THREE.Mesh(planeGeometry, new THREE.ShadowMaterial({
      color: 0x111111,
      opacity: 0.2,
    }));

    // Give it a name so we can reference it later, and set `receiveShadow`
    // to true so that it can render our model's shadow.
    shadowMesh.name = 'shadowMesh';
    shadowMesh.receiveShadow = true;
    shadowMesh.position.y = 10000;

    // Add lights and shadow material to scene.
    scene.add(shadowMesh);
    scene.add(light);
    scene.add(directionalLight);

    return scene;
  },

  /**
   * Creates a THREE.Scene containing cubes all over the scene.
   *
   * @return {THREE.Scene}
   */
  createCubeScene() {
    const scene = new THREE.Scene();

    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      new THREE.MeshBasicMaterial({ color: 0x0000ff }),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
      new THREE.MeshBasicMaterial({ color: 0xff00ff }),
      new THREE.MeshBasicMaterial({ color: 0x00ffff }),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    ];

    const ROW_COUNT = 4;
    const SPREAD = 1;
    const HALF = ROW_COUNT / 2;
    for (let i = 0; i < ROW_COUNT; i++) {
      for (let j = 0; j < ROW_COUNT; j++) {
        for (let k = 0; k < ROW_COUNT; k++) {
          const box = new THREE.Mesh(new THREE.BoxBufferGeometry(0.2, 0.2, 0.2), materials);
          box.position.set(i - HALF, j - HALF, k - HALF);
          box.position.multiplyScalar(SPREAD);
          scene.add(box);
        }
      }
    }

    return scene;
  },
};

/**
 * Toggle on a class on the page to disable the "Enter AR"
 * button and display the unsupported browser message.
 */
function onNoXRDevice() {
  document.body.classList.add('unsupported');
}


function onModelSelected(modelKey) {
  const maskMap = {
    alteRathaus: "https://bambergwebar.netlify.app/2d/alteRathaus_mask.png",
    bohnlein: "https://bambergwebar.netlify.app/2d/bohnlein_mask.png",
    fileman: "https://bambergwebar.netlify.app/2d/fileman_mask.png",
    olymp: "https://bambergwebar.netlify.app/2d/olymp_mask.png"
  };

  const maskURL = maskMap[modelKey];
  if (window.app.reticle) {
    window.app.reticle.setMask(maskURL);
  }

  window.selectedModel = window.models[modelKey];
  console.log("Selected model:", modelKey);
}