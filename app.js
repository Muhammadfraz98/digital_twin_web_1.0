// Utility functions
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function onNoXRDevice() {
  document.body.classList.add('unsupported');
}

(async function() {
  await preloadAllModels(); 

  const isArSessionSupported = navigator.xr && navigator.xr.isSessionSupported && await navigator.xr.isSessionSupported("immersive-ar");
  if (isArSessionSupported) {
    //document.getElementById("enter-ar").addEventListener("click", window.app.activateXR);
    document.getElementById("enter-ar").addEventListener("click", showBuildingListScreen);
  } else {
    onNoXRDevice();
  }
})();


// Back button handler
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('start-ar-back').addEventListener('click', function() {
    document.getElementById('building-list-screen').classList.add('hidden');
    document.getElementById('enter-ar-info').style.display = 'block';
    document.getElementById('splash-image').style.display = 'block';
    document.body.classList.remove("ar");
  });
});


/**
 * Container class to manage connecting to the WebXR Device API
 * and handle rendering on every frame.
 */
class App {
  /**
   * Run when the Start AR button is pressed.
   */
  activateXR = async () => {
    try {
      // Initialize a WebXR session using "immersive-ar".
      this.xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.body }
      });

      // Create the canvas that will contain our camera's background and our virtual scene.
      this.createXRCanvas();

      // With everything set up, start the app.
      await this.onSessionStarted();
    } catch(e) {
      console.log(e);
      onNoXRDevice();
    }
  }

  /**
   * Add a canvas element and initialize a WebGL context that is compatible with WebXR.
   */
  createXRCanvas() {
    this.canvas = document.createElement("canvas");
    document.body.appendChild(this.canvas);
    this.gl = this.canvas.getContext("webgl", {xrCompatible: true});

    this.xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
    });
  }


  onSessionStarted = async () => {
    // Add the `ar` class to our body, which will hide our 2D components
    document.getElementById('splash-image').style.display = 'none';
    document.body.classList.add('ar');

    // To help with working with 3D on the web, we'll use three.js.
    this.setupThreeJs();

    // Setup an XRReferenceSpace using the "local" coordinate system.
    this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');

    // Create another XRReferenceSpace that has the viewer as the origin.
    this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');
    // Perform hit testing using the viewer as origin.
    this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });

    // Start a rendering loop using this.onXRFrame.
    this.xrSession.requestAnimationFrame(this.onXRFrame);

    this.xrSession.addEventListener("select", this.onSelect);
  }

  /** Place a model when the screen is tapped. */
  onSelect = () => {
    
    if (this.modelPlaced) return;

    const modelToPlace = window.selectedModel;  

    if (modelToPlace && this.reticle.visible) {
        const clone = modelToPlace.clone();
        clone.position.copy(this.reticle.position);
        clone.position.z -= 0.5;
        this.scene.add(clone);

        // Optional: adjust shadowMesh
        const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
        if (shadowMesh) shadowMesh.position.y = clone.position.y;
        this.modelPlaced = true;
    }
  }

  /**
   * Called on the XRSession's requestAnimationFrame.
   * Called with the time and XRPresentationFrame.
   */
  onXRFrame = (time, frame) => {
    // Queue up the next draw request.
    this.xrSession.requestAnimationFrame(this.onXRFrame);

    // Bind the graphics framebuffer to the baseLayer's framebuffer.
    const framebuffer = this.xrSession.renderState.baseLayer.framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
    this.renderer.setFramebuffer(framebuffer);

    // Retrieve the pose of the device.
    // XRFrame.getViewerPose can return null while the session attempts to establish tracking.
    const pose = frame.getViewerPose(this.localReferenceSpace);
    if (pose) {
      // In mobile AR, we only have one view.
      const view = pose.views[0];

      const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
      this.renderer.setSize(viewport.width, viewport.height)

      // Use the view's transform matrix and projection matrix to configure the THREE.camera.
      this.camera.matrix.fromArray(view.transform.matrix)
      this.camera.projectionMatrix.fromArray(view.projectionMatrix);
      this.camera.updateMatrixWorld(true);

      // Conduct hit test.
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);

      // If we have results, consider the environment stabilized.
      if (!this.stabilized && hitTestResults.length > 0) {
        this.stabilized = true;
        document.body.classList.add('stabilized');
      }
      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

        // Update the reticle position
        this.reticle.visible = true;
        this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
        this.reticle.updateMatrixWorld(true);
      }

      // Render the scene with THREE.WebGLRenderer.
      this.renderer.render(this.scene, this.camera)
    }
  }

  /**
   * Initialize three.js specific rendering code, including a WebGLRenderer,
   * a demo scene, and a camera for viewing the 3D content.
   */
  setupThreeJs() {
    // To help with working with 3D on the web, we'll use three.js.
    // Set up the WebGLRenderer, which handles rendering to our session's base layer.
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      canvas: this.canvas,
      context: this.gl
    });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Initialize our demo scene.
    this.scene = DemoUtils.createLitScene();
    this.reticle = new Reticle();
    this.scene.add(this.reticle);

    // We'll update the camera matrices directly from API, so
    // disable matrix auto updates so three.js doesn't attempt
    // to handle the matrices independently.
    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;
  }
};



async function showBuildingListScreen() {
  document.getElementById("splash-image").style.display = "none";
  document.getElementById("enter-ar-info").style.display = "none";

  const screen = document.getElementById("building-list-screen");
  screen.classList.remove("hidden");

  // Show loading state
  document.getElementById("user-location").innerText = "Getting your location...";

  // get user location
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    

    document.getElementById("user-location").innerText =
      `Your Location: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;

      
    // fetch from firebase
    const buildings = await fetchBuildingsFromFirebase();
    console.log("Fetched buildings:", buildings);

    if (buildings.length === 0) {
      document.getElementById("building-list").innerHTML = "No buildings found in database.";
        return;
    }

    // filter by distance (10km radius example)
    const NEARBY_RADIUS = 10000;
    const nearby = buildings.filter(b => 
      getDistance(lat, lon, b.latitude, b.longitude) <= NEARBY_RADIUS
    );
    console.log("Nearby buildings:", nearby);  
    showBuildings(nearby.length > 0 ? nearby : buildings);
    
    showBuildings(nearby);
  }, (error) => {
      console.error("Geolocation error:", error);
      document.getElementById("user-location").innerText = "Location access denied. Showing all buildings.";
      
      // Show all buildings if location fails
      fetchBuildingsFromFirebase().then(buildings => {
        showBuildings(buildings);
      });
    }
  );
}


// render list
function showBuildings(buildings) {
  const list = document.getElementById("building-list");
  list.innerHTML = "";

  if (buildings.length === 0) {
    list.innerHTML = "<p>No buildings available.</p>";
    return;
  }

  buildings.forEach(b => {
    const div = document.createElement("div");
    div.innerHTML = `
      <strong>${b.name}</strong><br>
      ${b.lat}, ${b.lon} 
    `;

    div.addEventListener("click", () => startARForBuilding(b));
    list.appendChild(div);
  });
}

async function startARForBuilding(building) {
  console.log("Selected building:", building);
  window.selectedModel = window.models[building.modelKey]; 

  if (!window.selectedModel) {
    console.error("Model not found:", building.modelKey);
    alert("Model not loaded. Please try again.");
    return;
  }
 
  document.getElementById("building-list-screen").classList.add("hidden");
  // Start AR session
  await window.app.activateXR();

}

window.app = new App();
