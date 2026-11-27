(function () {
  "use strict";
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const qEl = document.getElementById("q");
  let cats = [];

  const norm = x => String(x).replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

  function render(filter) {
    const f = norm(filter || "").trim();
        let out = "", n = 0;
    cats.forEach(c => {
      if (f && !norm(c.category).includes(f)) return;
      out += '<a class="arow" href="dua.html?c=' + c.id + '"><span class="icon">' + A.ar(c.id) + '</span>' +
        '<span class="ainfo"><span class="aname">' + A.esc(c.category) + '</span><span class="ameta">' + A.ar(c.duaa.length) + " دعاء</span></span>" + "</a>";
      n++;
    });
    listEl.innerHTML = out;
    emptyEl.hidden = n > 0;
  }

  window.openSettings = function () { document.getElementById("settingsModal").classList.add("show"); };
  window.closeSettings = function () { document.getElementById("settingsModal").classList.remove("show"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSettings(); });

  qEl.addEventListener("input", () => render(qEl.value));
  A.load().then(d => { cats = d; render(); window.__ready = true; })
    .catch(() => { listEl.innerHTML = '<p class="qempty">تعذّر تحميل الأدعية</p>'; });
})();
