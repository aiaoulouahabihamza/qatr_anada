/* قطر الندى — duaa/dua.js : عرض أدعية باب واحد */
(function () {
  "use strict";
  const listEl = document.getElementById("alist");
  const id = +(new URLSearchParams(location.search).get("c")) || 1;
  let cat = null;

  function toast(t) {
    const el = document.getElementById("toast");
    el.textContent = t; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1600);
  }
  function applyFs() {
    const k = A.get("adkarFont", "medium"), px = { small: 19, medium: 22, large: 27 }[k] || 22;
    document.documentElement.style.setProperty("--afs", px + "px");
    document.querySelectorAll("[data-fs]").forEach(b => b.classList.toggle("active", b.dataset.fs === k));
  }
  window.setFs = function (k) { A.set("adkarFont", k); applyFs(); };
  window.openSettings = function () { applyFs(); document.getElementById("settingsModal").classList.add("show"); };
  window.closeSettings = function () { document.getElementById("settingsModal").classList.remove("show"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSettings(); });

  function plain(z) { return z.text.replace(/\s+/g, " ").trim(); }

  function cardHTML(z, i) {
    const refs = (z.source && z.source.references) || [], isQ = z.source && z.source.type === "quran";
    let src = "";
    if (refs.length) {
      src = isQ
        ? refs.map(r => "سورة " + A.esc(r.surah.name) + " — " + A.ar(r.ayah.from) + (r.ayah.to !== r.ayah.from ? "–" + A.ar(r.ayah.to) : "")).join("<br>")
        : refs.map(r => (r.rawi ? "<b>" + A.esc(r.rawi) + "</b>: " : "") + A.esc(A.ref(r))).join("<br>");
    }
    const vocab = (z.vocabulary || []).map(v => "<li><b>" + A.esc(v.text) + "</b>: " + A.esc(v.meaning) + "</li>").join("");
    return '<article class="dcard" data-i="' + i + '">' +
      '<p class="dtext">' + (isQ ? "﴿" + A.esc(plain(z)) + "﴾" : A.esc(plain(z))) + "</p>" +
      (src ? '<details class="dsrc"><summary>' + (isQ ? "موضع الآية" : "المصدر والتخريج") + "</summary><p>" + src + "</p></details>" : "") +
      (vocab ? '<details class="dsrc"><summary>معاني الكلمات</summary><ul>' + vocab + "</ul></details>" : "") +
      '<div class="dfoot"><span class="dnum">' + A.ar(i + 1) + "</span>" +
      '<button class="dcopy" aria-label="نسخ"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.7"><path class="fl" d="M9 9h11v11H9z" /><rect x="9" y="9" width="11" height="11" rx="2.5" /><path class="ac" d="M15 5.5V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h.5" /></svg></button></div></article>';
  }

  listEl.addEventListener("click", e => {
    const b = e.target.closest(".dcopy");
    if (!b) return;
    const z = cat.duaa[+b.closest(".dcard").dataset.i];
    (navigator.clipboard ? navigator.clipboard.writeText(plain(z)) : Promise.reject()).then(() => toast("تم النسخ"), () => toast("تعذّر النسخ"));
  });

  A.load().then(d => {
    cat = d.find(x => x.id === id) || d[0];
    document.title = cat.category + " — قطر الندى";
    document.getElementById("barTitle").textContent = cat.category;
    document.getElementById("barSub").textContent = A.ar(cat.duaa.length) + " دعاء";
    listEl.innerHTML = cat.duaa.map(cardHTML).join("");
    applyFs();
    window.__ready = true;
  }).catch(() => { listEl.innerHTML = '<p class="qempty">تعذّر تحميل الأدعية</p>'; });
})();
