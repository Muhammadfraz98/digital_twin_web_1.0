const terms = document.getElementById("terms");
const explore = document.getElementById("explore");

terms.addEventListener("change", () => {
  explore.disabled = !terms.checked;
  if (terms.checked) {
    explore.classList.add("enabled");
  } else {
    explore.classList.remove("enabled");
  }
});

explore.addEventListener("click", () => {
  if (terms.checked) {
    window.location.href = "ar.html";
  }
});
