(function () {
  "use strict";
  const id = +new URLSearchParams(location.search).get("c") || 1;
  const listEl = document.getElementById("alist");
  const FS = { small: 19, medium: 22, large: 27 };
  let cat = null, prog = A.prog();
  const bar = document.querySelector(".aprog i");

  function fs() { const k = A.get("adkarFont", "medium"); return FS[k] ? k : "medium"; }
  function applyFs() {
    const k = fs();
    document.documentElement.style.setProperty("--afs", FS[k] + "px");
    document.querySelectorAll("[data-fs]").forEach(b => b.classList.toggle("active", b.dataset.fs === k));
  }
  window.setFs = function (k) { A.set("adkarFont", k); applyFs(); };
  window.openSettings = function () { applyFs(); document.getElementById("settingsModal").classList.add("show"); };
  window.closeSettings = function () { document.getElementById("settingsModal").classList.remove("show"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSettings(); });

  function toast(t) {
    const el = document.getElementById("toast");
    el.textContent = t; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1600);
  }

  function summary() {
    const d = A.doneCount(prog, cat), n = cat.array.length;
    document.getElementById("barSub").textContent = A.ar(d) + " من " + A.ar(n);
    bar.style.width = (n ? d / n * 100 : 0) + "%";
    document.getElementById("finish").hidden = d !== n;
  }

  function cardHTML(z, i) {
    const rem = A.remaining(prog, cat.id, i, z.count);
    const text = z.text.replace(/\s+/g, " ").trim();
    return '<article class="dcard' + (rem === 0 ? " fin" : "") + '" data-i="' + i + '">' +
      '<p class="dtext">' + A.esc(text) + "</p>" +
      '<div class="dfoot"><span class="dnum">' + A.ar(i + 1) + "</span>" +
      '<button class="dcnt" aria-label="عدّاد الذكر">' + (rem === 0 ? "✓" : A.ar(rem) + "<small>من " + A.ar(z.count) + "</small>") + "</button>" +
      '<button class="dcopy" aria-label="نسخ"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.7"><path class="fl" d="M9 9h11v11H9z" /><rect x="9" y="9" width="11" height="11" rx="2.5" /><path class="ac" d="M15 5.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h.5" /></svg></button></div></article>';
  }

  listEl.addEventListener("click", e => {
    const card = e.target.closest(".dcard");
    if (!card) return;
    const i = +card.dataset.i, z = cat.array[i];
    if (e.target.closest(".dcopy")) {
      const t = z.text.replace(/\s+/g, " ").trim();
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast("تم النسخ"), () => toast("تعذّر النسخ"));
      return;
    }
    if (e.target.closest(".dcnt") || e.target.closest(".dtext")) {
      let rem = A.remaining(prog, cat.id, i, z.count);
      if (rem === 0) return;
      rem--;
      A.setRemaining(prog, cat.id, i, rem); A.saveProg(prog);
      if (navigator.vibrate) { try { navigator.vibrate(rem === 0 ? 40 : 10); } catch (x) { /* لا شيء */ } }
      card.outerHTML = cardHTML(z, i);
      summary();
      if (rem === 0) {
        const nx = listEl.children[i + 1];
        if (nx) nx.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  });

  window.resetCat = function () {
    delete prog.c[cat.id]; A.saveProg(prog);
    listEl.innerHTML = cat.array.map(cardHTML).join(""); summary(); closeSettings(); window.scrollTo(0, 0);
  };

  A.load().then(d => {
    cat = d.find(x => x.id === id) || d[0];
    document.title = cat.category + " — قطر الندى";
    document.getElementById("barTitle").textContent = cat.category;
    listEl.innerHTML = cat.array.map(cardHTML).join("");
    applyFs(); summary();
    window.__ready = true;
  }).catch(() => { listEl.innerHTML = '<p class="qempty">تعذّر تحميل الأذكار</p>'; });
})();
