// js/main.js
import { OldBambergAR } from "./OldBambergAR.js";

const modelMap = {
  mask1: "media/models/alteRathaus.glb",
  mask2: "media/models/fileman.glb",
  mask3: "media/models/olymp.glb",
  mask4: "media/models/bohnlein.glb"
};

// create the app instance (but do not start AR yet)
let arApp = new OldBambergAR({
  arContainerId: "ar-view",
  statusId: "status",
  modelMap
});

// splash / terms
const terms = document.getElementById("terms");
const explore = document.getElementById("explore");
const splash = document.getElementById("splash");
const overlay = document.getElementById("overlay");
const status = document.getElementById("status");

terms.addEventListener("change", () => {
  explore.disabled = !terms.checked;
});

explore.addEventListener("click", () => {
  splash.style.display = "none";
  document.getElementById("ar-view").style.visibility = "visible";
  overlay.hidden = false;
  status.textContent = "Status: Tap the ARButton to enter AR";
  // user must press ARButton created by ARButton.js to enter immersive session
});

// model selection UI
document.querySelectorAll(".mask").forEach(el => {
  el.addEventListener("click", (e) => {
    document.querySelectorAll(".mask").forEach(m => m.classList.remove("selected"));
    e.currentTarget.classList.add("selected");
    const id = e.currentTarget.id;
    if (arApp) arApp.selectModel(id);
  });
});

// undo / bomb
document.getElementById("undo").addEventListener("click", () => arApp.undoLast());
document.getElementById("bomb").addEventListener("click", () => arApp.bomb());
