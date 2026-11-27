/* ==========================================================================
   قطر الندى — quran/page.js
   صفحة عرض المصحف: صفحات تُسحب يمينًا ويسارًا بلا أزرار، وسطور موزّعة
   كما في المصحف المطبوع.
   ========================================================================== */
(function () {
  "use strict";

  const IMG = "../assets/img/";
  const FRAME_RATIO = 1040.5 / 118.5;      /* نسبة عرض إطار السورة إلى ارتفاعه */
  const BAR_H = 56;
  const SPF = 0.55;                        /* أقل مسافة بين الكلمات نسبةً إلى المسافة الطبيعية: تسمح بحجم خط واحد لكل الصفحات */
  const CAP = 0.64;                        /* أقصى حجم خط نسبة إلى ارتفاع السطر */
  /* حجم الخط (نسبة إلى عرض السطر) واحد في كل صفحات الرواية، بما فيها الفاتحة وأول البقرة.
     أضيق الصفحات كلمًا فقط تنزل عنه قليلًا حتى تتسع. */
  const K = { hafs: 0.0517, warsh: 0.0491, warsh_ma: 0.0651 };

  /* ---------- حالة ---------- */
  const params = new URLSearchParams(location.search);
  let r = params.get("r");
  if (!Q.EDITIONS[r]) r = Q.riwaya();
  if (params.get("r") && Q.EDITIONS[params.get("r")]) Q.choose(r);
  if (!Q.chosen() && !params.get("r")) { go("index.html"); return; }

  const ED = Q.EDITIONS[r];
  const FONT = ED.font;
  const pager = document.getElementById("pager");
  const stats = (window.__stats = { fallback: 0, pages: 0, fmin: 999, fmax: 0, rendered: {} });

  let G = null;               /* الأبعاد */
  let cur = 0;                /* الصفحة الحالية */
  const html = new Map();     /* صفحة -> HTML جاهز */
  const rendering = new Map();/* صفحة -> وعد قيد التنفيذ */
  let epoch = 0;              /* يتغير عند تغيّر المقاس */

  /* ---------- الأبعاد ---------- */
  function geom() {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const availH = vh - BAR_H - 8;
    let pw = Math.min(vw, 560);
    let ph = Math.min(availH, pw / 0.5);
    if (pw / ph > 0.5625) pw = ph * 0.5625;
    pw = Math.floor(pw); ph = Math.floor(ph);
    const side = pw * 0.035;
    const top = ph * 0.02, bottom = ph * 0.085;
    return { vw, vh, pw, ph, side, top, bottom, W: pw - 2 * side, H: ph - top - bottom };
  }

  /* صفحات الفاتحة وأول البقرة: السطور على هيئة بيضة، قصيرة في الطرفين وأعرض في الوسط */
  function lineWidths(rows, W) {
    const w = [];
    for (let i = 0; i < rows; i++) w.push(W);
    if (rows === 8) {
      const k = rows - 1;
      for (let j = 0; j < k; j++) {
        const t = (j + 0.5) / k;
        w[j + 1] = W * (0.4 + 0.6 * Math.pow(Math.sin(Math.PI * t), 0.9));
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

  /* ==========================================================================
     التوزيع على السطور — حفص وورش
     fT: حجم الخط الثابت المطلوب؛ ينزل عنه فقط إذا ضاقت الصفحة بكلماتها.
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
    const w = items.map(it => (it.t ? measure(it.t.s, fam) : 0));
    const pre = [0];
    for (let i = 0; i < n; i++) pre.push(pre[i] + w[i]);
    const lineH = G.H / (oval ? 10 : 15);
    let cap = lineH * CAP;

    /* في الصفحات البيضوية تُرتَّب البسملة سطرًا قصيرًا، فيُحدّ الخط بها */
    if (oval) {
      let g = 0;
      items.forEach(it => {
        if (it.gap === "bsm") {
          const tk = Q.tokenize(it.text);
          const nat = tk.reduce((a, t) => a + measure(t, fam), 0) + sp * SPF * (tk.length - 1);
          cap = Math.min(cap, 100 * widths[g] * 0.97 / nat);
        }
        if (it.gap) g++;
      });
    }

    let spf = SPF;      /* أقل مسافة بين الكلمات؛ تنخفض فقط في الصفحات الأكثر كثافة */

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

    /* هل يمكن توزيع الصفحة على rows سطرًا عند حجم f؟ يعيد المسار أو null */
    function solve(f, constrained) {
      const INF = 1e18;
      const dp = [], from = [];
      for (let l = 0; l <= rows; l++) { dp.push(new Float64Array(n + 1).fill(INF)); from.push(new Int32Array(n + 1).fill(-1)); }
      dp[0][0] = 0;
      const k = f / 100;
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
            if (nat > WL) break;
            if (!lineOK(i, j, l + 1, constrained)) continue;
            const isEnd = !oval && items[j - 1].end && items[j - 1].seg.endsSurah;
            const slack = (WL - nat) / WL;
            const c = base + (isEnd ? 0 : slack * slack);
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

    /* أكبر حجم ممكن */
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
    /* صفحة كثيفة لا يسعها الحجم الموحّد: نضيّق المسافات بين كلماتها بدل تصغير الخط */
    if (res.f < fT) {
      spf = 0.15;
      const r2 = best(res.c);
      if (r2 && r2.f > res.f) res = r2; else spf = SPF;
    }
    const fMax = res.f;

    /* حجم ثابت: لا نكبّر الخط لأن الكلمات قليلة */
    const lim = fT;
    let f = res.f, path = res.path;
    if (lim < f) {
      const q = solve(lim, res.c);
      if (q) { f = lim; path = q; }
    }

    /* توليد الأسطر */
    const lines = [];
    path.forEach(([s, e], idx) => {
      if (items[s].gap) { const g = items[s]; g.w = widths[idx]; lines.push(g); return; }
      const toks = items.slice(s, e).map(x => x.t.s);
      const vss = items.slice(s, e).map(x => x.t.vs);
      const nat = (pre[e] - pre[s] + sp * (e - s - 1)) * f / 100;
      const isEnd = !oval && items[e - 1].end && items[e - 1].seg.endsSurah;
      const L = { toks: toks, vss: vss, w: widths[idx], center: isEnd && nat < W * 0.72 };
      /* ضبط الحجم لكل سطر ليملأ عرضه بمسافات طبيعية: حل وسط بين تغيير الخط ومدّ المسافات */
      if (!L.center && toks.length > 1) {
        const words = pre[e] - pre[s], k = e - s;
        const ffit = 100 * widths[idx] / (words + sp * spf * (k - 1)) * 0.995;
        const fnat = 100 * widths[idx] / (words + sp * (k - 1));
        L.fs = Math.min(ffit, Math.max(0.9 * f, Math.min(fnat, 1.12 * f)));
        const gapPx = (widths[idx] - words * L.fs / 100) / (k - 1);
        if (gapPx > 0.9 * L.fs) { L.center = true; L.g = 0.3 * L.fs; }
      } else if (!L.center) L.center = true;
      lines.push(L);
    });
    return { f: f, fMax: fMax, lines: lines, constrainedFail: fell, sp: sp, oval: oval };
  }

  /* ==========================================================================
     التوزيع على السطور — الرسم المغربي (الأسطر جاهزة)
     ========================================================================== */
  async function layoutMA(page, W, rows, fT) {
    const raw = page.raw;
    const fam = FONT;
    const sp = spaceW(fam);
    const oval = rows === 8;
    const widths = lineWidths(rows, W);
    const lineH = G.H / (oval ? 10 : 15);
    let f = Math.min(lineH * CAP, fT);
    const out = [];
    let idx = 0, fMax = Infinity;
    for (const ln of raw.lines) {
      const wl = widths[Math.min(idx, rows - 1)];
      idx++;
      if (ln.is_surah_title === "1") {
        out.push({ head: await Q.maSurahByTitle(ln.surah_title_ar) });
        continue;
      }
      const toks = ln.words.map(x => ({
        s: String(x.text).replace(/\s+/g, " ").trim(),
        v: x.surah_number + ":" + x.verse.verse_number,
        m: x.is_last_word === "1" ? x.verse.verse_number : null
      })).filter(x => x.s);
      let nat = 0;
      toks.forEach((t, i) => { nat += measure(t.s, fam); if (t.m) nat += 112; if (i) nat += sp * SPF; });
      const L = { toks: toks, nat: nat, w: wl };
      if (nat) {
        const fl = 100 * wl / nat * 0.995;
        fMax = Math.min(fMax, fl);
        L.fl = fl;
        /* السطر الأعرض من المتوسط يصغر وحده ليبقى داخل الإطار */
        L.fs = Math.min(f, fl);
        L.center = !oval && nat * L.fs / 100 < wl * 0.7;
        const k = toks.length;
        if (!L.center && k > 1) {
          const words = nat - sp * SPF * (k - 1);
          const fnat = 100 * wl / (words + sp * (k - 1));
          L.fs = Math.min(fl, Math.max(0.9 * f, Math.min(fnat, 1.12 * f)));
          const gapPx = (wl - words * L.fs / 100) / (k - 1);
          if (gapPx > 0.9 * L.fs) { L.center = true; L.g = 0.3 * L.fs; }
        }
      }
      out.push(L);
    }
    /* في الصفحات البيضوية يكون حجم الخط واحدًا في كل السطور، ولا يتجاوز ما يسعه أضيقها */
    if (oval) {
      f = Math.min(f, fMax);
      out.forEach(L => {
        if (!L.nat) return;
        L.center = false; L.g = 0;
        const k = L.toks.length;
        const words = L.nat - sp * SPF * (k - 1);
        const fnat = k > 1 ? 100 * L.w / (words + sp * (k - 1)) : f;
        L.fs = Math.min(L.fl, Math.max(0.92 * f, Math.min(fnat, 1.08 * f)));
        if (k < 2) { L.fs = Math.min(f, L.fl); L.center = true; }
      });
    }
    return { f: f, fMax: fMax, lines: out, sp: sp, oval: oval };
  }

  /* ==========================================================================
     بناء HTML الصفحة
     ========================================================================== */

  /* اسم السورة: نرسمه في لوحة ثم نقصّ حدود الحبر فقط، ليقع في منتصف الإطار تمامًا
     أفقيًا وعموديًا مهما كانت هوامش حروف الخط */
  const nameCache = new Map();
  function nameImg(n, fs) {
    const key = n + "|" + Math.round(fs);
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
    nameCache.set(key, res);
    return res;
  }

  function headHTML(n, lineH) {
    const fh = Math.min(lineH * 0.96, G.W / FRAME_RATIO);
    let inner = "";
    const im = n ? nameImg(n, fh * 0.9) : null;
    if (im) {
      /* لا يتجاوز الاسم اللوحة الداخلية للإطار */
      const k = Math.min(1, (G.W * 0.5) / im.w, (fh * 0.7) / im.h);
      inner = '<img class="sn" alt="" src="' + im.src + '" style="width:' + (im.w * k) + "px;height:" + (im.h * k) + 'px">';
    }
    return '<div class="ln head" style="height:' + lineH + 'px;width:' + G.W + 'px"><div class="sf" style="width:' + G.W + "px;height:" + fh + 'px">' +
      '<img class="fr" src="' + IMG + 'surah_frame_brown.svg" alt="">' + inner + "</div></div>";
  }

  function pnumHTML(p) {
    const w = G.pw * 0.24;
    const h = w * 51.939 / 180.439;
    return '<div class="pnum" style="width:' + w + "px;height:" + h + "px;left:" + G.side + "px;bottom:" + (G.ph * 0.018) + 'px">' +
      '<img src="' + IMG + 'page_frame_box_brown.svg" alt=""><span style="font-size:' + (h * 0.5) + 'px">' + Q.ar(Q.showPage(r, p)) + "</span></div>";
  }

  function markerHTML(num, f) {
    const s = String(num);
    const fs = f * (s.length === 1 ? 0.52 : s.length === 2 ? 0.44 : 0.36);
    return '<i class="av" style="width:' + (f * 0.97) + "px;height:" + (f * 1.25) + "px;margin-inline-start:" + (f * 0.12) + 'px">' +
      '<img src="' + IMG + 'ayah_frame_brown.svg" alt=""><b style="font-size:' + fs + 'px">' + Q.ar(s) + "</b></i>";
  }

  async function buildPage(p) {
    const data = await Q.getPage(r, p);
    if (!data) return null;
    const rows = data.rows;
    const lineH = G.H / (rows === 8 ? 10 : 15);
    const fT = K[r] * G.W;
    let lay, body = "";

    if (r === "warsh_ma") lay = await layoutMA(data, G.W, rows, fT);
    else lay = layoutDP(data, G.W, rows, fT);

    if (!lay) {
      body = '<div class="miss">تعذّر ترتيب هذه الصفحة</div>';
    } else {
      stats.pages++;
      stats.fmin = Math.min(stats.fmin, lay.f); stats.fmax = Math.max(stats.fmax, lay.f);
      const f = lay.f;
      lay.lines.forEach(L => {
        if (L.gap === "head" || L.head !== undefined) {
          body += headHTML(L.n || L.head, lineH);
          return;
        }
        const lf = L.fs || f;
        const style = "height:" + lineH + "px;width:" + (L.w || G.W) + "px;font-size:" + lf + "px;";
        if (L.gap === "bsm") {
          if (lay.oval) {
            const tk = Q.tokenize(L.text).map(t => '<span class="t">' + Q.esc(t) + "</span>").join("");
            body += '<div class="ln" style="' + style + '">' + tk + "</div>";
          } else {
            body += '<div class="ln bsm" style="' + style + '"><span class="t">' + Q.esc(L.text) + "</span></div>";
          }
          return;
        }
        const toks = L.toks.map((t, i) => {
          if (typeof t === "string") return '<span class="t"' + (L.vss && L.vss[i] ? ' data-v="' + L.vss[i] + '"' : "") + ">" + Q.esc(t) + "</span>";
          return '<span class="t" data-v="' + t.v + '">' + Q.esc(t.s) + (t.m ? markerHTML(t.m, lf) : "") + "</span>";
        }).join("");
        body += '<div class="ln' + (L.center ? " ctr" : "") + '" style="' + style + (L.g ? "gap:" + L.g + "px;" : "") + '">' + toks + "</div>";
      });
    }
    const fam = r === "hafs" ? "hafs" : r === "warsh" ? "warsh" : "maghribi";
    const inner = '<div class="mbody' + (rows === 8 ? " short" : "") + '" style="top:' + G.top + "px;left:" + G.side + "px;right:" + G.side + "px;" +
      "height:" + G.H + 'px;font-family:var(--font-' + fam + ')">' + body + "</div>";
    return '<div class="paper" style="width:' + G.pw + "px;height:" + G.ph + 'px">' + inner + pnumHTML(p) + "</div>";
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
        h = '<div class="paper" style="width:' + G.pw + "px;height:" + G.ph + 'px"><div class="miss">هذه الصفحة غير متوفرة بعد</div></div>';
      }
      if (my !== epoch) return;
      sec.innerHTML = h || "";
      paintMarks(sec);
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
  let surahNames = null;

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
  function setCurrent(p) {
    if (p === cur) return;
    cur = p;
    around(p);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const s = await updateBar(p);
      Q.saveLast(r, p, s ? s.n : 0, s ? s.ar : "", s ? s.juz : 0);
      history.replaceState(history.state, "", "page.html?r=" + r + "&p=" + p);
    }, 350);
    updateBar(p);
  }

  function goTo(p, smooth) {
    p = Math.max(ED.first, Math.min(ED.last, p));
    const sec = sectionOf(p);
    sec.scrollIntoView({ behavior: smooth ? "smooth" : "instant", inline: "center", block: "nearest" });
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
    pager.style.setProperty("--pw", G.pw + "px");
    pager.style.setProperty("--ph", G.ph + "px");
  }

  let io = null;
  function observe() {
    if (io) io.disconnect();
    io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) setCurrent(+e.target.dataset.p); });
    }, { root: pager, threshold: 0.6 });
    Array.prototype.forEach.call(pager.children, s => io.observe(s));
  }

  /* ---------- السحب بالفأرة (اللمس يعمل أصلًا) ---------- */
  function mouseDrag() {
    let down = false, sx = 0, ss = 0, moved = false;
    pager.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; ss = pager.scrollLeft;
      pager.style.scrollSnapType = "none";
      pager.classList.add("drag");
    });
    window.addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) moved = true;
      pager.scrollLeft = ss - dx;
    });
    window.addEventListener("pointerup", e => {
      if (!down) return;
      down = false;
      pager.classList.remove("drag");
      const dx = e.clientX - sx;
      let target = cur;
      if (Math.abs(dx) > 40) target = dx > 0 ? cur + 1 : cur - 1;   /* السحب يمينًا = الصفحة التالية */
      pager.dataset.moved = moved ? "1" : "";
      goTo(target, true);
      setTimeout(() => { pager.style.scrollSnapType = ""; }, 450);
    });
  }

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
    const list = await Q.surahs(r);
    const s = list.find(x => x.n === sn);
    const ex = Q.bmFind(r, v);
    bmDraft = { r: r, v: v, p: p, surah: sn, aya: an, sname: s ? s.ar : "", juz: s ? s.juz : 0, color: ex ? ex.color : "olive", exists: !!ex };
    document.getElementById("bmWhere").textContent = "سورة " + bmDraft.sname + " · الآية " + Q.ar(an) + " · ص " + Q.ar(Q.showPage(r, p));
    const nm = document.getElementById("bmName");
    nm.value = ex ? ex.name : "";
    nm.placeholder = bmDraft.sname + " ـ " + Q.ar(an);
    document.getElementById("bmDel").hidden = !ex;
    document.getElementById("bmTitle").textContent = ex ? "تعديل العلامة" : "علامة مرجعية جديدة";
    drawColors();
    sheet.classList.add("show");
  }
  function drawColors() {
    document.getElementById("bmColors").innerHTML = Q.BM_COLORS.map(c =>
      '<button type="button" class="sw' + (c.id === bmDraft.color ? " on" : "") + '" data-c="' + c.id + '" style="--c:' + c.hex + '" aria-label="' + c.name + '"></button>').join("");
  }
  document.getElementById("bmColors").addEventListener("click", e => {
    const b = e.target.closest("[data-c]");
    if (!b) return;
    bmDraft.color = b.dataset.c; drawColors();
  });
  window.closeBm = function () { sheet.classList.remove("show"); bmDraft = null; };
  window.saveBm = function () {
    if (!bmDraft) return;
    const nm = document.getElementById("bmName").value.trim();
    Q.bmPut({ r: bmDraft.r, v: bmDraft.v, p: bmDraft.p, surah: bmDraft.surah, aya: bmDraft.aya, sname: bmDraft.sname, juz: bmDraft.juz,
      name: nm || (bmDraft.sname + " ـ " + Q.ar(bmDraft.aya)), color: bmDraft.color, ts: Date.now() });
    closeBm(); paintMarks();
  };
  window.delBm = function () {
    if (!bmDraft) return;
    Q.bmDel(bmDraft.r, bmDraft.v); closeBm(); paintMarks();
  };
  sheet.addEventListener("click", e => { if (e.target === sheet) closeBm(); });

  (function longPress() {
    let timer = null, sx = 0, sy = 0, fired = false;
    const cancel = () => { clearTimeout(timer); timer = null; };
    pager.addEventListener("pointerdown", e => {
      const t = e.target.closest(".t[data-v]");
      if (!t || (e.pointerType === "mouse" && e.button !== 0)) return;
      sx = e.clientX; sy = e.clientY; fired = false;
      const sec = t.closest("section");
      timer = setTimeout(() => {
        timer = null; fired = true; pager.dataset.lp = "1";
        if (navigator.vibrate) { try { navigator.vibrate(18); } catch (x) { /* لا شيء */ } }
        openVs(t.dataset.v, sec ? +sec.dataset.p : cur);
      }, 450);
    });
    pager.addEventListener("pointermove", e => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 9) cancel(); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(n => pager.addEventListener(n, cancel));
    pager.addEventListener("scroll", cancel, { passive: true });
    pager.addEventListener("contextmenu", e => e.preventDefault());
    /* بعد الضغطة المطوّلة لا نعدّها نقرة (لا يُخفى الشريط) */
    pager.addEventListener("pointerdown", () => { pager.dataset.lp = ""; }, true);
  })();

  /* ---------- النقر: آية = تفسير، نقرتان = علامة، خارج الآيات = إخفاء الشريط ---------- */
  /* يعتمد على pointerup (لا click) فلا يتأخر ولا يضيع، ويختار أقرب كلمة
     إلى إصبعك ضمن مسافة معقولة، فلا حاجة لإصابة الحرف بدقة. */
  QTafsir.onBookmark = (v, p) => openBm(v, p);
  const REACH = 26;                       /* أقصى مسافة (px) إلى أقرب كلمة */
  let tapTimer = null, lastTap = null, down = null;

  function nearestToken(x, y) {
    let el = document.elementFromPoint(x, y);
    const direct = el && el.closest(".t[data-v]");
    if (direct) return direct;
    const sec = el && el.closest("section.pg");
    if (!sec) return null;
    let best = null, bd = REACH;
    sec.querySelectorAll(".t[data-v]").forEach(t => {
      const b = t.getBoundingClientRect();
      const dx = x < b.left ? b.left - x : x > b.right ? x - b.right : 0;
      const dy = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
      const d = Math.hypot(dx, dy * 0.8);
      if (d < bd) { bd = d; best = t; }
    });
    return best;
  }
  function lit(v, on) {
    document.querySelectorAll('.t[data-v="' + v + '"]').forEach(n => n.classList.toggle("tsel", on));
  }
  function handleTap(x, y) {
    const t = nearestToken(x, y);
    if (!t) { document.body.classList.toggle("immersive"); return; }
    const sec = t.closest("section");
    openVs(t.dataset.v, sec ? +sec.dataset.p : cur);     /* نقرة واحدة ← القائمة فورًا */
  }
  pager.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
  });
  pager.addEventListener("pointerup", e => {
    const d = down; down = null;
    if (!d || d.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10 || Date.now() - d.t > 480) return;
    if (pager.dataset.lp === "1") { pager.dataset.lp = ""; return; }   /* بعد ضغطة مطوّلة */
    handleTap(e.clientX, e.clientY);
  });
  pager.addEventListener("pointercancel", () => { down = null; });
  /* مسح أي علامة عالقة بعد الإغلاق */
  window.addEventListener("pagehide", () => document.querySelectorAll(".t.tsel").forEach(n => n.classList.remove("tsel")));

  /* ---------- قائمة الآية + التلاوة ---------- */
  const $ = id => document.getElementById(id);
  const vsSheet = $("vsSheet"), vsPages = $("vsPages");
  let vs = null, recList = [];
  const ICO_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" /></svg>';
  const ICO_PAUSE = '<svg viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>';

  async function openVs(v, p) {
    const [s, a] = v.split(":").map(Number);
    const list = await Q.surahs(r), sl = list.find(x => x.n === s);
    if (vs) lit(vs.v, false);
    vs = { v: v, p: p, s: s, a: a, sname: sl ? sl.ar : "", total: sl ? sl.aya : a };
    lit(v, true);
    $("vsWhere").textContent = "سورة " + vs.sname + " · الآية " + Q.ar(a);
    $("vsBmNote").textContent = Q.bmFind(r, v) ? "هذه الآية عليها علامة، يمكنك تعديلها أو حذفها" : "احفظ موضعك في هذه الآية باسم ولون";
    vsPages.scrollLeft = 0; dots();
    vsSheet.classList.add("show");
    fillReciters();
  }
  function closeVs() { vsSheet.classList.remove("show"); if (vs) lit(vs.v, false); }
  vsSheet.addEventListener("click", e => { if (e.target === vsSheet) closeVs(); });
  function dots() {
    const w = vsPages.clientWidth || 1, i = Math.min(2, Math.round(Math.abs(vsPages.scrollLeft) / w));
    document.querySelectorAll("#vsDots i").forEach((d, k) => d.classList.toggle("on", k === i));
  }
  vsPages.addEventListener("scroll", dots, { passive: true });

  async function fillReciters() {
    const sel = $("vsRec"), note = $("vsNote"), btn = $("vsPlay");
    btn.disabled = true; note.textContent = "جارٍ جلب القرّاء…"; sel.innerHTML = "";
    try {
      recList = await QAudio.reciters(r);
      const mine = recList.filter(x => x.surahs.includes(vs.s));
      if (!mine.length) { note.textContent = "لا يوجد قارئ لهذه السورة في هذه الرواية"; return; }
      const saved = QAudio.choice(r);
      sel.innerHTML = mine.map(x => '<option value="' + x.mid + '"' + (String(x.mid) === saved ? " selected" : "") + ">" + Q.esc(x.name + (x.mname ? " — " + x.mname : "")) + "</option>").join("");
      note.textContent = ""; btn.disabled = false;
    } catch (e) { note.textContent = "تعذّر جلب القرّاء، يلزم اتصال بالإنترنت أول مرة"; }
  }
  $("vsRec").addEventListener("change", e => QAudio.setChoice(r, e.target.value));

  window.vsDo = async function (k) {
    if (!vs) return;
    const cur0 = vs; 
    if (k === "tf") { closeVs(); QTafsir.open(r, cur0.v, cur0.p); }
    else if (k === "bm") { closeVs(); openBm(cur0.v, cur0.p); }
    else if (k === "au") {
      const rc = recList.find(x => String(x.mid) === $("vsRec").value);
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
  function follow(s, a, tries) {
    const toks = document.querySelectorAll('.t[data-v="' + s + ":" + a + '"]');
    clearAud();
    if (toks.length) {
      toks.forEach(n => n.classList.add("aud"));
      const sec = toks[0].closest("section"), p = sec ? +sec.dataset.p : cur;
      if (p !== cur) goTo(p, true);
    } else if ((tries || 0) < 4) {
      goTo(cur + 1, true);                       /* الآية في صفحة تالية: نتقدّم ثم نعيد المحاولة */
      setTimeout(() => { const st = QAudio.state(); if (st && st.s === s && st.a === a) follow(s, a, (tries || 0) + 1); }, 500);
    }
  }
  QAudio.onVerse = (s, a) => follow(s, a, 0);
  QAudio.onStop = () => clearAud();
  QAudio.onError = () => { $("qaSub").textContent = "تعذّر تحميل الصوت"; };
  document.addEventListener("qaudio", e => {
    const st = e.detail, bar = $("qaBar");
    bar.hidden = !st;
    if (!st) return;
    $("qaTitle").textContent = "سورة " + st.sname + " · الآية " + Q.ar(st.a);
    $("qaSub").textContent = st.name + (st.hasTiming ? "" : " · بلا تتبّع للآيات");
    $("qaToggle").innerHTML = st.playing ? ICO_PAUSE : ICO_PLAY;
  });
  $("qaToggle").addEventListener("click", () => QAudio.toggle());
  $("qaStop").addEventListener("click", () => QAudio.stop());
  $("qaNext").addEventListener("click", () => QAudio.step(1));
  $("qaPrev").addEventListener("click", () => QAudio.step(-1));

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
    go("page.html?r=" + id + (s ? "&s=" + s.n : ""));
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

  /* ---------- تغيّر المقاس ---------- */
  let rt = null;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (!G) return;
      const n = geom();
      if (n.pw === G.pw && n.ph === G.ph) return;
      G = n; epoch++; html.clear(); rendering.clear();
      const keep = cur; cur = -1;
      pager.style.setProperty("--pw", G.pw + "px");
      pager.style.setProperty("--ph", G.ph + "px");
      Array.prototype.forEach.call(pager.children, s => { s.innerHTML = ""; s.dataset.done = ""; s.classList.remove("ready"); });
      goTo(keep, false);
      setCurrent(keep);
    }, 200);
  });

  /* ---------- أدوات الاختبار ---------- */
  window.__qtest = {
    layout: async function (p, fT) {
      G = G || geom();
      const d = await Q.getPage(r, p);
      const ft = fT === undefined ? K[r] * G.W : fT;
      return r === "warsh_ma" ? layoutMA(d, G.W, d.rows, ft) : layoutDP(d, G.W, d.rows, ft);
    },
    K: K, measure: measure, FONT: FONT, geom: () => G, ED: ED
  };

  start();
})();
