/* قطر الندى — hadith/core.js : البيانات والتنظيف المشترك */
(function () {
  "use strict";
  const H = (window.H = {});
  const SRC = "../assets/json/arba3un.json";
  let cache = null;

  H.get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  H.set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* لا شيء */ } };
  H.ar = n => String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  H.esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  H.norm = x => String(x).replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

  H.ORD = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون", "الحادي والعشرون", "الثاني والعشرون", "الثالث والعشرون", "الرابع والعشرون", "الخامس والعشرون", "السادس والعشرون", "السابع والعشرون", "الثامن والعشرون", "التاسع والعشرون", "الثلاثون", "الحادي والثلاثون", "الثاني والثلاثون", "الثالث والثلاثون", "الرابع والثلاثون", "الخامس والثلاثون", "السادس والثلاثون", "السابع والثلاثون", "الثامن والثلاثون", "التاسع والثلاثون", "الأربعون", "الحادي والأربعون", "الثاني والأربعون"];
  H.TOTAL = 42;
  /* أقسام صفحة الحديث: مفتاح البيانات، العنوان، سطر المصدر */
  H.TABS = [
    { k: "hadith", t: "الحديث", s: "" },
    { k: "author", t: "الشرح", s: "شرح وفوائد الحديث" },
    { k: "to7fa", t: "المفردات", s: "التحفة الربانية — إسماعيل الأنصاري" },
    { k: "e3rab", t: "الإعراب", s: "إعراب الأربعين النووية — عمر العمري" },
    { k: "ibnRajab", t: "ابن رجب", s: "جامع العلوم والحكم — ابن رجب الحنبلي" },
    { k: "ibnOth", t: "ابن عثيمين", s: "شرح الأربعين النووية — ابن عثيمين" },
    { k: "5oder", t: "الخضير", s: "شرح الشيخ عبد الكريم الخضير" }
  ];

  /* يحوّل قائمة الأسطر إلى خريطة { "h1_hadith": "..." } */
  H.load = function () {
    if (!cache) cache = fetch(SRC).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(a => { const m = {}; a.forEach(x => { m[x.number] = window.cleanText ? cleanText(x.text) : x.text; }); return m; });
    return cache;
  };

  /* ألوان الخطوط في النص الأصلي ← أصناف بألوان الموقع */
  const COLORS = { "#008000": "c-q", green: "c-q", "#0000ff": "c-t", blue: "c-t", purple: "c-a", red: "c-r", "#800000": "c-r", "#008080": "c-h" };

  /* تنظيف HTML المصدر: يُبقي على الأسطر والتغميق والتسطير والألوان فقط، وما سواه يصير نصًا */
  H.clean = function (html) {
    const doc = new DOMParser().parseFromString("<body>" + String(html || "") + "</body>", "text/html");
    let out = "";
    (function walk(n) {
      n.childNodes.forEach(c => {
        if (c.nodeType === 3) { out += H.esc(c.nodeValue.replace(/[\r\n]+/g, " ")); return; }
        if (c.nodeType !== 1) return;
        const t = c.tagName.toLowerCase();
        if (t === "br") { out += "<br>"; return; }
        let open = "", close = "";
        if (t === "b") { open = "<b>"; close = "</b>"; }
        else if (t === "u") { open = "<u>"; close = "</u>"; }
        else if (t === "big" || t === "h2" || t === "h3" || t === "h5") { open = '<span class="hh">'; close = "</span>"; }
        else if (t === "font") { const cls = COLORS[(c.getAttribute("color") || "").toLowerCase()]; if (cls) { open = '<span class="' + cls + '">'; close = "</span>"; } }
        out += open; walk(c); out += close;
      });
    })(doc.body);
    /* ضبط الفراغات: لا أكثر من سطرين فارغين متتاليين، ولا أسطر في البداية والنهاية */
    out = out.replace(/^(\s|<br>)+|(\s|<br>)+$/g, "").replace(/ {2,}/g, " ")
      .replace(/(<br>\s*){2,}/g, '<span class="pb"></span>').replace(/(<\/span>)\s*<br>/g, "$1");
    return out;
  };
  H.plain = html => { const d = new DOMParser().parseFromString(String(html || "").replace(/<br\s*\/?>/gi, " "), "text/html"); return d.body.textContent.replace(/\s+/g, " ").trim(); };

  /* حجم الخط */
  H.FS = { small: 19, medium: 22, large: 27 };
  H.fs = () => { const k = H.get("hadithFont", "medium"); return H.FS[k] ? k : "medium"; };
  H.applyFs = function () {
    const k = H.fs();
    document.documentElement.style.setProperty("--hfs", H.FS[k] + "px");
    document.querySelectorAll("[data-fs]").forEach(b => b.classList.toggle("active", b.dataset.fs === k));
  };
  window.setFs = k => { H.set("hadithFont", k); H.applyFs(); };
  window.openSettings = () => { H.applyFs(); const m = document.getElementById("settingsModal"); if (m) m.classList.add("show"); };
  window.closeSettings = () => { const m = document.getElementById("settingsModal"); if (m) m.classList.remove("show"); };
  document.addEventListener("keydown", e => { if (e.key === "Escape") window.closeSettings(); });
  document.addEventListener("DOMContentLoaded", H.applyFs);
})();
