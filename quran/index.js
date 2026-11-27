/* ==========================================================================
   قطر الندى — quran/index.js : اختيار الرواية وفهرس السور
   ========================================================================== */
(function () {
  "use strict";

  const gate = document.getElementById("gate");
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const qEl = document.getElementById("q");
  let surahs = [];

  /* ---------- نافذة الإعدادات ---------- */
  window.openSettings = function () { Q.markPills(); document.getElementById("settingsModal").classList.add("show"); };
  window.closeSettings = function () { document.getElementById("settingsModal").classList.remove("show"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSettings(); });

  window.pickRiwaya = function (id) {
    Q.choose(id);
    closeSettings();
    load();
  };

  /* ---------- شاشة الاختيار الإجباري ---------- */
  function showGate() {
    gate.hidden = false;
    document.body.classList.add("gated");
  }
  gate.addEventListener("click", e => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    Q.choose(b.dataset.pick);
    gate.classList.add("leave");
    document.body.classList.remove("gated");
    setTimeout(() => { gate.hidden = true; gate.classList.remove("leave"); }, 450);
    load();
  });

  /* ---------- بطاقة آخر قراءة ---------- */
  async function renderLast() {
    const card = document.getElementById("lastCard");
    const lr = Q.lastRead();
    if (!lr) { card.hidden = true; return; }
    const s = lr.s ? (await Q.surahs(lr.r)).find(x => x.n === lr.s) : await Q.surahAtPage(lr.r, lr.p);
    card.hidden = false;
    card.href = Q.pageUrl({ r: lr.r, p: lr.p });
    document.getElementById("lastBadge").textContent = Q.EDITIONS[lr.r].name;
    document.getElementById("lastSurah").textContent = s ? "سورة " + s.ar : "المصحف";
    document.getElementById("lastMeta").textContent = "صفحة " + Q.ar(Q.showPage(lr.r, lr.p)) + (s ? " · الجزء " + Q.ar(s.juz) : "");
  }

  /* ---------- القائمة ---------- */
  function row(s) {
    const place = s.place === "makki" ? "مكية" : "مدنية";
    const icon = s.place === "makki" ? "q-makki.svg" : "q-madani.svg";
    return '<a class="srow" href="' + Q.pageUrl({ s: s.n }) + '" data-n="' + s.n + '">' +
      '<span class="icon">' + Q.ar(s.n) + "</span>" +
      '<span class="sinfo">' +
        '<span class="sname" style="font-family:var(--font-surah)">' + Q.pad3(s.n) + "</span>" +
        '<span class="smeta"><img src="../assets/img/' + icon + '" alt="">' + place + " · " + Q.ar(s.aya) + " آية · ص " + Q.ar(Q.showPage(Q.riwaya(), s.page)) + "</span>" +
      "</span>" +
      '<span class="badge">الجزء ' + Q.ar(s.juz) + "</span>" +
      '<span class="sr-only">سورة ' + Q.esc(s.ar) + "</span></a>";
  }

  function render(filter) {
    const f = (filter || "").trim();
    let out = "", shown = 0;
    const norm = x => String(x).replace(/[\u064B-\u065F\u0670\u0640]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
    const nf = norm(f).replace(/^سوره\s*/, "");
    surahs.forEach(s => {
      if (nf) {
        const hit = norm(s.ar).includes(nf) || String(s.n) === nf || Q.ar(s.n) === nf;
        if (!hit) return;
      }
      out += row(s); shown++;
    });
    listEl.innerHTML = out;
    emptyEl.hidden = shown > 0;
  }

  qEl.addEventListener("input", () => render(qEl.value));

  async function load() {
    const r = Q.riwaya();
    document.getElementById("riwayaName").textContent = "برواية " + Q.EDITIONS[r].name;
    listEl.innerHTML = '<div class="qload"><span></span></div>';
    qEl.value = "";
    try {
      surahs = await Q.surahs(r);
      /* عدّلنا الروابط: تفتح السورة في الرواية الحالية */
      render("");
      renderLast();
    } catch (e) {
      listEl.innerHTML = '<p class="qempty">تعذّر تحميل قائمة السور. تأكد من وجود ملفات الرواية.</p>';
    }
    /* تهيئة الخطوط مسبقًا ليبقى فتح الصفحة سريعًا */
    try { document.fonts.load('20px "surah-names"', "002"); document.fonts.load('20px "' + Q.EDITIONS[r].font + '"', "ب"); } catch (e) { /* لا شيء */ }
  }

  /* ---------- البدء ---------- */
  if (!Q.chosen()) showGate();
  load();
  window.__ready = true;
})();
