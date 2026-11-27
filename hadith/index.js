(function () {
  "use strict";
  const listEl = document.getElementById("list"), emptyEl = document.getElementById("empty"), qEl = document.getElementById("q");
  let rows = [];

  /* عنوان فرعي: أول جزء من نص الحديث النبوي (داخل الأقواس {}) أو بداية الحديث */
  function snippet(html) {
    const t = H.plain(html), m = t.match(/\{([^}]{8,})\}/);
    let s = (m ? m[1] : t.replace(/^.*?(قال|يقول)\s*:?\s*/, "")).trim();
    return s.length > 62 ? s.slice(0, 62).replace(/\s\S*$/, "") + "…" : s;
  }

  function render(filter) {
    const f = H.norm(filter || "").trim();
    const last = +H.get("hadithLast", "0");
    let out = "", n = 0;
    rows.forEach(r => {
      if (f && !(String(r.n) === f || H.norm(r.full).includes(f) || H.norm("الحديث " + H.ORD[r.n - 1]).includes(f))) return;
      out += '<a class="arow" href="page.html?n=' + r.n + '"><span class="icon">' + H.ar(r.n) + '</span>' +
        '<span class="ainfo"><span class="aname">الحديث ' + H.ORD[r.n - 1] + '</span><span class="ameta">' + H.esc(r.snip) + "</span></span>" +
        (r.n === last ? '<span class="done">آخر قراءة</span>' : "") + "</a>";
      n++;
    });
    listEl.innerHTML = out;
    emptyEl.hidden = n > 0;
  }

  function updateResume() {
    const last = +H.get("hadithLast", "0");
    const el = document.getElementById("resume");
    if (last > 0 && last <= H.TOTAL) {
      el.href = "page.html?n=" + last; el.hidden = false;
      el.innerHTML = '<span class="icon">' + H.ar(last) + '</span><span class="ainfo"><span class="aname">متابعة القراءة</span><span class="ameta">الحديث ' + H.ORD[last - 1] + "</span></span>";
    } else {
      el.hidden = true;
    }
  }

  qEl.addEventListener("input", () => render(qEl.value));
  window.addEventListener("pageshow", () => {
    if (rows.length) { updateResume(); render(qEl.value); }
  });
  H.load().then(m => {
    for (let i = 1; i <= H.TOTAL; i++) { const h = m["h" + i + "_hadith"] || ""; rows.push({ n: i, snip: snippet(h), full: H.plain(h) }); }
    updateResume();
    render(); window.__ready = true;
  }).catch(() => { listEl.innerHTML = '<p class="qempty">تعذّر تحميل الأحاديث</p>'; });
})();
