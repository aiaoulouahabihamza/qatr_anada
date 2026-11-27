(function () {
  "use strict";
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const qEl = document.getElementById("q");
  let cats = [];

  const norm = x => String(x).replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

  function render(filter) {
    const f = norm(filter || "").trim();
    const p = A.prog();
    let out = "", n = 0;
    cats.forEach(c => {
      if (f && !norm(c.category).includes(f)) return;
      const d = A.doneCount(p, c);
      out += '<a class="arow" href="dhikr.html?c=' + c.id + '"><span class="icon">' + A.ar(c.id) + '</span>' +
        '<span class="ainfo"><span class="aname">' + A.esc(c.category) + '</span><span class="ameta">' + A.ar(c.array.length) + " ذكر</span></span>" +
        (d === c.array.length ? '<span class="done">✓ تمّ</span>' : d ? '<span class="done">' + A.ar(d) + "/" + A.ar(c.array.length) + "</span>" : "") + "</a>";
      n++;
    });
    listEl.innerHTML = out;
    emptyEl.hidden = n > 0;
  }

  window.openSettings = function () { document.getElementById("settingsModal").classList.add("show"); };
  window.closeSettings = function () { document.getElementById("settingsModal").classList.remove("show"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSettings(); });
  window.resetToday = function () { A.saveProg({ d: A.prog().d, c: {} }); closeSettings(); render(qEl.value); };

  qEl.addEventListener("input", () => render(qEl.value));
  window.addEventListener("pageshow", () => { if (cats.length) render(qEl.value); });
  A.load().then(d => { cats = d; render(); window.__ready = true; })
    .catch(() => { listEl.innerHTML = '<p class="qempty">تعذّر تحميل الأذكار</p>'; });
})();
