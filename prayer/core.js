/* قطر الندى — prayer/core.js : بيانات الأوقات (جدول رسمي إن وُجد، وإلا حساب) — مشترك بين الصفحة والرئيسية.
   يتطلب calc.js قبله. */
(function () {
  "use strict";
  const P = (window.Prayer = {});
  const SELF = document.currentScript ? document.currentScript.src : location.href;
  const url = p => new URL("../assets/json/" + p, SELF).href;

  /* التوقيت المعتمد بالمغرب ثابت (GMT) دون تغيير صيفي (حسب مواقيت الوزارة). */
  const TZ = 0;
  const BIAS = [-0.1, 0, 0.2, 0, 0, 0]; /* تقريب كل وقت ليطابق جدول الوزارة */
  const KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  P.NAMES = ["الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"];
  P.DEFAULT_CITY = 1; /* الرباط */

  P.get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  P.set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* لا شيء */ } };
  P.ar = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);

  let citiesP = null;
  P.cities = () => (citiesP = citiesP || fetch(url("prayer_cities.json")).then(r => r.json()));
  P.city = async function (code) {
    const list = await P.cities();
    return list.find(c => c.c === code) || list.find(c => c.c === P.DEFAULT_CITY) || list[0];
  };
  P.cityCode = () => +P.get("prayerCity", P.DEFAULT_CITY) || P.DEFAULT_CITY;
  P.setCity = c => P.set("prayerCity", String(c));

  /* الجداول الشهرية الرسمية: assets/json/horaires-YYYY-MM.js (تُضاف شهرًا بشهر) */
  /* الأشهر التي لها جدول رسمي مرفوع (اتركها فارغة = حساب فقط بلا أي طلب شبكة إضافي).
     لإضافة شهر: ضع ملفه في assets/json ثم أضف مفتاحه هنا مثل "2026-12". */
  const OFFICIAL = ["2026-11"];
  const months = {};
  window.HORAIRES_MOIS = window.HORAIRES_MOIS || [];
  function loadMonth(y, m) {
    const key = y + "-" + String(m).padStart(2, "0");
    if (OFFICIAL.indexOf(key) < 0) return Promise.resolve(null);
    if (months[key]) return months[key];
    return (months[key] = new Promise(res => {
      const have = () => window.HORAIRES_MOIS.find(x => x.annee === y && x.mois === m);
      if (have()) return res(have());
      const s = document.createElement("script");
      s.src = url("horaires-" + key + ".js");
      s.onload = () => res(have() || null);
      s.onerror = () => res(null);
      document.head.appendChild(s);
    }));
  }

  const hm = mins => {
    mins = ((Math.round(mins) % 1440) + 1440) % 1440;
    return String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
  };
  P.toMin = s => { const t = s.split(":"); return +t[0] * 60 + +t[1]; };

  function calc(c, y, m, d) {
    const base = JSON.parse(JSON.stringify(PrayerCalc.MOROCCO));
    base.off = { fajr: 0, sunrise: 0, dhuhr: 5, asr: 0, maghrib: 0, isha: 0 };
    const a = PrayerCalc.times(y, m, d, c.lat, c.lon, TZ, Object.assign({}, base, { h0: -0.833 - c.sr }), 0);
    const b = PrayerCalc.times(y, m, d, c.lat, c.lon, TZ, Object.assign({}, base, { h0: -0.833 - c.mg }), 0);
    const t = [a.fajr, a.sunrise, a.dhuhr, a.asr, b.maghrib, a.isha];
    return t.map((h, i) => hm(h * 60 + BIAS[i]));
  }

  /* إعدادات المستخدم: تعديل الدقائق لكل وقت، نظام الساعة، خط العداد */
  P.adj = () => { try { const a = JSON.parse(P.get("prayerAdj", "[]")); return [0, 1, 2, 3, 4, 5].map(i => Math.max(-30, Math.min(30, +a[i] || 0))); } catch (e) { return [0, 0, 0, 0, 0, 0]; } };
  P.setAdj = a => P.set("prayerAdj", JSON.stringify(a));
  P.is12 = () => P.get("prayerH12", "0") === "1";
  P.FONTS = { tajawal: "تجوال", almarai: "المراي", cairo: "القاهرة", amiri: "أميري", mono: "رقمي" };
  P.font = () => {
    let f = P.get("prayerFont", "tajawal");
    if (f === "cario") f = "cairo";
    return P.FONTS[f] ? f : "tajawal";
  };
  P.fontCss = f => f === "mono" ? 'ui-monospace,"SF Mono",Menlo,Consolas,monospace' : '"' + f + '",sans-serif';
  const shift = (t, a) => t.map((s, i) => a[i] ? hm(P.toMin(s) + a[i]) : s);
  /* "17:25" ← "5:25 م" حسب النظام المختار */
  P.fmt = s => {
    if (!P.is12()) return s;
    const mn = P.toMin(s), h = Math.floor(mn / 60), x = mn % 60;
    return ((h % 12) || 12) + ":" + String(x).padStart(2, "0") + " " + (h < 12 ? "ص" : "م");
  };

  /* أوقات يوم معيّن لمدينة: { t:[6 نصوص], src:"official"|"calc" } */
  P.day = async function (code, y, m, d) {
    const c = await P.city(code);
    const mo = await loadMonth(y, m);
    const v = mo && mo.villes.find(x => x.c === c.c);
    const a = P.adj();
    if (v && v.h[d - 1]) return { t: shift(v.h[d - 1], a), src: "official", city: c };
    return { t: shift(calc(c, y, m, d), a), src: "calc", city: c };
  };

  /* التاريخ الحالي بالمغرب (من UTC + TZ) */
  P.now = function () {
    const d = new Date(Date.now() + TZ * 3600000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), min: d.getUTCHours() * 60 + d.getUTCMinutes(), sec: d.getUTCSeconds() };
  };
  P.addDay = function (y, m, d, n) {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  };
  P.weekday = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  /* الصلاة القادمة (الشروق ليس صلاة): { i, name, secs, tomorrow } */
  P.next = async function (code) {
    const n = P.now();
    const today = await P.day(code, n.y, n.m, n.d);
    const cur = n.min * 60 + n.sec;
    for (let i = 0; i < 6; i++) {
      if (i === 1) continue;
      const at = P.toMin(today.t[i]) * 60;
      if (at > cur) return { i: i, name: P.NAMES[i], secs: at - cur, tomorrow: false, today: today };
    }
    const tm = P.addDay(n.y, n.m, n.d, 1);
    const nx = await P.day(code, tm.y, tm.m, tm.d);
    return { i: 0, name: P.NAMES[0], secs: 86400 - cur + P.toMin(nx.t[0]) * 60, tomorrow: true, today: today };
  };
  P.clock = s => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return [h, m, x].map(v => String(v).padStart(2, "0")).join(":");
  };

  /* التاريخ الهجري: من جدول الوزارة (hijri.js) إن وُجد، وإلا تقويم أم القرى */
  const HN = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  P.hijri = function (y, m, d) {
    const H = window.HIJRI;
    if (H) {
      const t = Date.UTC(y, m - 1, d);
      for (let i = H.mois.length - 1; i >= 0; i--) {
        const e = H.mois[i], p = e.debut.split("-");
        const n = Math.round((t - Date.UTC(+p[0], +p[1] - 1, +p[2])) / 86400000) + 1;
        if (n < 1) continue;
        if (n > (e.duree || 30)) break;
        return P.ar(n) + " " + H.noms[e.mois - 1] + " " + P.ar(e.annee) + "هـ";
      }
    }
    try {
      const f = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" });
      const o = {}; f.formatToParts(new Date(Date.UTC(y, m - 1, d))).forEach(p => { o[p.type] = p.value; });
      return P.ar(o.day) + " " + HN[+o.month - 1] + " " + P.ar(o.year) + "هـ";
    } catch (e) { return ""; }
  };
  P.USE_MINISTRY_HIJRI = false; /* true = يحمّل assets/json/hijri.js (يحتاج تحديثًا شهريًا) */
  P.loadHijri = () => new Promise(res => {
    if (window.HIJRI || !P.USE_MINISTRY_HIJRI) return res();
    const s = document.createElement("script");
    s.src = url("hijri.js"); s.onload = s.onerror = () => res();
    document.head.appendChild(s);
  });
})();
