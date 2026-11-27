/* ==========================================================================
   قطر الندى — quran/page.js
   صفحة عرض المصحف: صفحات تُسحب يمينًا ويسارًا بلا أزرار، وسطور موزّعة
   كما في المصحف المطبوع.
   ========================================================================== */
(function () {
  "use strict";

  const IMG = "../assets/img/";
  const FRAME_RATIO = 1040.5 / 118.5;      /* نسبة عرض إطار السورة إلى ارتفاعه */
  const BAR_H = 60;
  const SPF = 0.55;                        /* أقل مسافة طبيعية بين الكلمات */
  const CAP = 0.62;                        /* أقصى حجم خط نسبة إلى ارتفاع السطر */
  const AN_SCALE = 1.26;                   /* تكبير أرقام الآيات في حفص وورش */
  const K = { hafs: 0.055, warsh: 0.052, warsh_ma: 0.0651 };

  /* ---------- حالة ---------- */
  const params = new URLSearchParams(location.search);
  let r = params.get("r");
  if (!Q.EDITIONS[r]) r = Q.riwaya();
  if (params.get("r") && Q.EDITIONS[params.get("r")]) Q.choose(r);
  if (!Q.chosen() && !params.get("r")) { go("index.html"); return; }

  const ED = Q.EDITIONS[r];
  const FONT = ED.font;
  const pager = document.getElementById("pager");
  if (!pager) return;
  const stats = (window.__stats = { fallback: 0, pages: 0, fmin: 999, fmax: 0, rendered: {} });

  let G = null;               /* أبعاد الحاوية الفعلية */
  let cur = 0;                /* الصفحة الحالية */
  const html = new Map();     /* صفحة -> HTML جاهز */
  const rendering = new Map();/* صفحة -> وعد قيد التنفيذ */
  let epoch = 0;              /* يتغير عند تغيّر المقاس أو السمة */

  /* ---------- معادلة التحجيم الديناميكية المرتبطة بأبعاد الحاوية ---------- */
  function geom() {
    const cw = pager.clientWidth || document.documentElement.clientWidth;
    const ch = pager.clientHeight || window.innerHeight;
    const availH = Math.max(240, ch - BAR_H - 10);
    const availW = Math.max(200, cw - 16);
    const landscape = cw > ch;
    const maxW = landscape ? 620 : 560;
    const ratio = landscape ? 0.68 : 0.58;
    let pw = Math.min(availW, maxW, Math.floor(availH * ratio));
    let ph = Math.min(availH, Math.floor(pw / 0.58));
    pw = Math.floor(pw);
    ph = Math.floor(ph);
    const side = Math.round(pw * 0.032);
    const top = Math.round(ph * 0.016);
    const bottom = Math.max(24, Math.round(ph * 0.064));
    return { cw, ch, pw, ph, side, top, bottom, W: pw - 2 * side, H: ph - top - bottom };
  }

  /* سطور الفاتحة وأول البقرة: تدرج متناظر (الأول والأخير بنفس الطول، والوسط أعرض) */
  function lineWidths(rows, W) {
    const w = [];
    const baseW = rows === 8 ? Math.min(W, 420) : W;
    for (let i = 0; i < rows; i++) w.push(baseW);
    if (rows === 8) {
      const k = rows - 1;
      for (let j = 0; j < k; j++) {
        const t = (j + 0.5) / k;
        w[j + 1] = Math.round(baseW * (0.56 + 0.44 * Math.pow(Math.sin(Math.PI * t), 0.9)));
      }
    }
    return w;
  }

  /* ---------- قياس الكلمات بلوحة canvas ---------- */
  const ctx = document.createElement("canvas").getContext("2d");
  const wcache = new Map();
  function measure(text, family) {
    const k = family + "|" + text;
    let w = wcache.get(k);
    if (w === undefined) {
      ctx.font = '100px "' + family + '"';
      w = ctx.measureText(text).width;
      wcache.set(k, w);
    }
    return w;
  }
  function spaceW(family) { return measure("ا ا", family) - 2 * measure("ا", family) || 25; }
  function measureTok(text, family) {
    const m = text.match(/^([\s\S]*?)(\u00A0[\u0660-\u0669]+|\u00A0?[\uFB50-\uFDFF]+)$/);
    if (!m) return measure(text, family);
    return measure(m[1], family) + measure(m[2], family) * AN_SCALE;
  }

  /* ==========================================================================
     التوزيع على السطور — حفص وورش (قالب ثابت 15–16 سطراً متساوية الحواف)
     ========================================================================== */
  function layoutDP(page, W, rows, fT) {
    const items = [];
    page.segs.forEach(seg => {
      if (seg.kind === "head") items.push({ gap: "head", n: seg.n });
      else if (seg.kind === "bsm") items.push({ gap: "bsm", text: seg.text });
      else seg.tokens.forEach((t, i) => items.push({ t: t, seg: seg, end: i === seg.tokens.length - 1 }));
    });
    const n = items.length;
    const fam = FONT;
    const sp = spaceW(fam);
    const oval = rows === 8;
    const widths = lineWidths(rows, W);
    const w = items.map(it => (it.t ? measureTok(it.t.s, fam) : 0));
    const pre = [0];
    for (let i = 0; i < n; i++) pre.push(pre[i] + w[i]);
    const lineH = G.H / (oval ? 10 : rows);
    let cap = lineH * CAP;

    if (oval) {
      let g = 0;
      items.forEach(it => {
        if (it.gap === "bsm") {
          const tk = Q.tokenize(it.text);
          const nat = tk.reduce((a, t) => a + measure(t, fam), 0) + sp * SPF * (tk.length - 1);
          cap = Math.min(cap, 100 * widths[g] * 0.96 / nat);
        }
        if (it.gap) g++;
      });
    }

    let spf = SPF;

    function lineOK(i, j, lineNo, constrained) {
      if (!constrained) return true;
      for (let k = i; k < j; k++) {
        const t = items[k].t;
        const a = t.ls, b = t.le;
        if (a && b) { if (lineNo !== a && lineNo !== b) return false; }
        else if (a) { if (lineNo !== a) return false; }
        else if (b) { if (lineNo !== b) return false; }
      }
      return true;
    }

    function solve(f, constrained) {
      const INF = 1e18;
      const dp = [], from = [];
      for (let l = 0; l <= rows; l++) { dp.push(new Float64Array(n + 1).fill(INF)); from.push(new Int32Array(n + 1).fill(-1)); }
      dp[0][0] = 0;
      const k = f / 100;
      const allowTight = !oval;
      for (let l = 0; l < rows; l++) {
        const WL = widths[l];
        for (let i = 0; i < n; i++) {
          const base = dp[l][i];
          if (base >= INF) continue;
          if (items[i].gap) {
            if (dp[l + 1][i + 1] > base) { dp[l + 1][i + 1] = base; from[l + 1][i + 1] = i; }
            continue;
          }
          for (let j = i + 1; j <= n; j++) {
            if (items[j - 1].gap) break;
            const nat = (pre[j] - pre[i] + sp * spf * (j - i - 1)) * k;
            if (nat > WL * 0.985) break;
            if (!lineOK(i, j, l + 1, constrained)) continue;
            const wc = j - i;
            const slack = (WL - nat) / WL;
            /* منع بقاء كلمة منفردة أو سطر شبه فارغ في المنتصف أو الطرف */
            const orphanPen = (allowTight && wc < 2) ? 60 : (allowTight && slack > 0.35 ? 4 * slack * slack : 0);
            const c = base + slack * slack + orphanPen;
            if (dp[l + 1][j] > c) { dp[l + 1][j] = c; from[l + 1][j] = i; }
          }
        }
      }
      if (dp[rows][n] >= INF) return null;
      const path = [];
      let i = n;
      for (let l = rows; l > 0; l--) { const s = from[l][i]; path.push([s, i]); i = s; }
      path.reverse();
      return path;
    }

    function best(constrained) {
      let lo = 4, hi = cap;
      let p = solve(hi, constrained);
      if (p) return { f: hi, path: p, c: constrained };
      p = solve(lo, constrained);
      if (!p) return null;
      let bestF = lo, bestP = p;
      for (let it = 0; it < 16; it++) {
        const mid = (lo + hi) / 2;
        const q = solve(mid, constrained);
        if (q) { lo = mid; bestF = mid; bestP = q; } else hi = mid;
      }
      return { f: bestF, path: bestP, c: constrained };
    }

    const hasC = items.some(it => it.t && (it.t.ls || it.t.le));
    let res = hasC ? best(true) : best(false);
    let fell = false;
    if (!res && hasC) { res = best(false); fell = true; }
    if (!res) return null;
    if (fell) stats.fallback++;
    if (res.f < fT) {
      spf = 0.18;
      const r2 = best(res.c);
      if (r2 && r2.f > res.f) res = r2; else spf = SPF;
    }
    const fMax = res.f;

    const f = Math.min(fT, res.f);
    const path = f < res.f ? (solve(f, res.c) || res.path) : res.path;

    const lines = [];
    path.forEach(([s, e], idx) => {
      if (items[s].gap) { const g = items[s]; g.w = widths[idx]; lines.push(g); return; }
      const toks = items.slice(s, e).map(x => x.t.s);
      const vss = items.slice(s, e).map(x => x.t.vs);
      const words = pre[e] - pre[s], k = e - s;
      const L = { toks: toks, vss: vss, w: widths[idx], fs: f, center: k <= 1, k: k };
      if (!oval) {
        const ffit = 100 * widths[idx] / (words + sp * spf * Math.max(0, k - 1)) * 0.975;
        L.fs = Math.min(f, ffit);
      }
      lines.push(L);
    });
    return { f: f, fMax: fMax, lines: lines, constrainedFail: fell, sp: sp, oval: oval };
  }

  /* ==========================================================================
     التوزيع على السطور — الرسم المغربي
     ========================================================================== */
  async function layoutMA(page, W, rows, fT) {
    const raw = page.raw;
    const fam = FONT;
    const sp = spaceW(fam);
    const oval = rows === 8;
    const widths = lineWidths(rows, W);
    const lineH = G.H / (oval ? 10 : rows);
    let f = Math.min(lineH * CAP, fT);
    const out = [];
    let idx = 0, fMax = Infinity;
    for (const ln of raw.lines) {
      const wl = widths[Math.min(idx, rows - 1)];
      idx++;
      if (ln.is_surah_title === "1") {
        out.push({ head: await Q.maSurahByTitle(ln.surah_title_ar), w: wl });
        continue;
      }
      const toks = ln.words.map(x => ({
        s: String(x.text).replace(/[\u202A-\u202E]/g, "").replace(/\s+/g, " ").trim(),
        v: x.surah_number + ":" + x.verse.verse_number,
        m: x.is_last_word === "1" ? x.verse.verse_number : null
      })).filter(x => x.s);
      let nat = 0;
      toks.forEach((t, i) => { nat += measure(t.s, fam); if (t.m) nat += 112; if (i) nat += sp * SPF; });
      const L = { toks: toks, nat: nat, w: wl, fs: f, center: toks.length <= 1 };
      if (nat) {
        const fl = 100 * wl / nat * 0.975;
        fMax = Math.min(fMax, fl);
        L.fs = Math.min(f, fl);
      }
      out.push(L);
    }
    if (oval) {
      f = Math.min(f, fMax);
      out.forEach(L => {
        if (!L.nat) return;
        L.fs = f;
        L.center = L.toks.length <= 1;
      });
    }
    return { f: f, fMax: fMax, lines: out, sp: sp, oval: oval };
  }

  /* ==========================================================================
     بناء HTML الصفحة
     ========================================================================== */
  const nameCache = new Map();
  function nameImg(n, fs) {
    const theme = document.documentElement.dataset.theme || "light";
    const key = theme + "|" + n + "|" + Math.round(fs);
    if (nameCache.has(key)) return nameCache.get(key);
    const S = 4, px = Math.round(fs * S), code = Q.pad3(n);
    const c = document.createElement("canvas");
    const x = c.getContext("2d");
    x.font = px + 'px "surah-names"';
    const wd = Math.ceil(x.measureText(code).width) + px;
    c.width = wd; c.height = Math.ceil(px * 2.4);
    x.font = px + 'px "surah-names"';
    x.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1E4D3A";
    x.textAlign = "center"; x.textBaseline = "alphabetic";
    x.fillText(code, wd / 2, px * 1.5);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, x1 = -1, y0 = c.height, y1 = -1;
    for (let y = 0; y < c.height; y++) {
      for (let xx = 0; xx < c.width; xx++) {
        if (d[(y * c.width + xx) * 4 + 3] > 10) {
          if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    let res = null;
    if (x1 >= 0) {
      const o = document.createElement("canvas");
      o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
      o.getContext("2d").drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
      res = { src: o.toDataURL("image/png"), w: o.width / S, h: o.height / S };
    }
    if (!document.fonts || document.fonts.check('16px "surah-names"')) {
      nameCache.set(key, res);
    }
    return res;
  }

  function headHTML(n, lineH, boxW) {
    const bw = boxW || G.W;
    const fh = Math.min(lineH * 0.94, bw / FRAME_RATIO);
    let inner = "";
    const im = n ? nameImg(n, fh * 0.9) : null;
    if (im) {
      const k = Math.min(1, (bw * 0.5) / im.w, (fh * 0.7) / im.h);
      inner = '<img class="sn" alt="" src="' + im.src + '" style="width:' + (im.w * k) + "px;height:" + (im.h * k) + 'px">';
    }
    return '<div class="ln head" style="height:' + lineH + 'px;width:' + bw + 'px"><div class="sf" style="width:' + bw + "px;height:" + fh + 'px">' +
      '<img class="fr" src="' + IMG + 'surah_frame_brown.svg" alt="">' + inner + "</div></div>";
  }

  function pnumHTML(p) {
    const w = G.pw * 0.24;
    const h = w * 51.939 / 180.439;
    return '<div class="pnum" style="width:' + w + "px;height:" + h + "px;left:" + G.side + "px;bottom:" + Math.max(4, Math.round(G.ph * 0.01)) + 'px">' +
      '<img src="' + IMG + 'page_frame_box_brown.svg" alt=""><span style="font-size:' + (h * 0.5) + 'px">' + Q.ar(Q.showPage(r, p)) + "</span></div>";
  }

  function markerHTML(num, f) {
    const s = String(num);
    const isHafsOrWarsh = (r === "hafs" || r === "warsh");
    const sc = isHafsOrWarsh ? 1.25 : 1.0;
    const fs = f * (s.length === 1 ? 0.52 : s.length === 2 ? 0.44 : 0.36) * sc;
    return '<i class="av" style="width:' + (f * 0.97 * sc) + "px;height:" + (f * 1.25 * sc) + "px;margin-inline-start:" + (f * 0.12) + 'px">' +
      '<img src="' + IMG + 'ayah_frame_brown.svg" alt=""><b style="font-size:' + fs + 'px">' + Q.ar(s) + "</b></i>";
  }

  function tokHTML(t) {
    const m = t.match(/^([\s\S]*?)(\u00A0[\u0660-\u0669]+|\u00A0?[\uFB50-\uFDFF]+)$/);
    return m ? Q.esc(m[1]) + '<span class="an">' + Q.esc(m[2]) + "</span>" : Q.esc(t);
  }

  async function buildPage(p) {
    const data = await Q.getPage(r, p);
    if (!data) return null;
    const rows = data.rows;
    const lineH = G.H / (rows === 8 ? 10 : rows);
    const boxW = rows === 8 ? Math.min(G.W, 420) : G.W;
    const fT = rows === 8 ? K[r] * Math.min(boxW, G.W * 0.88) : K[r] * boxW;
    let lay, body = "";

    if (r === "warsh_ma") lay = await layoutMA(data, G.W, rows, fT);
    else lay = layoutDP(data, G.W, rows, fT);

    if (!lay) {
      body = '<div class="miss">تعذّر ترتيب هذه الصفحة</div>';
    } else {
      stats.pages++;
      stats.fmin = Math.min(stats.fmin, lay.f); stats.fmax = Math.max(stats.fmax, lay.f);
      const f = lay.f;
      for (const L of lay.lines) {
        if (L.gap === "head" || L.head !== undefined) {
          body += headHTML(L.n || L.head, lineH, boxW);
          continue;
        }
        const lf = L.fs || f;
        const style = "height:" + lineH + "px;line-height:" + lineH + "px;width:" + (L.w || boxW) + "px;font-size:" + lf + "px;";
        if (L.gap === "bsm") {
          const bsmBody = rows === 8
            ? Q.tokenize(L.text).map(w => '<span class="t">' + Q.esc(w) + "</span>").join(" ")
            : '<span class="t">' + Q.esc(L.text) + "</span>";
          body += '<div class="ln' + (rows === 8 ? "" : " bsm") + '" style="' + style + '">' + bsmBody + "</div>";
          continue;
        }
        const toks = L.toks.map((t, i) => {
          if (typeof t === "string") return '<span class="t"' + (L.vss && L.vss[i] ? ' data-v="' + L.vss[i] + '"' : "") + ">" + tokHTML(t) + "</span>";
          return '<span class="t" data-v="' + t.v + '">' + Q.esc(t.s) + (t.m ? markerHTML(t.m, lf) : "") + "</span>";
        }).join(" ");
        body += '<div class="ln' + (L.center ? " ctr" : "") + '" style="' + style + '">' + toks + "</div>";
      }
    }
    const usedRows = (rows !== 8 && lay && lay.lines.length > 0 && lay.lines.length < rows) ? lay.lines.length : rows;
    const bodyH = usedRows < rows ? Math.round(usedRows * lineH) : G.H;
    const paperH = usedRows < rows ? (G.top + bodyH + G.bottom) : G.ph;
    const fam = r === "hafs" ? "hafs" : r === "warsh" ? "warsh" : "maghribi";
    const inner = '<div class="mbody' + (rows === 8 ? " short" : "") + '" style="top:' + G.top + "px;left:" + G.side + "px;right:" + G.side + "px;" +
      "height:" + bodyH + 'px;font-family:var(--font-' + fam + ')">' + body + "</div>";
    return '<div class="paper page-container" style="width:' + G.pw + "px;height:" + paperH + 'px">' + inner + pnumHTML(p) + "</div>";
  }

  /* ---------- عرض صفحة داخل قسمها ---------- */
  function sectionOf(p) { return pager.children[p - ED.first]; }

  async function ensure(p) {
    if (p < ED.first || p > ED.last) return;
    const sec = sectionOf(p);
    if (!sec) return;
    if (sec.dataset.ep === String(epoch) && sec.dataset.done === "1") return;
    if (rendering.has(p)) return rendering.get(p);
    const my = epoch;
    const job = (async () => {
      let h = html.get(p);
      try {
        if (!h) {
          h = await buildPage(p);
          if (my === epoch) html.set(p, h);
        }
      } catch (e) {
        h = '<div class="paper page-container" style="width:' + G.pw + "px;height:" + G.ph + 'px"><div class="miss">هذه الصفحة غير متوفرة بعد</div></div>';
      }
      if (my !== epoch) return;
      sec.innerHTML = h || "";
      /* ضمان بقاء كل سطر مبرراً في سطر واحد دون انكسار */
      sec.querySelectorAll(".ln:not(.head):not(.bsm):not(.ctr)").forEach(ln => {
        let fs = parseFloat(ln.style.fontSize);
        let tries = 0;
        while (ln.scrollHeight > ln.clientHeight + 2 && fs > 7 && tries++ < 8) {
          fs *= 0.96;
          ln.style.fontSize = fs.toFixed(2) + "px";
        }
      });
      paintMarks(sec);
      paintAudio(sec);
      sec.dataset.ep = String(epoch);
      sec.dataset.done = "1";
      sec.classList.add("ready");
    })().finally(() => rendering.delete(p));
    rendering.set(p, job);
    return job;
  }

  function unmount(p) {
    const sec = sectionOf(p);
    if (sec && sec.dataset.done === "1") { sec.innerHTML = ""; sec.dataset.done = ""; sec.classList.remove("ready"); }
  }

  function around(p) {
    for (let q = p - 1; q <= p + 1; q++) ensure(q);
    pager.querySelectorAll(".pg.ready").forEach(sec => { if (Math.abs(+sec.dataset.p - p) > 3) unmount(+sec.dataset.p); });
  }

  /* ---------- شريط الأعلى ومعلومات الصفحة ---------- */
  const elTitle = document.getElementById("barTitle");
  const elSub = document.getElementById("barSub");
  const elRw = document.getElementById("barRiwaya");
  if (elRw) elRw.textContent = ED.name;

  async function updateBar(p) {
    const list = await Q.surahs(r);
    const pg = await Q.getPage(r, p);
    let startsTop = false;
    if (pg.raw) startsTop = !!(pg.raw.lines[0] && pg.raw.lines[0].is_surah_title === "1");
    else startsTop = !!(pg.segs && pg.segs[0] && pg.segs[0].kind === "head");
    const here = list.filter(x => x.page === p).sort((x, y) => x.n - y.n);
    const names = [];
    if (!startsTop || !here.length) {
      const c = await Q.surahAtPage(r, here.length ? p - 1 : p);
      if (c && !here.includes(c)) names.push(c);
    }
    here.forEach(x => names.push(x));
    if (pg.raw) {
      for (const ln of pg.raw.lines) {
        if (ln.is_surah_title !== "1") continue;
        const n = await Q.maSurahByTitle(ln.surah_title_ar);
        const x = list.find(y => y.n === n);
        if (x && !names.includes(x)) names.push(x);
      }
    }
    const s = names[0] || (await Q.surahAtPage(r, p));
    elTitle.textContent = names.length > 1 ? names.map(x => x.ar).join(" · ") : "سورة " + s.ar;
    elTitle.style.fontSize = names.length > 2 ? "13px" : names.length > 1 ? "15px" : "";
    elSub.textContent = "الجزء " + Q.ar(s.juz) + " · ص " + Q.ar(Q.showPage(r, p));
    return s;
  }

  let saveTimer = null;
  let lastPageSurah = null;
  function flushLastSave(p) {
    if (!p || p < ED.first || p > ED.last) return;
    if (lastPageSurah && lastPageSurah.p === p) {
      Q.saveLast(r, p, lastPageSurah.n, lastPageSurah.ar, lastPageSurah.juz);
      return;
    }
    const prev = Q.lastRead();
    Q.saveLast(r, p, prev && prev.r === r ? prev.s : 0, prev && prev.r === r ? prev.name : "", prev && prev.r === r ? prev.juz : 0);
  }
  function setCurrent(p) {
    if (p < ED.first || p > ED.last || p === cur) return;
    cur = p;
    around(p);
    flushLastSave(p);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const s = await updateBar(p);
      if (s) {
        lastPageSurah = { p: p, n: s.n, ar: s.ar, juz: s.juz };
        Q.saveLast(r, p, s.n, s.ar, s.juz);
      }
      history.replaceState(history.state, "", "page.html?r=" + r + "&p=" + p);
    }, 180);
    updateBar(p);
  }

  let programmaticUntil = 0;
  function goTo(p, smooth) {
    p = Math.max(ED.first, Math.min(ED.last, p));
    programmaticUntil = Date.now() + (smooth ? 550 : 120);
    const sec = sectionOf(p);
    if (sec) sec.scrollIntoView({ behavior: smooth ? "smooth" : "instant", inline: "center", block: "nearest" });
    setCurrent(p);
  }

  /* ---------- الإنشاء الأول ---------- */
  function build() {
    pager.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let p = ED.first; p <= ED.last; p++) {
      const s = document.createElement("section");
      s.className = "pg";
      s.dataset.p = p;
      frag.appendChild(s);
    }
    pager.appendChild(frag);
  }

  let io = null;
  function syncCurrentFromScroll() {
    if (Date.now() < programmaticUntil) return;
    const pw = pager.clientWidth || 1;
    const mid = pager.getBoundingClientRect().left + pager.clientWidth / 2;
    let bestP = cur, bestDist = Infinity;
    pager.querySelectorAll(".pg").forEach(sec => {
      const b = sec.getBoundingClientRect();
      const d = Math.abs((b.left + b.width / 2) - mid);
      if (d < bestDist) { bestDist = d; bestP = +sec.dataset.p; }
    });
    if (bestP >= ED.first && bestDist < pw * 0.6) setCurrent(bestP);
  }
  function observe() {
    if (io) io.disconnect();
    io = new IntersectionObserver(es => {
      if (Date.now() < programmaticUntil) return;
      es.forEach(e => { if (e.isIntersecting) setCurrent(+e.target.dataset.p); });
    }, { root: pager, threshold: 0.6 });
    Array.prototype.forEach.call(pager.children, s => io.observe(s));
    let stScroll = 0;
    pager.addEventListener("scroll", e => {
      scrollStamp = Date.now();
      if (e.target === pager) {
        clearTimeout(stScroll);
        stScroll = setTimeout(syncCurrentFromScroll, 120);
      }
    }, { capture: true, passive: true });
  }

  /* ---------- السحب بالفأرة (اللمس يعمل أصلًا) ---------- */
  let dragMoved = false;
  function mouseDrag() {
    let mdown = false, sx = 0, sy = 0, ss = 0, moved = false;
    pager.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      mdown = true; moved = false; dragMoved = false; sx = e.clientX; sy = e.clientY; ss = pager.scrollLeft;
    });
    window.addEventListener("pointermove", e => {
      if (!mdown) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!moved && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 6) {
        mdown = false;
        return;
      }
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        dragMoved = true;
        pager.style.scrollSnapType = "none";
        pager.classList.add("drag");
      }
      if (moved) pager.scrollLeft = ss - dx;
    });
    window.addEventListener("pointerup", e => {
      if (!mdown) return;
      mdown = false;
      pager.classList.remove("drag");
      if (!moved) return;
      pager.dataset.moved = "1";
      const dx = e.clientX - sx;
      let target = cur;
      if (Math.abs(dx) > 40) target = dx > 0 ? cur + 1 : cur - 1;
      goTo(target, true);
      setTimeout(() => { pager.style.scrollSnapType = ""; pager.dataset.moved = ""; dragMoved = false; }, 450);
    });
  }

  /* ---------- منع النقرة الوهمية بعد رفع الإصبع من إغلاق النافذة فورًا ---------- */
  let suppressClickUntil = 0;
  let bmOpenedAt = 0;
  let vsOpenedAt = 0;
  document.addEventListener("click", e => {
    if (Date.now() < suppressClickUntil) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickUntil = 0;
    }
  }, true);

  /* ---------- العلامات المرجعية: ضغطة مطوّلة على الآية ---------- */
  let bmDraft = null;
  const sheet = document.getElementById("bmSheet");
  function paintMarks(root) {
    const map = {};
    Q.bms().forEach(b => { if (b.r === r) map[b.v] = b.color; });
    (root || pager).querySelectorAll(".t[data-v]").forEach(el => {
      const c = map[el.dataset.v];
      if (c) { el.classList.add("bm"); el.style.setProperty("--bm", Q.bmColor(c)); }
      else { el.classList.remove("bm"); el.style.removeProperty("--bm"); }
    });
  }
  async function openBm(v, p) {
    const [sn, an] = v.split(":").map(Number);
    const ex = Q.bmFind(r, v);
    bmDraft = { r: r, v: v, p: p, surah: sn, aya: an, sname: "", juz: 0, color: ex ? ex.color : "olive", exists: !!ex };
    document.getElementById("bmWhere").textContent = "الآية " + Q.ar(an) + " · ص " + Q.ar(Q.showPage(r, p));
    const nm = document.getElementById("bmName");
    nm.value = ex ? ex.name : "";
    nm.placeholder = "الآية " + Q.ar(an);
    document.getElementById("bmDel").hidden = !ex;
    document.getElementById("bmTitle").textContent = ex ? "تعديل العلامة" : "علامة مرجعية جديدة";
    drawColors();
    bmOpenedAt = Date.now();
    sheet.classList.add("show");

    const list = await Q.surahs(r);
    const s = list.find(x => x.n === sn);
    if (bmDraft && bmDraft.v === v && s) {
      bmDraft.sname = s.ar;
      bmDraft.juz = s.juz;
      document.getElementById("bmWhere").textContent = "سورة " + s.ar + " · الآية " + Q.ar(an) + " · ص " + Q.ar(Q.showPage(r, p));
      if (!ex) nm.placeholder = s.ar + " ـ " + Q.ar(an);
    }
  }
  const bmColorsEl = document.getElementById("bmColors");
  function drawColors() {
    if (!bmColorsEl || !bmDraft) return;
    bmColorsEl.innerHTML = Q.BM_COLORS.map(c =>
      '<button type="button" class="sw' + (c.id === bmDraft.color ? " on" : "") + '" data-c="' + c.id + '" style="--c:' + c.hex + '" aria-label="' + c.name + '"></button>').join("");
  }
  if (bmColorsEl) {
    bmColorsEl.addEventListener("click", e => {
      const b = e.target.closest("[data-c]");
      if (!b || !bmDraft) return;
      bmDraft.color = b.dataset.c; drawColors();
    });
  }
  window.closeBm = function () { if (sheet) sheet.classList.remove("show"); bmDraft = null; };
  window.saveBm = function () {
    if (!bmDraft) return;
    const nmEl = document.getElementById("bmName");
    const nm = nmEl ? nmEl.value.trim() : "";
    Q.bmPut({ r: bmDraft.r, v: bmDraft.v, p: bmDraft.p, surah: bmDraft.surah, aya: bmDraft.aya, sname: bmDraft.sname, juz: bmDraft.juz,
      name: nm || ((bmDraft.sname ? bmDraft.sname + " ـ " : "الآية ") + Q.ar(bmDraft.aya)), color: bmDraft.color, ts: Date.now() });
    closeBm(); paintMarks();
  };
  window.delBm = function () {
    if (!bmDraft) return;
    Q.bmDel(bmDraft.r, bmDraft.v); closeBm(); paintMarks();
  };
  if (sheet) {
    sheet.addEventListener("click", e => {
      if (e.target === sheet && Date.now() - bmOpenedAt > 350) closeBm();
    });
  }

  let scrollStamp = 0;
  function modalOpen() { return !!document.querySelector(".modal.show"); }

  /* ---------- النقر: آية = قائمة الآية، خارج النص = إخفاء الشريط ---------- */
  QTafsir.onBookmark = (v, p) => openBm(v, p);
  let down = null;

  function nearestToken(x, y) {
    const el = document.elementFromPoint(x, y);
    const direct = el && el.closest(".t[data-v]");
    if (direct) return direct;
    /* نقرة داخل إطار اسم السورة أو رقم الصفحة أو البسملة لا تُعدّ نقرة آية */
    if (el && el.closest(".sf, .pnum, .ln.head, .ln.bsm")) return null;

    const sec = (el && el.closest("section.pg")) || sectionOf(cur);
    if (!sec) return null;

    /* إذا كانت النقرة داخل حدود سطر الآية (في الفراغ الضيق بين الكلمات) */
    const lines = sec.querySelectorAll(".ln:not(.head):not(.bsm)");
    for (let i = 0; i < lines.length; i++) {
      const lb = lines[i].getBoundingClientRect();
      if (y >= lb.top - 4 && y <= lb.bottom + 4 && x >= lb.left - 8 && x <= lb.right + 8) {
        let bestInLine = null, bd = 18;
        lines[i].querySelectorAll(".t[data-v]").forEach(t => {
          const b = t.getBoundingClientRect();
          const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
          if (dx <= bd) { bd = dx; bestInLine = t; }
        });
        if (bestInLine) return bestInLine;
      }
    }
    return null;
  }
  function lit(v, on) {
    document.querySelectorAll('.t[data-v="' + v + '"]').forEach(n => n.classList.toggle("tsel", on));
  }
  function handleTap(x, y) {
    const t = nearestToken(x, y);
    if (!t) return;
    suppressClickUntil = Date.now() + 450;
    const sec = t.closest("section");
    openVs(t.dataset.v, sec ? +sec.dataset.p : cur);
  }
  pager.addEventListener("pointerdown", e => {
    pager.dataset.moved = "";
    if (modalOpen() || (e.pointerType === "mouse" && e.button !== 0)) { down = null; return; }
    down = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId, moved: false };
  });
  pager.addEventListener("pointermove", e => {
    if (!down || down.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
  });
  pager.addEventListener("pointerup", e => {
    const d = down; down = null;
    if (!d || d.id !== e.pointerId || modalOpen()) return;
    if (d.moved || dragMoved || pager.dataset.moved === "1" || Date.now() - scrollStamp < 240) {
      pager.dataset.moved = "";
      return;
    }
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || Date.now() - d.t > 600) return;
    handleTap(e.clientX, e.clientY);
  });
  pager.addEventListener("pointercancel", () => { down = null; });
  window.addEventListener("pagehide", () => {
    flushLastSave(cur);
    document.querySelectorAll(".t.tsel").forEach(n => n.classList.remove("tsel"));
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushLastSave(cur);
  });

  /* ---------- قائمة الآية + التلاوة ومنتقي القارئ المخصّص ---------- */
  const $ = id => document.getElementById(id);
  function ensureRecPickerDOM() {
    if ($("vsRecBtn")) return;
    const legacy = $("vsRec");
    const host = (legacy && legacy.parentElement) || document.querySelector('.vs-pg[data-k="au"]');
    if (!host) return;
    const box = document.createElement("div");
    box.id = "vsRecBox";
    box.className = "rec-box";
    box.innerHTML =
      '<button id="vsRecBtn" type="button" class="rec-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="vsRecDrop">' +
        '<span class="rec-btn-info">' +
          '<span id="vsRecName" class="rec-btn-name">جارٍ جلب القرّاء…</span>' +
          '<span id="vsRecSub" class="rec-btn-sub"></span>' +
        '</span>' +
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M6 9l6 6 6-6" /></svg>' +
      '</button>' +
      '<div id="vsRecDrop" class="rec-drop" hidden>' +
        '<div id="vsRecSearchWrap" class="rec-search-wrap" hidden>' +
          '<input id="vsRecSearch" class="rec-search" type="search" placeholder="ابحث عن قارئ…" autocomplete="off">' +
        '</div>' +
        '<div id="vsRecList" class="rec-list" role="listbox" aria-label="اختيار القارئ"></div>' +
      '</div>';
    if (legacy) {
      legacy.replaceWith(box);
    } else {
      const noteEl = $("vsNote") || $("vsPlay");
      host.insertBefore(box, noteEl || null);
    }
  }
  ensureRecPickerDOM();

  const vsSheet = $("vsSheet"), vsPages = $("vsPages");
  const recBox = $("vsRecBox"), recBtn = $("vsRecBtn"), recDrop = $("vsRecDrop");
  const recName = $("vsRecName"), recSub = $("vsRecSub");
  const recSearchWrap = $("vsRecSearchWrap"), recSearch = $("vsRecSearch"), recListEl = $("vsRecList");
  let vs = null, recList = [], mineList = [], timedSet = { has: () => false }, selectedMid = "";
  const ICO_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>';
  const ICO_PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>';
  const ICO_CHK = '<svg class="rec-opt-chk" viewBox="0 0 24 24" fill="none" stroke-width="2.4"><path d="M5 13l4 4L19 7" /></svg>';
  const normRec = x => String(x || "").replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();

  function setRecOpen(on) {
    if (!recBox || !recDrop || !recBtn) return;
    recDrop.hidden = !on;
    recBox.classList.toggle("open", on);
    recBtn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on && recListEl) {
      const act = recListEl.querySelector(".rec-opt.on");
      if (act) act.scrollIntoView({ block: "nearest" });
    }
  }
  function updateRecHeader() {
    const rc = mineList.find(x => String(x.mid) === selectedMid) || mineList[0];
    const noteEl = $("vsNote");
    if (!rc) {
      if (recName) recName.textContent = "لا يوجد قارئ متاح";
      if (recSub) recSub.textContent = "";
      if (noteEl) noteEl.textContent = "";
      return;
    }
    selectedMid = String(rc.mid);
    if (recName) recName.textContent = rc.name;
    if (recSub) recSub.textContent = (rc.mname ? rc.mname + " · " : "") + (timedSet.has(rc) ? "تتبّع دقيق" : "تتبّع متزامن");
    if (noteEl) {
      noteEl.textContent = timedSet.has(rc)
        ? "يتتبّع هذا القارئ الآيات بدقة تامة أثناء التلاوة"
        : "تتبّع وتظليل متزامن للآيات أثناء التلاوة";
    }
  }
  function renderRecOpts(query) {
    if (!recListEl) return;
    const q = normRec(query).trim();
    const rows = q ? mineList.filter(x => normRec(x.name + " " + (x.mname || "")).includes(q)) : mineList;
    if (!rows.length) {
      recListEl.innerHTML = '<div class="rec-empty">لا يوجد قارئ مطابق</div>';
      return;
    }
    recListEl.innerHTML = rows.map(x => {
      const on = String(x.mid) === selectedMid;
      const sub = (x.mname ? x.mname + " · " : "") + (timedSet.has(x) ? "تتبّع دقيق" : "متزامن");
      return '<button type="button" role="option" aria-selected="' + (on ? "true" : "false") + '" class="rec-opt' + (on ? " on" : "") + '" data-mid="' + x.mid + '">' +
        '<span class="rec-opt-txt"><span class="rec-opt-n">' + Q.esc(x.name) + '</span><span class="rec-opt-m">' + Q.esc(sub) + "</span></span>" +
        ICO_CHK + "</button>";
    }).join("");
  }
  if (recBtn && recDrop) {
    recBtn.addEventListener("click", () => {
      if (!mineList.length) return;
      setRecOpen(recDrop.hidden);
    });
  }
  if (recSearch) recSearch.addEventListener("input", () => renderRecOpts(recSearch.value));
  if (recListEl) {
    recListEl.addEventListener("click", e => {
      const opt = e.target.closest("[data-mid]");
      if (!opt) return;
      selectedMid = String(opt.dataset.mid);
      QAudio.setChoice(r, selectedMid);
      updateRecHeader();
      renderRecOpts(recSearch ? recSearch.value : "");
      setRecOpen(false);
    });
  }

  async function openVs(v, p) {
    if (!vsSheet) return;
    const [s, a] = v.split(":").map(Number);
    if (vs) lit(vs.v, false);
    vs = { v: v, p: p, s: s, a: a, sname: "", total: a };
    lit(v, true);
    if ($("vsWhere")) $("vsWhere").textContent = "الآية " + Q.ar(a);
    if ($("vsBmNote")) $("vsBmNote").textContent = Q.bmFind(r, v) ? "هذه الآية عليها علامة، يمكنك تعديلها أو حذفها" : "احفظ موضعك في هذه الآية باسم ولون";
    setRecOpen(false);
    if (vsPages) { vsPages.scrollLeft = 0; dots(); }
    vsOpenedAt = Date.now();
    vsSheet.classList.add("show");
    fillReciters();

    const list = await Q.surahs(r), sl = list.find(x => x.n === s);
    if (vs && vs.v === v) {
      vs.sname = sl ? sl.ar : "";
      vs.total = sl ? sl.aya : a;
      if ($("vsWhere")) $("vsWhere").textContent = (vs.sname ? "سورة " + vs.sname + " · " : "") + "الآية " + Q.ar(a);
    }
    if (sl) {
      lastPageSurah = { p: p, n: sl.n, ar: sl.ar, juz: sl.juz };
      Q.saveLast(r, p, sl.n, sl.ar, sl.juz, a);
    }
  }
  function closeVs() { setRecOpen(false); if (vsSheet) vsSheet.classList.remove("show"); if (vs) lit(vs.v, false); }
  if (vsSheet) {
    vsSheet.addEventListener("click", e => {
      if (e.target === vsSheet && Date.now() - vsOpenedAt > 350) closeVs();
    });
  }
  function dots() {
    if (!vsPages) return;
    const w = vsPages.clientWidth || 1, i = Math.min(2, Math.round(Math.abs(vsPages.scrollLeft) / w));
    document.querySelectorAll("#vsDots i").forEach((d, k) => d.classList.toggle("on", k === i));
  }
  if (vsPages) vsPages.addEventListener("scroll", dots, { passive: true });

  async function fillReciters() {
    const curVs = vs;
    if (!curVs) return;
    const note = $("vsNote"), btn = $("vsPlay");
    if (btn) btn.disabled = true;
    if (note) note.textContent = "جارٍ جلب القرّاء…";
    if (recName) recName.textContent = "جارٍ جلب القرّاء…";
    if (recSub) recSub.textContent = "";
    if (recListEl) recListEl.innerHTML = "";
    if (recSearch) recSearch.value = "";
    if (recSearchWrap) recSearchWrap.hidden = true;
    setRecOpen(false);
    try {
      const [list, timed] = await Promise.all([QAudio.reciters(r), QAudio.timedReads(r)]);
      if (!vs || vs.v !== curVs.v) return;
      recList = list;
      timedSet = timed;
      mineList = recList.filter(x => x.surahs.includes(curVs.s));
      if (!mineList.length) {
        if (recName) recName.textContent = "لا يوجد قارئ لهذه السورة";
        if (note) note.textContent = "لا يوجد قارئ لهذه السورة في هذه الرواية";
        return;
      }
      mineList.sort((a, b) => (timedSet.has(b) ? 1 : 0) - (timedSet.has(a) ? 1 : 0));
      const saved = QAudio.choice(r);
      selectedMid = mineList.some(x => String(x.mid) === saved) ? saved : String(mineList[0].mid);
      if (recSearchWrap) recSearchWrap.hidden = mineList.length <= 8;
      updateRecHeader();
      renderRecOpts("");
      if (btn) btn.disabled = false;
    } catch (e) {
      if (recName) recName.textContent = "تعذّر جلب القرّاء";
      if (note) note.textContent = "تعذّر جلب القرّاء، يلزم اتصال بالإنترنت أول مرة";
    }
  }

  window.vsDo = async function (k) {
    if (!vs) return;
    const cur0 = vs;
    if (k === "tf") { QTafsir.open(r, cur0.v, cur0.p); closeVs(); }
    else if (k === "bm") { openBm(cur0.v, cur0.p); closeVs(); }
    else if (k === "au") {
      const rc = mineList.find(x => String(x.mid) === selectedMid) || recList.find(x => String(x.mid) === selectedMid);
      if (!rc) return;
      QAudio.setChoice(r, rc.mid);
      $("vsNote").textContent = "جارٍ التشغيل…";
      try {
        await QAudio.play({ r: r, s: cur0.s, a: cur0.a, sname: cur0.sname, total: cur0.total, rc: rc });
        closeVs();
      } catch (e) { $("vsNote").textContent = "تعذّر التشغيل، تأكد من الاتصال أو جرّب قارئًا آخر"; }
    }
  };

  /* شريط التشغيل وتظليل الآية الجارية */
  function clearAud() { document.querySelectorAll(".t.aud").forEach(n => n.classList.remove("aud")); }
  function paintAudio(root) {
    const st = QAudio.state();
    if (!st) return;
    const v = st.s + ":" + st.a;
    (root || pager).querySelectorAll('.t[data-v="' + v + '"]').forEach(n => n.classList.add("aud"));
  }
  async function follow(s, a) {
    let toks = document.querySelectorAll('.t[data-v="' + s + ":" + a + '"]');
    if (!toks.length) {
      const targetP = await Q.pageOfVerse(r, s, a);
      const stNow = QAudio.state();
      if (!stNow || stNow.s !== s || stNow.a !== a) return;
      if (targetP && targetP !== cur) {
        goTo(targetP, true);
      }
      await ensure(targetP);
      if (targetP > ED.first) await ensure(targetP - 1);
      toks = document.querySelectorAll('.t[data-v="' + s + ":" + a + '"]');
    }
    clearAud();
    if (toks.length) {
      toks.forEach(n => n.classList.add("aud"));
      const sec = toks[0].closest("section"), p = sec ? +sec.dataset.p : cur;
      if (p !== cur) goTo(p, true);
    }
  }
  QAudio.onVerse = (s, a) => follow(s, a);
  QAudio.onStop = () => clearAud();
  QAudio.onError = () => { if ($("qaSub")) $("qaSub").textContent = "تعذّر تحميل الصوت"; };
  document.addEventListener("qaudio", e => {
    const st = e.detail, bar = $("qaBar");
    if (!bar) return;
    bar.hidden = !st;
    if (!st) return;
    if ($("qaTitle")) $("qaTitle").textContent = "سورة " + st.sname + " · الآية " + Q.ar(st.a);
    const modeLabel = st.timingMode === "exact" ? " · تتبّع دقيق للآيات" : st.hasTiming ? " · تتبّع متزامن للآيات" : " · جارٍ المزامنة…";
    if ($("qaSub")) $("qaSub").textContent = st.name + modeLabel;
    if ($("qaToggle")) $("qaToggle").innerHTML = st.playing ? ICO_PAUSE : ICO_PLAY;
  });
  if ($("qaToggle")) $("qaToggle").addEventListener("click", () => QAudio.toggle());
  if ($("qaStop")) $("qaStop").addEventListener("click", () => QAudio.stop());
  if ($("qaNext")) $("qaNext").addEventListener("click", () => QAudio.step(1));
  if ($("qaPrev")) $("qaPrev").addEventListener("click", () => QAudio.step(-1));

  /* ---------- لوحة المفاتيح ---------- */
  document.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") goTo(cur + 1, true);       /* في الكتاب العربي اليسار = التالي */
    else if (e.key === "ArrowRight") goTo(cur - 1, true);
  });

  /* ---------- الإعدادات: تغيير الرواية ---------- */
  window.pickRiwaya = async function (id) {
    if (!Q.EDITIONS[id] || id === r) { closeSettings(); return; }
    const s = await Q.surahAtPage(r, cur);
    Q.choose(id);
    go("page.html?r=" + id + (s ? "&s=" + s.n : ""), true);
  };

  /* ---------- البدء ---------- */
  async function start() {
    const veil = document.getElementById("veil");
    try {
      await Promise.all([
        document.fonts.load('100px "' + FONT + '"', "بسم الله"),
        document.fonts.load('100px "surah-names"', "001"),
        document.fonts.load('20px "amiri"', "١٢٣")
      ]);
      await document.fonts.ready;
    } catch (e) { /* نكمل */ }

    G = geom();
    let startP = parseInt(params.get("p"), 10);
    if (!startP) {
      const sn = parseInt(params.get("s"), 10);
      if (sn) startP = await Q.pageOfSurah(r, sn);
      else { const lr = Q.lastRead(); startP = lr && lr.r === r ? lr.p : ED.first; }
    }
    startP = Math.max(ED.first, Math.min(ED.last, startP || ED.first));

    build();
    observe();
    cur = -1;
    goTo(startP, false);
    setCurrent(startP);
    await ensure(startP);
    if (veil) veil.classList.add("hide");
    mouseDrag();
    Q.markPills();
    window.__ready = true;
  }

  /* ---------- ResizeObserver: ربط التحجيم بعرض الحاوية الفعلي ---------- */
  let rt = null;
  function relayout() {
    if (!G) return;
    const n = geom();
    if (n.pw === G.pw && n.ph === G.ph) return;
    G = n; epoch++; html.clear(); rendering.clear();
    const keep = cur; cur = -1;
    Array.prototype.forEach.call(pager.children, s => { s.innerHTML = ""; s.dataset.done = ""; s.classList.remove("ready"); });
    goTo(keep, false);
    setCurrent(keep);
  }
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      clearTimeout(rt);
      rt = setTimeout(relayout, 120);
    });
    ro.observe(pager);
  } else {
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(relayout, 160);
    });
  }

  /* ---------- تغيّر السمة ---------- */
  document.addEventListener("qatr-theme", () => {
    nameCache.clear();
    epoch++; html.clear(); rendering.clear();
    Array.prototype.forEach.call(pager.children, s => { s.innerHTML = ""; s.dataset.done = ""; s.classList.remove("ready"); });
    around(cur > 0 ? cur : ED.first);
  });

  /* ---------- أدوات الاختبار ---------- */
  window.__qtest = {
    layout: async function (p, fT) {
      G = G || geom();
      const d = await Q.getPage(r, p);
      const boxW = d && d.rows === 8 ? Math.min(G.W, 420) : G.W;
      const ft = fT === undefined ? (d && d.rows === 8 ? K[r] * Math.min(boxW, G.W * 0.88) : K[r] * boxW) : fT;
      return r === "warsh_ma" ? layoutMA(d, G.W, d.rows, ft) : layoutDP(d, G.W, d.rows, ft);
    },
    K: K, measure: measure, FONT: FONT, geom: () => G, ED: ED
  };

  start();
})();
