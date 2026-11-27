(function () {
  "use strict";
  const DAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "ماي", "يونيو", "يوليوز", "غشت", "شتنبر", "أكتوبر", "نونبر", "دجنبر"];
  const $ = id => document.getElementById(id);
  let code = Prayer.cityCode(), sel = null, cities = [], nxt = null;

  function fmtHtml(t) {
    const f = Prayer.fmt(t);
    return f.replace(/ (ص|م)$/, "<small>$1</small>");
  }
  function applyFont() { document.documentElement.style.setProperty("--cfont", Prayer.fontCss(Prayer.font())); }
  applyFont();

  async function show() {
    const n = Prayer.now();
    sel = sel || { y: n.y, m: n.m, d: n.d };
    const isToday = sel.y === n.y && sel.m === n.m && sel.d === n.d;
    const day = await Prayer.day(code, sel.y, sel.m, sel.d);
    $("cityName").textContent = day.city.n;
    $("dayTitle").textContent = DAYS[Prayer.weekday(sel.y, sel.m, sel.d)] + " " + Prayer.ar(sel.d) + " " + MONTHS[sel.m - 1] + " " + Prayer.ar(sel.y);
    $("dayHijri").textContent = Prayer.hijri(sel.y, sel.m, sel.d);
    $("src").textContent = day.src === "official" ? "المصدر: جدول وزارة الأوقاف والشؤون الإسلامية" : "الأوقات محسوبة فلكيًا حسب إحداثيات مدينتك";
    const next = isToday ? await Prayer.next(code) : null;
    $("rows").innerHTML = day.t.map((t, i) => {
      const isNext = next && !next.tomorrow && next.i === i;
      const name = i === 2 && Prayer.weekday(sel.y, sel.m, sel.d) === 5 ? "الجمعة" : Prayer.NAMES[i];
      return '<div class="prow' + (i === 1 ? " sun" : "") + (isNext ? " next" : "") + (next && (next.tomorrow || i < next.i) ? " past" : "") + '"><span class="nm">' + name + (isNext ? "<em>القادمة</em>" : "") + '</span><span class="tm">' + fmtHtml(t) + "</span></div>";
    }).join("");
  }

  async function tick() {
    nxt = await Prayer.next(code);
    $("nextName").textContent = nxt.name + (nxt.tomorrow ? " (غدًا)" : "");
    $("nextCount").textContent = Prayer.clock(nxt.secs);
  }
  setInterval(() => { if (nxt) { nxt.secs -= 1; if (nxt.secs <= 0) { tick(); show(); } else $("nextCount").textContent = Prayer.clock(nxt.secs); } }, 1000);

  function move(n) { const t = Prayer.addDay(sel.y, sel.m, sel.d, n); sel = t; show(); }
  $("nextDay").onclick = () => move(1);
  $("prevDay").onclick = () => move(-1);

  /* اختيار المدينة */
  function drawCities(f) {
    f = (f || "").trim();
    $("cities").innerHTML = cities.filter(c => !f || c.n.includes(f)).map(c =>
      '<button data-c="' + c.c + '" class="' + (c.c === code ? "on" : "") + '">' + c.n + "</button>").join("");
  }
  window.openCities = function () { $("citiesModal").classList.add("show"); drawCities(""); $("csearch").value = ""; };
  window.closeCities = function () { $("citiesModal").classList.remove("show"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeCities(); closeSettings(); } });
  $("csearch").addEventListener("input", e => drawCities(e.target.value));
  $("cities").addEventListener("click", e => {
    const b = e.target.closest("[data-c]");
    if (!b) return;
    code = +b.dataset.c; Prayer.setCity(code); closeCities(); tick(); show();
  });

  /* الإعدادات */
  function drawSettings() {
    const a = Prayer.adj();
    $("adjList").innerHTML = [0, 1, 2, 3, 4, 5].map(i =>
      '<div class="setting"><span>' + Prayer.NAMES[i] + '</span><div class="step"><button data-i="' + i + '" data-d="-1" aria-label="إنقاص دقيقة">−</button><b>' +
      '<bdi>' + (a[i] > 0 ? "+" : "") + a[i] + '</bdi> د</b><button data-i="' + i + '" data-d="1" aria-label="زيادة دقيقة">+</button></div></div>').join("");
    $("h12").querySelectorAll("button").forEach(b => b.classList.toggle("on", (b.dataset.h === "1") === Prayer.is12()));
    $("fontPills").innerHTML = Object.keys(Prayer.FONTS).map(k =>
      '<button data-f="' + k + '" class="' + (k === Prayer.font() ? "on" : "") + '" style="font-family:' + Prayer.fontCss(k) + '">' + Prayer.FONTS[k] + "</button>").join("");
    $("fontPreview").textContent = "12:34:56";
  }
  const refresh = () => { tick(); show(); drawSettings(); };
  window.openSettings = function () { $("setModal").classList.add("show"); drawSettings(); };
  window.closeSettings = function () { $("setModal").classList.remove("show"); };
  $("adjList").addEventListener("click", e => {
    const b = e.target.closest("[data-i]"); if (!b) return;
    const a = Prayer.adj(), i = +b.dataset.i;
    a[i] = Math.max(-30, Math.min(30, a[i] + +b.dataset.d)); Prayer.setAdj(a); refresh();
  });
  $("h12").addEventListener("click", e => { const b = e.target.closest("[data-h]"); if (!b) return; Prayer.set("prayerH12", b.dataset.h); refresh(); });
  $("fontPills").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (!b) return; Prayer.set("prayerFont", b.dataset.f); applyFont(); drawSettings(); });
  $("resetAdj").onclick = () => { Prayer.setAdj([0, 0, 0, 0, 0, 0]); refresh(); };

  Promise.all([Prayer.cities(), Prayer.loadHijri()]).then(r => { cities = r[0]; return Promise.all([tick(), show()]); })
    .then(() => { window.__ready = true; })
    .catch(() => { $("rows").innerHTML = '<p class="psrc">تعذّر تحميل الأوقات</p>'; });
})();
