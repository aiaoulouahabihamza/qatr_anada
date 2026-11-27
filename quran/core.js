/* ==========================================================================
   قطر الندى — quran/core.js
   المشترك بين فهرس السور وصفحة العرض: التخزين، الروايات، تحميل البيانات،
   آخر قراءة، والإعدادات. كل شيء داخل الكائن Q.
   ========================================================================== */
(function () {
  "use strict";
  const Q = (window.Q = {});

  /* ---------- التخزين الآمن ---------- */
  Q.get = function (k, d) {
    try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
  };
  Q.set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* لا شيء */ } };

  /* ---------- الروايات ---------- */
  Q.EDITIONS = {
    hafs:     { id: "hafs",     name: "حفص",                 sub: "عن عاصم",                font: "hafs",     first: 1, last: 604 },
    warsh:    { id: "warsh",    name: "ورش",                 sub: "عن نافع",                font: "warsh",    first: 1, last: 604 },
    warsh_ma: { id: "warsh_ma", name: "ورش بالرسم المغربي",  sub: "المصحف المحمدي",          font: "maghribi", first: 2, last: 639 }
  };
  Q.IDS = ["hafs", "warsh", "warsh_ma"];

  Q.chosen = function () { return Q.get("riwayaChosen", "") === "1" && !!Q.EDITIONS[Q.get("riwaya", "")]; };
  Q.riwaya = function () {
    const r = Q.get("riwaya", "");
    return Q.EDITIONS[r] ? r : "warsh";
  };
  Q.choose = function (r) {
    if (!Q.EDITIONS[r]) r = "warsh";
    Q.set("riwaya", r);
    Q.set("riwayaChosen", "1");
    document.documentElement.dataset.riwaya = r;
    return r;
  };

  /* رقم الصفحة المعروض: ملفات الرسم المغربي تبدأ من 2، والمعروض يبدأ من 1 */
  Q.showPage = function (r, p) { return r === "warsh_ma" ? p - 1 : p; };

  /* ---------- أدوات النص ---------- */
  const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  Q.ar = function (n) { return String(n).replace(/\d/g, d => AR_DIGITS[d]); };
  Q.pad3 = function (n) { return String(n).padStart(3, "0"); };
  Q.esc = function (s) {
    return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  };

  /* ---------- جلب JSON مع حفظ في الذاكرة ---------- */
  const cache = {};
  Q.json = function (url) {
    if (!cache[url]) {
      cache[url] = fetch(url).then(r => {
        if (!r.ok) throw new Error(r.status + " " + url);
        return r.json();
      }).catch(e => { delete cache[url]; throw e; });
    }
    return cache[url];
  };

  const BASE = "../assets/";

  /* ---------- آخر قراءة ---------- */
  Q.lastRead = function () {
    try {
      const o = JSON.parse(Q.get("lastRead", "null"));
      if (o && Q.EDITIONS[o.r] && o.p > 0) return o;
    } catch (e) { /* لا شيء */ }
    return null;
  };
  Q.saveLast = function (r, p, s, name, juz, a) {
    Q.set("lastRead", JSON.stringify({ r: r, p: p, s: s || 0, name: name || "", juz: juz || 0, a: a || 0, ts: Date.now() }));
  };

  /* ---------- العلامات المرجعية ---------- */
  Q.BM_COLORS = [
    { id: "olive", hex: "#036564", name: "أخضر" },
    { id: "red", hex: "#A33B32", name: "أحمر" },
    { id: "gold", hex: "#CDB380", name: "رملي" },
    { id: "blue", hex: "#2F6690", name: "أزرق" },
    { id: "purple", hex: "#6B4E8C", name: "بنفسجي" }
  ];
  Q.bmColor = function (id) { return (Q.BM_COLORS.find(x => x.id === id) || Q.BM_COLORS[0]).hex; };
  Q.bms = function () {
    try { const a = JSON.parse(Q.get("bookmarks", "[]")); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  };
  Q.bmSave = function (a) { Q.set("bookmarks", JSON.stringify(a)); };
  Q.bmFind = function (r, v) { return Q.bms().find(b => b.r === r && b.v === v); };
  Q.bmPut = function (b) {
    const a = Q.bms().filter(x => !(x.r === b.r && x.v === b.v));
    a.unshift(b);
    Q.bmSave(a);
  };
  Q.bmDel = function (r, v) { Q.bmSave(Q.bms().filter(x => !(x.r === r && x.v === v))); };

  /* ---------- روابط ---------- */
  Q.pageUrl = function (o) {
    const q = [];
    if (o.r) q.push("r=" + o.r);
    if (o.p) q.push("p=" + o.p);
    if (o.s) q.push("s=" + o.s);
    return "page.html" + (q.length ? "?" + q.join("&") : "");
  };

  /* ==========================================================================
     قوائم السور: [{n, ar, aya, place:'makki'|'madani', page, juz}]
     ========================================================================== */
  const lists = {};

  async function hafsSurahs() {
    const [sj, pj, jj] = await Promise.all([
      Q.json(BASE + "quran_hafs/surah.json"),
      Q.json(BASE + "quran_hafs/page.json"),
      Q.json(BASE + "quran_hafs/juz.json")
    ]);
    const first = {};
    pj.forEach((pg, i) => pg.forEach(x => { if (first[x.surah] === undefined) first[x.surah] = i + 1; }));
    const juzOf = p => { const j = jj.find(j => p >= j.page.start && p <= j.page.end); return j ? j.id : 1; };
    return sj.map(s => ({
      n: s.id, ar: s.arabic, aya: s.aya,
      place: s.place === "Makkah" ? "makki" : "madani",
      page: first[s.id], juz: juzOf(first[s.id])
    }));
  }

  async function warshSurahs() {
    const [wd, hs] = await Promise.all([Q.json(BASE + "quran_warsh/warshData.json"), hafsSurahs()]);
    const by = {};
    wd.forEach(r => {
      let s = by[r.sura_no];
      if (!s) s = by[r.sura_no] = { n: r.sura_no, ar: String(r.sura_name_ar).trim(), aya: 0, page: +r.page, juz: r.jozz };
      if (r.aya_no > s.aya) s.aya = r.aya_no;
    });
    return Object.values(by).sort((a, b) => a.n - b.n).map(s => {
      const h = hs[s.n - 1];
      /* اسم السورة من نسخة حفص أنظف في الواجهة، والعدد والصفحة من ورش */
      return { n: s.n, ar: h ? h.ar : s.ar, aya: s.aya, place: h ? h.place : "makki", page: s.page, juz: s.juz };
    });
  }

  async function maSurahs() {
    const [sj, az] = await Promise.all([
      Q.json(BASE + "quran_warsh_ma/surah.json"),
      Q.json(BASE + "quran_warsh_ma/ahzab.json")
    ]);
    const juzOf = p => {
      const h = az.find(h => p >= +h.first_page && p <= +h.last_page);
      return h ? Math.ceil(h.hizb_number / 2) : 1;
    };
    return sj.map(s => ({
      n: +s.surah_number, ar: s.title_ar, aya: +s.surah_verses_count,
      place: s.type === "مكية" ? "makki" : "madani",
      page: +s.page_debut_content, juz: juzOf(+s.page_debut_content)
    }));
  }

  Q.surahs = function (r) {
    if (!lists[r]) lists[r] = (r === "hafs" ? hafsSurahs() : r === "warsh" ? warshSurahs() : maSurahs());
    return lists[r];
  };

  /* ==========================================================================
     تقسيم النص إلى كلمات (حفص/ورش)
     نقسم على المسافة العادية فقط، فتبقى (nbsp + رمز الآية) ملتصقة بآخر كلمة.
     الرموز المنفردة تُدمج مع جارتها حتى لا يصير لها سطر وحدها.
     ========================================================================== */
  function tokenize(text) {
    const raw = text.split(" ").filter(Boolean);
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const t = raw[i];
      const bare = t.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ‌-‏ ]/g, "");
      if (!bare.length || /^[۞۩﴾﴿]+$/.test(bare)) {
        /* رمز منفرد: ۞ يلتحق بما بعده، وغيره بما قبله */
        if (t.indexOf("۞") === 0 && i + 1 < raw.length) { raw[i + 1] = t + " " + raw[i + 1]; continue; }
        if (out.length) { out[out.length - 1] += " " + t; continue; }
      }
      out.push(t);
    }
    return out;
  }
  Q.tokenize = tokenize;

  /* ==========================================================================
     صفحات حفص
     page.json: لكل صفحة [{surah,start,end}]
     ========================================================================== */
  let bsmCache = null;
  async function hafsBasmala() {
    if (bsmCache) return bsmCache;
    const q = await Q.json(BASE + "quran_hafs/quran.json");
    const v = q.find(x => x.surah_number === 27 && x.verse_number === 30);
    const m = v.content.match(/بِسۡمِ[\s\S]*$/);
    bsmCache = m ? m[0] : "بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ";
    return bsmCache;
  }

  let hafsIndex = null;
  async function hafsVerses() {
    if (hafsIndex) return hafsIndex;
    const q = await Q.json(BASE + "quran_hafs/quran.json");
    hafsIndex = {};
    q.forEach(v => { hafsIndex[v.surah_number + ":" + v.verse_number] = v.content; });
    return hafsIndex;
  }

  async function hafsPage(p) {
    const [pj, vs, sl, bsm] = await Promise.all([
      Q.json(BASE + "quran_hafs/page.json"), hafsVerses(), Q.surahs("hafs"), hafsBasmala()
    ]);
    const entries = pj[p - 1];
    if (!entries) return null;
    const segs = [];
    entries.forEach(e => {
      if (e.start === 1) {
        segs.push({ kind: "head", n: e.surah });
        if (e.surah !== 1 && e.surah !== 9) segs.push({ kind: "bsm", text: bsm });
      }
      const toks = [];
      const total = sl[e.surah - 1].aya;
      for (let a = e.start; a <= e.end; a++) {
        const w = tokenize(vs[e.surah + ":" + a]);
        if (!w.length) continue;
        /* رمز الآية: يرسم خط حفص الدائرة حول الأرقام العربية-الهندية وحدها، فلا نضيف ۝ */
        w[w.length - 1] += "\u00A0" + Q.ar(a);
        w.forEach((t, i) => toks.push({ s: t, vs: e.surah + ":" + a, first: i === 0, last: i === w.length - 1 }));
      }
      segs.push({ kind: "text", surah: e.surah, tokens: toks, endsSurah: e.end === total });
    });
    return { p: p, edition: "hafs", rows: p <= 2 ? 8 : 15, segs: segs, surahs: entries.map(e => e.surah) };
  }

  /* ==========================================================================
     صفحات ورش
     ملاحظة: الآية العابرة لصفحتين تُسجَّل في صفحة نهايتها، وبداية سطرها في
     الصفحة السابقة (line_end < line_start).
     ========================================================================== */
  let warshPages = null;
  async function warshIndex() {
    if (warshPages) return warshPages;
    const wd = await Q.json(BASE + "quran_warsh/warshData.json");
    warshPages = {};
    wd.forEach(r => { (warshPages[+r.page] = warshPages[+r.page] || []).push(r); });
    return warshPages;
  }

  /* نقسم كلمات الآية العابرة بنسبة عدد أحرفها على الصفحتين */
  function splitWrap(toks, headLines, tailLines) {
    const lens = toks.map(t => t.length);
    const sum = lens.reduce((a, b) => a + b, 0);
    const want = sum * headLines / (headLines + tailLines);
    let acc = 0, k = 0;
    while (k < toks.length - 1 && acc + lens[k] / 2 < want) { acc += lens[k]; k++; }
    k = Math.max(1, Math.min(toks.length - 1, k));
    return k;
  }

  async function warshPage(p) {
    const [wi, sl] = await Promise.all([warshIndex(), Q.surahs("warsh")]);
    const rows = (wi[p] || []).slice();
    const prev = wi[p - 1];
    const next = wi[p + 1];
    const segs = [];
    let cur = null;
    const lineCount = (p <= 2) ? 8 : 15;

    const pushVerse = (r, part) => {
      /* part: 'all' | 'tail' (الجزء الأخير من آية بدأت في الصفحة السابقة) | 'head' */
      let toks = tokenize(r.aya_text);
      let ls = r.line_start, le = r.line_end;
      if (r.line_end < r.line_start) {
        const k = splitWrap(toks, 16 - r.line_start, r.line_end);
        if (part === "head") { toks = toks.slice(0, k); le = 15; }
        else { toks = toks.slice(k); ls = 1; }
      }
      if (!cur || cur.surah !== r.sura_no) {
        if (r.aya_no === 1 && part !== "tail") {
          segs.push({ kind: "head", n: r.sura_no });
          if (r.sura_no !== 9) segs.push({ kind: "bsm", text: null });
        }
        cur = { kind: "text", surah: r.sura_no, tokens: [], endsSurah: false };
        segs.push(cur);
      }
      toks.forEach((t, i) => cur.tokens.push({
        s: t, vs: r.sura_no + ":" + r.aya_no,
        first: i === 0, last: i === toks.length - 1,
        ls: i === 0 ? ls : 0, le: i === toks.length - 1 ? le : 0
      }));
      cur.endsSurah = (r.aya_no === (sl[r.sura_no - 1] || {}).aya) && (part !== "head");
    };

    /* بقية آية الصفحة السابقة العابرة إلينا */
    if (rows.length && rows[0].line_end < rows[0].line_start) {
      pushVerse(rows.shift(), "tail");
    }
    rows.forEach(r => pushVerse(r, "all"));
    /* بداية آية تنتهي في الصفحة التالية */
    if (next && next[0] && next[0].line_end < next[0].line_start) pushVerse(next[0], "head");

    /* نص البسملة: الصفحة ٢ ورش أول سطر نصّي في الفاتحة... نأخذها من أول آية 1 من النص نفسه عند الحاجة */
    const bsmText = await warshBasmala();
    segs.forEach(s => { if (s.kind === "bsm") s.text = bsmText; });

    return { p: p, edition: "warsh", rows: lineCount, segs: segs, surahs: segs.filter(s => s.kind === "head").map(s => s.n) };
  }

  let wbsm = null;
  async function warshBasmala() {
    if (wbsm) return wbsm;
    /* البسملة بخط ورش: من الآية ٣٠ من سورة النمل (انتهاؤها بالبسملة) */
    const wi = await warshIndex();
    let found = null;
    Object.values(wi).some(rs => rs.some(r => {
      if (r.sura_no === 27 && r.aya_no === 30) { found = r.aya_text; return true; }
      return false;
    }));
    let t = "بِسْمِ اِ۬للَّهِ اِ۬لرَّحْمَٰنِ اِ۬لرَّحِيمِ";
    if (found) {
      const toks = tokenize(found);
      const i = toks.findIndex(x => /^\u0628[\u064B-\u065F\u0670]*\u0633/.test(x));
      if (i >= 0) t = toks.slice(i).join(" ").replace(/\u00A0[\uFB50-\uFDFF]+$/, "").trim();
    }
    wbsm = t;
    return t;
  }

  /* ==========================================================================
     صفحات الرسم المغربي: ملف JSON لكل صفحة فيه الأسطر جاهزة
     ========================================================================== */
  async function maPage(p) {
    const d = await Q.json(BASE + "quran_warsh_ma/" + p + ".json");
    return { p: p, edition: "warsh_ma", raw: d, rows: d.is_intro === "1" ? 8 : 15 };
  }

  Q.getPage = async function (r, p) {
    if (r === "hafs") return hafsPage(p);
    if (r === "warsh") return warshPage(p);
    return maPage(p);
  };

  /* سورة تُفتح بها صفحة: نجد رقم السورة من اسمها في الرسم المغربي */
  Q.maSurahByTitle = async function (title) {
    const list = await Q.surahs("warsh_ma");
    const t = String(title || "").trim();
    const f = list.find(s => s.ar === t);
    return f ? f.n : 0;
  };

  /* الصفحة التي تبدأ فيها السورة n في الرواية r */
  Q.pageOfSurah = async function (r, n) {
    const l = await Q.surahs(r);
    const s = l.find(x => x.n === n);
    return s ? s.page : Q.EDITIONS[r].first;
  };

  /* السورة التي تبدأ أو تجري في الصفحة p (للعرض في آخر قراءة) */
  Q.surahAtPage = async function (r, p) {
    const l = await Q.surahs(r);
    let best = null;
    l.forEach(s => { if (s.page <= p && (!best || s.page > best.page)) best = s; });
    return best || l[0];
  };

  /* الصفحة التي تحتوي الآية (s:a) في الرواية r */
  Q.pageOfVerse = async function (r, s, a) {
    if (r === "hafs") {
      const pj = await Q.json(BASE + "quran_hafs/page.json");
      for (let i = 0; i < pj.length; i++) {
        if (pj[i].some(e => e.surah === s && a >= e.start && a <= e.end)) return i + 1;
      }
      return Q.pageOfSurah(r, s);
    }
    if (r === "warsh") {
      const wi = await warshIndex();
      for (const pStr in wi) {
        const rows = wi[pStr];
        if (rows && rows.some(x => x.sura_no === s && x.aya_no === a)) return +pStr;
      }
      return Q.pageOfSurah(r, s);
    }
    /* warsh_ma: بحث ثنائي ذكي داخل مدى صفحات السورة */
    const list = await Q.surahs("warsh_ma");
    const idx = list.findIndex(x => x.n === s);
    if (idx < 0) return Q.EDITIONS.warsh_ma.first;
    const curS = list[idx];
    const loStart = curS.page;
    const hiEnd = idx + 1 < list.length ? Math.min(Q.EDITIONS.warsh_ma.last, list[idx + 1].page) : Q.EDITIONS.warsh_ma.last;
    if (a <= 1) return loStart;

    const rangeOfPage = async (p) => {
      const pg = await maPage(p);
      let minV = Infinity, maxV = -Infinity;
      (pg.raw && pg.raw.lines || []).forEach(ln => {
        (ln.words || []).forEach(w => {
          if (+w.surah_number === s && w.verse && w.verse.verse_number != null) {
            const vn = +w.verse.verse_number;
            if (vn < minV) minV = vn;
            if (vn > maxV) maxV = vn;
          }
        });
      });
      return { min: minV, max: maxV };
    };

    let lo = loStart, hi = hiEnd;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const rg = await rangeOfPage(mid);
      if (rg.min === Infinity) { lo++; continue; }
      if (a >= rg.min && a <= rg.max) return mid;
      if (a < rg.min) hi = mid - 1;
      else lo = mid + 1;
    }
    return loStart;
  };

  /* ---------- أوزان الآيات النطقية لمزامنة التلاوة عند غياب توقيت الخادم ---------- */
  function verseWeight(txt) {
    const clean = String(txt || "").replace(/\u00A0[\u0660-\u0669\u06F0-\u06F9]+$/g, "").replace(/[\s\u06DD۞۩﴾﴿]+/g, "");
    let w = 6.5;
    for (let i = 0; i < clean.length; i++) {
      const c = clean.charCodeAt(i);
      if (c === 0x0651) w += 0.55; /* شدة */
      else if (c === 0x0670 || c === 0x0653 || c === 0x0622) w += 0.65; /* ألف خنجرية / مد */
      else if (c >= 0x0621 && c <= 0x064A) w += (c === 0x0627 || c === 0x0648 || c === 0x0649 || c === 0x064A) ? 1.25 : 1;
    }
    return Math.max(8, w);
  }
  Q.surahVerseWeights = async function (r, s) {
    if (r === "hafs") {
      const [vs, sl] = await Promise.all([hafsVerses(), Q.surahs("hafs")]);
      const curS = sl.find(x => x.n === s);
      const total = curS ? curS.aya : 0;
      const out = [];
      for (let a = 1; a <= total; a++) out.push(verseWeight(vs[s + ":" + a]));
      return out;
    }
    const wi = await warshIndex();
    const map = {};
    Object.values(wi).forEach(rows => (rows || []).forEach(x => {
      if (x.sura_no === s && x.aya_no >= 1 && !map[x.aya_no]) map[x.aya_no] = verseWeight(x.aya_text);
    }));
    const sl = await Q.surahs(r);
    const curS = sl.find(x => x.n === s);
    const total = curS ? curS.aya : Object.keys(map).length;
    const out = [];
    for (let a = 1; a <= total; a++) out.push(map[a] || 20);
    return out;
  };

  /* ---------- الإعدادات: نافذة الرواية المشتركة ---------- */
  Q.markPills = function () {
    const r = Q.riwaya();
    document.querySelectorAll("[data-riwaya]").forEach(b => {
      if (b.tagName === "BUTTON") b.classList.toggle("active", b.dataset.riwaya === r);
    });
  };

  document.documentElement.dataset.riwaya = Q.riwaya();
  const fs = Q.get("fontSize", "medium");
  document.documentElement.dataset.fontsize = fs;
})();

