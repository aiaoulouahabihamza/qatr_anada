window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("splash").classList.add("hide");
  }, 5000);
});

function openDrawer() {
  document.getElementById("drawer").classList.add("open");
  document.getElementById("overlay").classList.add("show");
}
function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

function openSettings() {
  closeDrawer();
  document.getElementById("settingsModal").classList.add("show");
}
function closeSettings() {
  document.getElementById("settingsModal").classList.remove("show");
}

function setRiwaya(type) {
  localStorage.setItem("riwaya", type);
  document.querySelectorAll(".pills button").forEach(btn => {
    if (btn.textContent === "ورش" || btn.textContent === "حفص") {
      btn.classList.toggle("active", 
        (type === "warsh" && btn.textContent === "ورش") || 
        (type === "hafs" && btn.textContent === "حفص")
      );
    }
  });
}

function setFontSize(size) {
  localStorage.setItem("fontSize", size);
  event.target.parentElement.querySelectorAll("button").forEach(b => b.classList.remove("active"));
  event.target.classList.add("active");
}

function startReading() {
  alert("سيتم فتح صفحة القرآن قريبًا");
}