/* قطر الندى — quran/tafsir.js : تفسير الآية عند النقر عليها
   - ثلاثة تفاسير تُحمَّل عند الطلب على قطع صغيرة (assets/tafsir/<id>/<سورة>_<قطعة>.json)
   - التفاسير مرقّمة بترقيم حفص؛ أما ورش فتُحوَّل آيته إلى آية/آيات حفص
     بجدول المطابقة assets/tafsir/map_warsh.json (مولَّد بمحاذاة كلمات النصّين)  */
(function () {
  "use strict";
  const BASE = "../assets/json-data/";
  const SLUGS = ["001_al-fatiha","002_al-baqarah","003_aal-e-imran","004_an-nisa","005_al-maidah","006_al-anam","007_al-araf","008_al-anfal","009_at-tawbah","010_yunus","011_hud","012_yusuf","013_ar-rad","014_ibrahim","015_al-hijr","016_an-nahl","017_al-isra","018_al-kahf","019_maryam","020_ta-ha","021_al-anbiya","022_al-hajj","023_al-muminun","024_an-nur","025_al-furqan","026_ash-shuara","027_an-naml","028_al-qasas","029_al-ankabut","030_ar-rum","031_luqman","032_as-sajdah","033_al-ahzab","034_saba","035_fatir","036_ya-sin","037_as-saffat","038_sad","039_az-zumar","040_ghafir","041_fussilat","042_ash-shura","043_az-zukhruf","044_ad-dukhkhan","045_al-jathiya","046_al-ahqaf","047_muhammad","048_al-fath","049_al-hujurat","050_qaf","051_adh-dhariyat","052_at-tur","053_an-najm","054_al-qamar","055_ar-rahman","056_al-waqiah","057_al-hadid","058_al-mujadila","059_al-hashr","060_al-mumtahina","061_as-saff","062_al-jumua","063_al-munafiqoon","064_at-taghabun","065_at-talaq","066_at-tahrim","067_al-mulk","068_al-qalam","069_al-haqqah","070_al-maarij","071_nooh","072_al-jinn","073_al-muzzammil","074_al-muddathir","075_al-qiyamah","076_al-insan","077_al-mursalat","078_an-naba","079_an-naziat","080_abasa","081_at-takwir","082_al-infitar","083_al-mutaffifin","084_al-inshiqaq","085_al-buruj","086_at-tariq","087_al-ala","088_al-ghashiyah","089_al-fajr","090_al-balad","091_ash-shams","092_al-layl","093_ad-duha","094_ash-sharh","095_at-tin","096_al-alaq","097_al-qadr","098_al-bayyina","099_az-zalzalah","100_al-adiyat","101_al-qariah","102_at-takathur","103_al-asr","104_al-humazah","105_al-fil","106_quraish","107_al-maun","108_al-kawthar","109_al-kafirun","110_an-nasr","111_al-masad","112_al-ikhlas","113_al-falaq","114_an-nas"];
  /* ملف واحد لكل سورة يضم كل التفاسير مرقّمة بترقيم حفص. type = اسم التفسير داخل الملف */
  const LIST = [
    { id: "muyassar", name: "الميسر", type: "التفسير الميسر", full: "التفسير الميسر — مجمع الملك فهد" },
    { id: "jalalayn", name: "الجلالين", type: "تفسير الجلالين", full: "تفسير الجلالين" },
    { id: "saadi", name: "السعدي", type: "تفسير السعدي", full: "تيسير الكريم الرحمن — السعدي" },
    { id: "kathir", name: "ابن كثير", type: "تفسير ابن كثير", full: "تفسير القرآن العظيم — ابن كثير" },
    { id: "baghawi", name: "البغوي", type: "تفسير البغوي", full: "معالم التنزيل — البغوي" },
    { id: "qurtubi", name: "القرطبي", type: "تفسير القرطبي", full: "الجامع لأحكام القرآن — القرطبي" },
    { id: "tabari", name: "الطبري", type: "تفسير الطبري", full: "جامع البيان — الطبري" },
    { id: "wasit", name: "الوسيط", type: "تفسير الوسيط لطنطاوي", full: "التفسير الوسيط — طنطاوي" }
  ];
  const T = (window.QTafsir = {});
  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  /* ---------- تحميل السورة (نحتفظ بسورتين فقط في الذاكرة) ---------- */
  const mem = [];
  function loadSurah(s) {
    let e = mem.find(x => x.s === s);
    if (e) return e.p;
    const p = fetch(BASE + SLUGS[s - 1] + ".json").then(r => {
      if (!r.ok) { const err = new Error(r.status); err.status = r.status; throw err; }
      return r.json();
    }).then(d => d.ayahs);
    e = { s: s, p: p }; mem.unshift(e); if (mem.length > 2) mem.pop();
    p.catch(() => { const i = mem.indexOf(e); if (i >= 0) mem.splice(i, 1); });
    return p;
  }
  function textOf(ayahs, a, tf) {
    const row = ayahs[a - 1];
    const t = row && row.tafsir.find(x => x.type === tf.type);
    return t ? (t.text || "").replace(/\r/g, "").trim() : "";
  }
  let wmap = null;
  function warshMap() {
    if (!wmap) wmap = fetch("../assets/quran_warsh/map_hafs.json").then(r => r.json());
    return wmap;
  }
  /* آية الرواية الحالية ← [من، إلى] بترقيم حفص */
  async function hafsRange(r, s, a) {
    if (r === "hafs") return [a, a];
    const m = (await warshMap())[s];
    const e = m && m[a - 1];
    if (e === undefined) return [a, a];
    const p = String(e).split("-").map(Number);
    return [p[0], p[p.length - 1]];
  }

  /* ---------- جمع نص التفسير لمدى من آيات حفص ---------- */
  function gather(ayahs, tf, lo, hi) {
    const parts = [], seen = {};
    for (let a = lo; a <= hi; a++) {
      let src = a, t = textOf(ayahs, a, tf);
      /* بعض الكتب تجمع عدة آيات في كلام واحد يُكتب عند أولاها */
      if (!t) { for (let b = a - 1; b >= 1; b--) { t = textOf(ayahs, b, tf); if (t) { src = b; break; } } if (!t) continue; }
      if (seen[src]) continue;
      seen[src] = 1;
      parts.push({ a: a, src: src, merged: src !== a, text: t });
    }
    return parts;
  }

  /* ---------- تنسيق النص ---------- */
  function paras(txt) {
    /* الفقرات الطويلة جدًا تُقسَّم عند نهايات الجمل لتسهل القراءة */
    const out = [];
    txt.split("\n").forEach(line => {
      line = line.trim(); if (!line) return;
      if (line.length < 900) { out.push(line); return; }
      let cur = "";
      line.split(/(?<=[\.؟!؛])\s+/).forEach(sn => {
        cur += (cur ? " " : "") + sn;
        if (cur.length > 520) { out.push(cur); cur = ""; }
      });
      if (cur) out.push(cur);
    });
    return out;
  }
  function fmt(id, text) {
    let h = esc(text);
    if (id === "saadi") h = h.replace(/\{\s*([^{}]*?)\s*\}/g, '<span class="tq">﴿$1﴾</span>');
    else if (id === "jalalayn") h = h.replace(/«([^«»]*)»/g, '<span class="tq">«$1»</span>');
    else if (id === "tabari") h = h.replace(/\s*\*\s\*\s\*\s*/g, "\n");
    else if (id === "qurtubi") {
      h = h.replace(/(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة|الحادية عشرة|الثانية عشرة|الثالثة عشرة) ?:/g, "\n<b>$1:</b>")
        .replace(/(قوله تعالى|قوله) ?:/g, "\n<b>$1:</b>");
    } else if (id === "baghawi") h = h.replace(/(قوله عز وجل|قوله تعالى) ?:/g, "\n<b>$1:</b>");
    return paras(h).map(x => "<p>" + x + "</p>").join("");
  }

  /* ---------- الحالة والواجهة ---------- */
  let st = null;          /* { r, s, a, p, sname, total } */
  let pick = (function () { try { const v = localStorage.getItem("tafsirPick"); return LIST.some(x => x.id === v) ? v : "muyassar"; } catch (e) { return "muyassar"; } })();
  let fs = (function () { try { return Math.max(14, Math.min(26, +localStorage.getItem("tafsirFs") || 17)); } catch (e) { return 17; } })();
  let token = 0;

  function mark() {
    document.querySelectorAll(".t.tsel").forEach(n => n.classList.remove("tsel"));
    if (!st) return;
    document.querySelectorAll('.t[data-v="' + st.s + ":" + st.a + '"]').forEach(n => n.classList.add("tsel"));
  }

  async function render() {
    const my = ++token, tf = LIST.find(x => x.id === pick);
    el("tfTabs").innerHTML = LIST.map(x => '<button data-id="' + x.id + '" class="' + (x.id === pick ? "on" : "") + '">' + x.name + "</button>").join("");
    const on = el("tfTabs").querySelector(".on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
    el("tfWhere").textContent = "سورة " + st.sname + " · الآية " + window.Q.ar(st.a);
    el("tfPrev").disabled = st.a <= 1; el("tfNext").disabled = st.a >= st.total;
    const body = el("tfBody"); body.style.fontSize = fs + "px";
    body.innerHTML = '<p class="tf-wait">جارٍ التحميل…' + (st.s === 2 ? "<br><small>سورة طويلة، يستغرق التحميل الأول وقتًا</small>" : "") + "</p>";
    mark();
    try {
      const [lo, hi] = await hafsRange(st.r, st.s, st.a);
      const parts = gather(await loadSurah(st.s), tf, lo, hi);
      if (my !== token) return;
      const note = [];
      if (st.r !== "hafs") note.push("ترقيم حفص: " + (lo === hi ? "الآية " + window.Q.ar(lo) : "الآيات من " + window.Q.ar(lo) + " إلى " + window.Q.ar(hi)));
      let h = '<div class="tf-src">' + esc(tf.full) + (note.length ? " · " + note.join(" · ") : "") + "</div>";
      if (!parts.length) h += '<p class="tf-wait">لا يوجد تفسير لهذه الآية في هذا الكتاب.</p>';
      parts.forEach(pt => {
        if (parts.length > 1) h += '<h4 class="tf-h">الآية ' + window.Q.ar(pt.a) + " (حفص)</h4>";
        if (pt.merged) h += '<p class="tf-note">تفسيرها مذكور مع الآية ' + window.Q.ar(pt.src) + " في هذا الكتاب.</p>";
        h += fmt(tf.id, pt.text);
      });
      body.innerHTML = h; body.scrollTop = 0;
    } catch (e) {
      if (my !== token) return;
      body.innerHTML = e && e.status === 404
        ? '<p class="tf-wait">تفسير هذه السورة غير متوفر حاليًا ضمن ملفات الموقع المحلية.</p>'
        : '<p class="tf-wait">تعذّر تحميل التفسير. تأكد من الاتصال ثم حاول مرة أخرى.</p>';
    }
  }

  T.open = async function (r, v, p) {
    const q = window.Q, [s, a] = v.split(":").map(Number);
    st = { r: r, s: s, a: a, p: p, sname: "", total: a };
    el("tfWhere").textContent = "الآية " + q.ar(a);
    el("tfSheet").classList.add("show");
    const list = await q.surahs(r), sl = list.find(x => x.n === s);
    if (!st || st.s !== s || st.a !== a) return;
    st.sname = sl ? sl.ar : "";
    st.total = sl ? sl.aya : a;
    render();
  };
  T.close = function () { el("tfSheet").classList.remove("show"); st = null; token++; mark(); };
  T.step = function (d) { if (!st) return; const n = st.a + d; if (n < 1 || n > st.total) return; st.a = n; render(); };
  T.bookmark = function () { if (!st || !T.onBookmark) return; const v = st.s + ":" + st.a, p = st.p; T.close(); T.onBookmark(v, p); };
  T.size = function (d) { fs = Math.max(14, Math.min(26, fs + d)); try { localStorage.setItem("tafsirFs", fs); } catch (e) { /* لا شيء */ } el("tfBody").style.fontSize = fs + "px"; };

  document.addEventListener("DOMContentLoaded", () => {
    el("tfTabs").addEventListener("click", e => {
      const b = e.target.closest("[data-id]"); if (!b || !st) return;
      pick = b.dataset.id; try { localStorage.setItem("tafsirPick", pick); } catch (x) { /* لا شيء */ } render();
    });
    el("tfSheet").addEventListener("click", e => { if (e.target === el("tfSheet")) T.close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") T.close(); });
  });
})();
