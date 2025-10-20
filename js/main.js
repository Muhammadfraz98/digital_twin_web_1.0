// js/main.js
import { OldBambergAR } from './OldBambergAR.js';

const modelMap = {
  mask1: "alteRathaus.glb",
  mask2: "fileman.glb",
  mask3: "olymp.glb",
  mask4: "bohnlein.glb"
};

let arApp = null;

document.getElementById("explore").addEventListener("click", () => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("ar-view").style.display = "block";

  arApp = new OldBambergAR({
    arContainerId: "ar-view",
    buttonContainerId: "ar-button-container",
    statusId: "status-message",
    modelMap
  });

  // Default selected model
  arApp.selectModel("mask1");
});

// Handle model selection buttons
document.querySelectorAll(".mask").forEach(mask => {
  mask.addEventListener("click", (e) => {
    const key = e.target.id;
    if (arApp) arApp.selectModel(key);
  });
});
