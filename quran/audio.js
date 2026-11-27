/* ==========================================================================
   قطر الندى — quran/audio.js : مشغّل الآيات (mp3quran)
   - القرّاء يُجلبون حسب الرواية المفتوحة (حفص ← 1، ورش ← 2) ويُحفظون محليًا
     أسبوعين فلا تُحمَّل القوائم كل مرة.
   - الملف الصوتي: أول مرة بالشبكة، ثم يُحفظ في ذاكرة المتصفح (حتى حدّ معقول)
     فيُشغَّل بعدها دون إنترنت.
   - توقيت الآيات (ayat_timing) يحدّد الآية الجارية فتُظلَّل وتنتقل الصفحة معها.
   ========================================================================== */
(function () {
  "use strict";
  const API = "https://www.mp3quran.net/api/v3/";
  const REWAYA = { hafs: 1, warsh: 2, warsh_ma: 2 };
  const DAY = 864e5, REC_TTL = 14 * DAY;
  const CACHE = "qatr-audio-v1", MAX_FILES = 5, MAX_BYTES = 45e6;
  const A = (window.QAudio = {});
  const audio = new Audio();
  audio.preload = "auto";

  let st = null;            /* { r, s, a, reciter, moshaf, total, times:[{a,start,end}], url } */
  let timer = 0;

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* لا شيء */ } }
  };
  const pad = n => String(n).padStart(3, "0");
  const norm = x => String(x || "").replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  /* ===== القرّاء: قائمة مبسّطة لكل رواية، مخزّنة ===== */
  A.reciters = async function (riwaya) {
    const id = REWAYA[riwaya] || 1, key = "qa_rec_v1_" + id, c = ls.get(key);
    if (c && Date.now() - c.t < REC_TTL && c.list && c.list.length) return c.list;
    try {
      const d = await getJSON(API + "reciters?language=ar&rewaya=" + id);
      const list = [];
      (d.reciters || []).forEach(rc => (rc.moshaf || []).forEach(m => {
        list.push({ rid: rc.id, mid: m.id, name: rc.name, mname: m.name, server: m.server,
          surahs: String(m.surah_list || "").split(",").filter(Boolean).map(Number) });
      }));
      ls.set(key, { t: Date.now(), list: list });
      return list;
    } catch (e) {
      if (c && c.list) return c.list;             /* بلا إنترنت: القائمة القديمة */
      throw e;
    }
  };
  A.choice = function (riwaya) { return localStorage.getItem("qaReciter_" + (REWAYA[riwaya] || 1)) || ""; };
  A.setChoice = function (riwaya, mid) { try { localStorage.setItem("qaReciter_" + (REWAYA[riwaya] || 1), mid); } catch (e) { /* لا شيء */ } };

  /* ===== توقيت الآيات ===== */
  async function readsList() {
    const c = ls.get("qa_reads_v1");
    if (c && Date.now() - c.t < REC_TTL * 2) return c.list;
    try {
      const d = await getJSON(API + "ayat_timing/reads");
      const list = Array.isArray(d) ? d : (d.reads || []);
      ls.set("qa_reads_v1", { t: Date.now(), list: list });
      return list;
    } catch (e) { return c ? c.list : []; }
  }
  async function timingFor(rc, surah) {
    const key = "qa_tm_" + rc.mid + "_" + surah, c = ls.get(key);
    if (c) return c.v;
    let ids = [];
    try {
      const reads = await readsList(), n = norm(rc.name);
      reads.forEach(x => { if (norm(x.name) === n || norm(x.name).includes(n) || n.includes(norm(x.name))) ids.push(x.id); });
    } catch (e) { /* لا شيء */ }
    ids.push(rc.mid, rc.rid);
    const seen = {};
    for (const id of ids) {
      if (id == null || seen[id]) continue; seen[id] = 1;
      try {
        const d = await getJSON(API + "ayat_timing?surah=" + surah + "&read=" + id);
        const arr = Array.isArray(d) ? d : (d.ayat || d.data || []);
        const v = arr.filter(x => x && +x.ayah >= 1 && x.start_time != null).map(x => ({ a: +x.ayah, start: +x.start_time, end: +x.end_time }));
        if (v.length) { ls.set(key, { v: v }); return v; }
      } catch (e) { /* التالي */ }
    }
    ls.set(key, { v: [] });
    return [];
  }

  /* ===== الملف الصوتي: ذاكرة ذكية ===== */
  function idx() { return ls.get("qa_idx") || []; }
  async function remember(url, size) {
    let list = idx().filter(x => x.url !== url);
    list.push({ url: url, size: size, t: Date.now() });
    try {
      const c = await caches.open(CACHE);
      while (list.length > MAX_FILES) { const old = list.shift(); await c.delete(old.url); }
    } catch (e) { /* لا شيء */ }
    ls.set("qa_idx", list);
  }
  async function cachedBlobUrl(url) {
    try {
      if (!window.caches) return null;
      const c = await caches.open(CACHE), hit = await c.match(url);
      if (!hit) return null;
      return URL.createObjectURL(await hit.blob());
    } catch (e) { return null; }
  }
  async function saveInBackground(url) {
    try {
      if (!window.caches) return;
      const c = await caches.open(CACHE);
      if (await c.match(url)) return;
      const r = await fetch(url, { mode: "cors" });
      const len = +r.headers.get("content-length") || 0;
      if (!r.ok || (len && len > MAX_BYTES)) return;     /* السور الطويلة جدًا تُبَثّ فقط */
      await c.put(url, r.clone());
      await remember(url, len);
    } catch (e) { /* قد يمنع الخادم CORS: يبقى البثّ يعمل */ }
  }

  /* ===== التشغيل ===== */
  function listeners() {
    document.dispatchEvent(new CustomEvent("qaudio", { detail: A.state() }));
  }
  A.state = function () {
    return st ? { r: st.r, s: st.s, a: st.a, playing: !audio.paused, name: st.reciter.name, sname: st.sname, hasTiming: !!(st.times && st.times.length) } : null;
  };
  function inMs() { const tm = st.times; return tm[tm.length - 1].end > (audio.duration || 0) * 5; }   /* ملّي ثانية أم ثوانٍ */
  function verseAt(t) {
    const tm = st.times;
    if (!tm || !tm.length) return 0;
    const x = inMs() ? t * 1000 : t, slack = inMs() ? 80 : 0.08;
    let cur = 0;
    for (let i = 0; i < tm.length; i++) { if (x >= tm[i].start - slack) cur = tm[i].a; else break; }
    return cur;
  }
  function startOf(a) {
    const tm = st.times; if (!tm || !tm.length) return 0;
    const v = tm.find(x => x.a === a); if (!v) return 0;
    return inMs() ? v.start / 1000 : v.start;
  }
  function tick() {
    if (!st) return;
    const a = verseAt(audio.currentTime);
    if (a && a !== st.a) { st.a = a; if (A.onVerse) A.onVerse(st.s, a); listeners(); }
  }

  /* opts: { r, s, a, riwaya, sname, total, rc } */
  A.play = async function (o) {
    const rc = o.rc;
    if (!rc.surahs.includes(o.s)) throw new Error("surah-missing");
    const url = rc.server.replace(/\/?$/, "/") + pad(o.s) + ".mp3";
    st = { r: o.r, s: o.s, a: o.a, reciter: rc, sname: o.sname, total: o.total, times: [], url: url };
    listeners();
    const tp = timingFor(rc, o.s).then(t => { if (st && st.url === url) { st.times = t; } return t; }).catch(() => []);
    const blob = await cachedBlobUrl(url);
    audio.src = blob || url;
    const seek = async () => {
      await tp;
      if (!st || st.url !== url) return;
      const t = startOf(o.a);
      if (t > 0) { try { audio.currentTime = t; } catch (e) { /* لا شيء */ } }
    };
    audio.onloadedmetadata = seek;
    try { await audio.play(); } catch (e) { listeners(); throw e; }
    if (!blob) saveInBackground(url);
    clearInterval(timer); timer = setInterval(tick, 250);
    if (A.onVerse) A.onVerse(st.s, st.a);
    listeners();
  };
  A.toggle = function () { if (!st) return; if (audio.paused) audio.play().catch(() => {}); else audio.pause(); };
  A.stop = function () { clearInterval(timer); audio.pause(); audio.removeAttribute("src"); audio.load(); const had = st; st = null; if (A.onStop) A.onStop(had); listeners(); };
  A.step = function (d) {
    if (!st || !st.times.length) return;
    const n = st.a + d; if (n < 1 || n > st.total) return;
    const t = startOf(n); audio.currentTime = t; st.a = n; if (A.onVerse) A.onVerse(st.s, n); listeners();
  };
  audio.addEventListener("play", listeners);
  audio.addEventListener("pause", listeners);
  audio.addEventListener("ended", () => { clearInterval(timer); A.stop(); });
  audio.addEventListener("error", () => { if (A.onError) A.onError(); });
  /* حدّ الصفحة: إعلام نظام الوسائط في الهاتف */
  A.media = function () {
    if (!("mediaSession" in navigator) || !st) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: "سورة " + st.sname, artist: st.reciter.name, album: "قطر الندى" });
      navigator.mediaSession.setActionHandler("play", A.toggle);
      navigator.mediaSession.setActionHandler("pause", A.toggle);
      navigator.mediaSession.setActionHandler("nexttrack", () => A.step(1));
      navigator.mediaSession.setActionHandler("previoustrack", () => A.step(-1));
    } catch (e) { /* لا شيء */ }
  };
  document.addEventListener("qaudio", A.media);
})();
