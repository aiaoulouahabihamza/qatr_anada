/* ==========================================================================
   قطر الندى — quran/audio.js : مشغّل الآيات (mp3quran) مع تتبع دقيق للآيات
   ========================================================================== */
(function () {
  "use strict";
  const API = "https://www.mp3quran.net/api/v3/";
  const REWAYA = { hafs: 1, warsh: 2, warsh_ma: 2 };
  const REWAYA_TEXT = { 1: "حفص", 2: "ورش" };
  const DAY = 864e5, REC_TTL = 14 * DAY;
  const CACHE = "qatr-audio-v2", MAX_FILES = 5, MAX_BYTES = 45e6;
  const A = (window.QAudio = {});
  const audio = new Audio();
  audio.preload = "auto";

  let st = null;            /* { r, rw, s, a, reciter, sname, total, times:[{a,start,end}], timingMode, url } */
  let rafId = 0;
  let timer = 0;

  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* لا شيء */ } }
  };
  const pad = n => String(n).padStart(3, "0");
  const norm = x => String(x || "")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^(?:الشيخ|القارئ|شيخ)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const normUrl = u => String(u || "").replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase();

  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }

  /* ===== القرّاء: قائمة مبسّطة لكل رواية، مخزّنة ===== */
  A.reciters = async function (riwaya) {
    const id = REWAYA[riwaya] || 1, key = "qa_rec_v2_" + id, c = ls.get(key);
    if (c && Date.now() - c.t < REC_TTL && c.list && c.list.length) return c.list;
    try {
      const d = await getJSON(API + "reciters?language=ar&rewaya=" + id);
      const list = [];
      (d.reciters || []).forEach(rc => (rc.moshaf || []).forEach(m => {
        list.push({
          rid: rc.id, mid: m.id, rw: id,
          name: rc.name, mname: m.name, server: m.server,
          surahs: String(m.surah_list || "").split(",").filter(Boolean).map(Number)
        });
      }));
      ls.set(key, { t: Date.now(), list: list });
      return list;
    } catch (e) {
      if (c && c.list) return c.list;
      throw e;
    }
  };
  A.choice = function (riwaya) { return localStorage.getItem("qaReciter_" + (REWAYA[riwaya] || 1)) || ""; };
  A.setChoice = function (riwaya, mid) { try { localStorage.setItem("qaReciter_" + (REWAYA[riwaya] || 1), mid); } catch (e) { /* لا شيء */ } };

  /* ===== توقيت الآيات (مطابقة دقيقة حسب رابط الخادم ثم الاسم + الرواية) ===== */
  async function readsList() {
    const c = ls.get("qa_reads_v3");
    if (c && Date.now() - c.t < REC_TTL * 2 && c.list && c.list.length) return c.list;
    try {
      const d = await getJSON(API + "ayat_timing/reads");
      const list = Array.isArray(d) ? d : (d.reads || []);
      ls.set("qa_reads_v3", { t: Date.now(), list: list });
      return list;
    } catch (e) { return c && c.list ? c.list : []; }
  }

  function nameMatch(a, b) {
    const na = norm(a), nb = norm(b);
    if (!na || !nb) return false;
    if (na === nb || na.includes(nb) || nb.includes(na)) return true;
    const ta = na.split(" ").filter(w => w.length > 1);
    const tb = nb.split(" ").filter(w => w.length > 1);
    if (ta.length < 2 || tb.length < 2) return false;
    const [shorter, longer] = ta.length <= tb.length ? [ta, nb] : [tb, na];
    return shorter.every(tok => longer.includes(tok));
  }

  function sameRewaya(readItem, rwHint) {
    if (!readItem || !readItem.rewaya) return true;
    const xr = norm(readItem.rewaya), rh = norm(rwHint);
    if (xr.includes(rh)) return true;
    /* المصحف المجود على mp3quran هو برواية حفص */
    if (rh === norm("حفص") && xr.includes(norm("المجود"))) return true;
    return false;
  }

  function matchRead(reads, rc) {
    const rw = rc.rw || REWAYA[rc.r] || 1;
    const rwHint = REWAYA_TEXT[rw] || "";
    const srv = normUrl(rc.server);
    if (srv) {
      const exactFolder = reads.find(x => x.folder_url && normUrl(x.folder_url) === srv);
      if (exactFolder) return exactFolder;
    }
    const sameRwList = reads.filter(x => sameRewaya(x, rwHint));
    const byName = sameRwList.find(x => nameMatch(x.name, rc.name));
    if (byName) return byName;
    const byId = sameRwList.find(x => x.id === rc.mid || x.id === rc.rid);
    return byId || null;
  }

  A.timedReads = async function (riwaya) {
    const rw = REWAYA[riwaya] || 1;
    try {
      const reads = await readsList();
      const rwHint = REWAYA_TEXT[rw] || "";
      const scoped = reads.filter(x => sameRewaya(x, rwHint));
      const urlSet = new Set();
      const idSet = new Set();
      const names = [];
      scoped.forEach(x => {
        if (x.folder_url) urlSet.add(normUrl(x.folder_url));
        if (x.id != null) idSet.add(x.id);
        if (x.name) names.push(x.name);
      });
      return {
        has(rc) {
          if (rc.server && urlSet.has(normUrl(rc.server))) return true;
          if (idSet.has(rc.mid) || idSet.has(rc.rid)) return true;
          return names.some(n => nameMatch(n, rc.name));
        }
      };
    } catch (e) {
      return { has: () => false };
    }
  };

  async function timingFor(rc, surah) {
    const key = "qa_tm_v3_" + rc.mid + "_" + surah, c = ls.get(key);
    if (c && Array.isArray(c.v) && c.v.length) return c.v;
    const ids = [];
    const rw = rc.rw || REWAYA[rc.r] || 1;
    const rwHint = REWAYA_TEXT[rw] || "";
    let reads = [];
    try {
      reads = await readsList();
      const m = matchRead(reads, rc);
      if (m && m.id != null) ids.push(m.id);
    } catch (e) { /* لا شيء */ }
    if (!ids.length && rc.mid != null) {
      /* لا نستخدم معرّفًا ينتمي لرواية مخالفة في قائمة mp3quran */
      const conflict = reads.find(x => x.id === rc.mid && !sameRewaya(x, rwHint));
      if (!conflict) ids.push(rc.mid);
    }
    const seen = {};
    for (const id of ids) {
      if (id == null || seen[id]) continue;
      seen[id] = 1;
      try {
        const d = await getJSON(API + "ayat_timing?surah=" + surah + "&read=" + id);
        const arr = Array.isArray(d) ? d : (d.ayat || d.data || []);
        const raw = arr
          .filter(x => x && +x.ayah >= 1 && x.start_time != null && isFinite(+x.start_time))
          .map(x => ({
            a: +x.ayah,
            start: +x.start_time,
            end: (x.end_time != null && isFinite(+x.end_time) && +x.end_time > +x.start_time) ? +x.end_time : 0
          }))
          .sort((x, y) => x.start - y.start || x.a - y.a);

        if (raw.length) {
          for (let i = 0; i < raw.length; i++) {
            if (!raw[i].end) {
              raw[i].end = i + 1 < raw.length ? raw[i + 1].start : Infinity;
            }
          }
          ls.set(key, { v: raw });
          return raw;
        }
      } catch (e) { /* التالي */ }
    }
    return [];
  }

  /* مزامنة بديلة موزونة بعدد الحروف والمدود والوقف عند غياب توقيت الخادم لهذا القارئ */
  async function buildSyncTiming(r, s, total, dur) {
    if (!dur || !isFinite(dur) || dur <= 0 || !window.Q || !Q.surahVerseWeights) return [];
    try {
      const weights = await Q.surahVerseWeights(r, s);
      if (!weights || !weights.length) return [];
      const lead = Math.min(dur * 0.08, s === 1 || s === 9 ? 1.5 : 4.2);
      const span = Math.max(1, dur - lead);
      let sum = 0;
      for (let i = 0; i < weights.length; i++) sum += weights[i];
      if (!sum) return [];
      const out = [];
      let acc = lead;
      for (let i = 0; i < weights.length; i++) {
        const start = i === 0 ? 0 : acc;
        acc += span * (weights[i] / sum);
        const end = i === weights.length - 1 ? dur : acc;
        out.push({ a: i + 1, start: Math.round(start * 1000), end: Math.round(end * 1000) });
      }
      return out;
    } catch (e) { return []; }
  }

  /* ===== الملف الصوتي: ذاكرة ذكية ===== */
  function idx() { return ls.get("qa_idx_v2") || []; }
  async function remember(url, size) {
    let list = idx().filter(x => x.url !== url);
    list.push({ url: url, size: size, t: Date.now() });
    try {
      const c = await caches.open(CACHE);
      while (list.length > MAX_FILES) { const old = list.shift(); await c.delete(old.url); }
    } catch (e) { /* لا شيء */ }
    ls.set("qa_idx_v2", list);
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
      if (!r.ok || (len && len > MAX_BYTES)) return;
      await c.put(url, r.clone());
      await remember(url, len);
    } catch (e) { /* قد يمنع الخادم CORS: يبقى البثّ يعمل */ }
  }

  /* ===== التتبع الدقيق والتشغيل ===== */
  function listeners() {
    document.dispatchEvent(new CustomEvent("qaudio", { detail: A.state() }));
  }
  A.state = function () {
    return st ? {
      r: st.r, s: st.s, a: st.a,
      playing: !audio.paused,
      name: st.reciter.name,
      sname: st.sname,
      hasTiming: !!(st.times && st.times.length),
      timingMode: st.timingMode || ""
    } : null;
  };

  function inMs() {
    const tm = st && st.times;
    if (!tm || !tm.length) return true;
    let maxT = 0;
    for (let i = 0; i < tm.length; i++) {
      if (tm[i].start > maxT) maxT = tm[i].start;
      if (isFinite(tm[i].end) && tm[i].end > maxT) maxT = tm[i].end;
    }
    const dur = audio.duration;
    if (dur && isFinite(dur) && dur > 0) return maxT > dur * 2.5;
    return maxT > 1200;
  }

  function verseAt(t) {
    const tm = st && st.times;
    if (!tm || !tm.length) return 0;
    const ms = inMs();
    const x = ms ? t * 1000 : t;
    const slack = ms ? 45 : 0.045;
    let lo = 0, hi = tm.length - 1, ans = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (x >= tm[mid].start - slack) {
        ans = tm[mid].a;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans || tm[0].a;
  }

  function startOf(a) {
    const tm = st && st.times;
    if (!tm || !tm.length) return 0;
    const v = tm.find(x => x.a === a);
    if (!v) return 0;
    return inMs() ? v.start / 1000 : v.start;
  }

  function tick() {
    if (!st || !st.times || !st.times.length) return;
    const a = verseAt(audio.currentTime);
    if (a && a !== st.a) {
      st.a = a;
      if (A.onVerse) A.onVerse(st.s, a);
      listeners();
    }
  }

  function stopLoop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (timer) { clearInterval(timer); timer = 0; }
  }
  function startLoop() {
    stopLoop();
    const step = () => {
      if (!st || audio.paused) { rafId = 0; return; }
      tick();
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    timer = setInterval(tick, 200);
  }

  /* opts: { r, s, a, sname, total, rc } */
  A.play = async function (o) {
    const rc = Object.assign({ rw: REWAYA[o.r] || 1, r: o.r }, o.rc);
    if (!rc.surahs.includes(o.s)) throw new Error("surah-missing");
    const url = rc.server.replace(/\/?$/, "/") + pad(o.s) + ".mp3";
    st = { r: o.r, rw: rc.rw, s: o.s, a: o.a, reciter: rc, sname: o.sname, total: o.total, times: [], timingMode: "", url: url, seekedToStart: false };
    listeners();

    const tp = timingFor(rc, o.s).then(t => {
      if (st && st.url === url && t && t.length) {
        st.times = t;
        st.timingMode = "exact";
        listeners();
      }
      return t || [];
    }).catch(() => []);

    const blob = await cachedBlobUrl(url);
    audio.src = blob || url;

    const seek = async () => {
      await tp;
      if (!st || st.url !== url) return;
      if ((!st.times || !st.times.length) && audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        const est = await buildSyncTiming(o.r, o.s, o.total, audio.duration);
        if (!st || st.url !== url) return;
        if (est.length && !st.times.length) {
          st.times = est;
          st.timingMode = "sync";
          listeners();
        }
      }
      if (st.seekedToStart) return;
      if (st.times && st.times.length) {
        st.seekedToStart = true;
        const t = startOf(o.a);
        if (t > 0) {
          try { audio.currentTime = t; } catch (e) { /* لا شيء */ }
        }
        tick();
      }
    };
    audio.onloadedmetadata = seek;
    audio.ondurationchange = seek;

    try { await audio.play(); } catch (e) { listeners(); throw e; }
    if (audio.readyState >= 1) seek();
    if (!blob) saveInBackground(url);
    startLoop();
    if (A.onVerse) A.onVerse(st.s, st.a);
    listeners();
  };

  A.toggle = function () {
    if (!st) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };
  A.stop = function () {
    stopLoop();
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    const had = st;
    st = null;
    if (A.onStop) A.onStop(had);
    listeners();
  };
  A.step = function (d) {
    if (!st || !st.times.length) return;
    const n = Math.max(1, Math.min(st.total, st.a + d));
    const entry = st.times.find(x => x.a === n) || st.times.find(x => (d > 0 ? x.a >= n : x.a <= n));
    if (!entry) return;
    const t = inMs() ? entry.start / 1000 : entry.start;
    audio.currentTime = t;
    st.a = entry.a;
    if (A.onVerse) A.onVerse(st.s, entry.a);
    listeners();
  };

  audio.addEventListener("timeupdate", tick);
  audio.addEventListener("seeked", tick);
  audio.addEventListener("play", () => { startLoop(); listeners(); });
  audio.addEventListener("pause", () => { stopLoop(); listeners(); });
  audio.addEventListener("ended", () => { stopLoop(); A.stop(); });
  audio.addEventListener("error", () => { stopLoop(); if (A.onError) A.onError(); });

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
