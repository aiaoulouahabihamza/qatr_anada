/* قطر الندى — prayer/calc.js
   حساب فلكي لأوقات الصلاة بمعاملات المغرب (فجر 19° وعشاء 17° وظهر +5 ومغرب +2 وعصر ظل المثل).
   موضع الشمس: خوارزمية ميوس (الفصل 25) مع تصحيح الانكسار الجوي. الزمن بالتوقيت المحلي المعطى (ساعات من منتصف الليل). */
(function (root) {
  "use strict";
  const R = Math.PI / 180;
  const fix = (x, m) => x - m * Math.floor(x / m);

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  /* إحداثيات الشمس الظاهرة عند JD (UT): الميل وصعود مستقيم بالدرجات ومعادلة الزمن بالساعات */
  function sun(jd) {
    const T = (jd - 2451545) / 36525;
    const L0 = fix(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360);
    const M = fix(357.52911 + 35999.05029 * T - 0.0001537 * T * T, 360);
    const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * R) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * M * R) + 0.000289 * Math.sin(3 * M * R);
    const lon = L0 + C;
    const om = 125.04 - 1934.136 * T;
    const lam = lon - 0.00569 - 0.00478 * Math.sin(om * R);
    const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * R);
    const dec = Math.asin(Math.sin(eps * R) * Math.sin(lam * R)) / R;
    const ra = fix(Math.atan2(Math.cos(eps * R) * Math.sin(lam * R), Math.cos(lam * R)) / R, 360);
    const eqt = (fix(L0 - 0.0057183 - ra + 180, 360) - 180) / 15; /* L0 - 0.0057183 - RA (ساعات) */
    return { dec: dec, ra: ra, eqt: eqt };
  }

  const MOROCCO = { fajr: 19, isha: 17, asr: 1, off: { fajr: 0, sunrise: 0, dhuhr: 5, asr: 0, maghrib: 2, isha: 0 }, h0: -0.833 };

  /* lat, lon بالدرجات (شرقًا موجب)، tz ساعات عن UTC (المغرب الآن 0)، elev بالمتر */
  function times(y, m, d, lat, lon, tz, cfg, elev) {
    cfg = cfg || MOROCCO;
    const jd = julian(y, m, d) + 0.5 - tz / 24 + 0; /* منتصف الظهر المحلي تقريبًا */
    const noonUT = 12 - lon / 15;
    let s = sun(julian(y, m, d) + (noonUT / 24));
    const dhuhr = 12 - lon / 15 - s.eqt + tz; /* بالساعة المحلية */
    const hour = (alt, dec) => {
      const c = (Math.sin(alt * R) - Math.sin(lat * R) * Math.sin(dec * R)) / (Math.cos(lat * R) * Math.cos(dec * R));
      return c < -1 || c > 1 ? NaN : Math.acos(c) / R / 15;
    };
    /* نكرّر لتحسين الإحداثيات عند وقت كل صلاة */
    const at = (t) => sun(julian(y, m, d) + (t - tz) / 24);
    const dip = elev > 0 ? 0.0347 * Math.sqrt(elev) : 0;
    const h0 = cfg.h0 - dip;
    const solve = (alt, sign, guess) => {
      let t = guess;
      for (let i = 0; i < 3; i++) {
        const ss = at(t);
        const dh = 12 - lon / 15 - ss.eqt + tz;
        t = dh + sign * hour(alt, ss.dec);
      }
      return t;
    };
    const sd = at(dhuhr);
    const asrAlt = Math.atan(1 / (cfg.asr + Math.tan(Math.abs(lat - sd.dec) * R))) / R;
    const o = cfg.off;
    const r = {
      fajr: solve(-cfg.fajr, -1, dhuhr - 1.5) + o.fajr / 60,
      sunrise: solve(h0, -1, dhuhr - 6) + o.sunrise / 60,
      dhuhr: dhuhr + o.dhuhr / 60,
      asr: solve(asrAlt, 1, dhuhr + 3) + o.asr / 60,
      maghrib: solve(h0, 1, dhuhr + 6) + o.maghrib / 60,
      isha: solve(-cfg.isha, 1, dhuhr + 7) + o.isha / 60
    };
    return r;
  }
  function fmt(h) {
    if (!isFinite(h)) return "--:--";
    let mins = Math.round(h * 60);
    mins = ((mins % 1440) + 1440) % 1440;
    return String(Math.floor(mins / 60)).padStart(2, "0") + ":" + String(mins % 60).padStart(2, "0");
  }
  root.PrayerCalc = { times: times, fmt: fmt, MOROCCO: MOROCCO };
  if (typeof module !== "undefined") module.exports = root.PrayerCalc;
})(typeof window !== "undefined" ? window : globalThis);
