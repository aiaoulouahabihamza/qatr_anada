/* ==========================================================================
   قطر الندى — main.js : الصفحة الرئيسية
   كل الدوال القديمة باقية بأسمائها، وأُضيف: حفظ الإعدادات واسترجاعها،
   إغلاق شاشة البداية بالنقر، والإغلاق بمفتاح Esc.
   ========================================================================== */

/* التخزين المحلي بأمان: قد يفشل في الوضع الخاص أو عند حظره */
function storeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}
function storeSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* لا شيء */ }
}

/* ===== شاشة البداية ===== */
function hideSplash() {
  document.getElementById("splash").classList.add("hide");
}

window.addEventListener("load", () => {
  setTimeout(hideSplash, 5000);
});

/* ===== القائمة الجانبية ===== */
function openDrawer() {
  document.getElementById("drawer").classList.add("open");
  document.getElementById("overlay").classList.add("show");
}
function closeDrawer() {
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
}

/* ===== الإعدادات ===== */
function openSettings() {
  closeDrawer();
  document.getElementById("settingsModal").classList.add("show");
}
function closeSettings() {
  document.getElementById("settingsModal").classList.remove("show");
}

/* الروايات المتاحة: ورش (رسم المجمع) | حفص | ورش بالرسم المغربي */
const RIWAYAT = ["warsh", "hafs", "warsh_ma"];
const FONT_SIZES = ["small", "medium", "large"];

/* applyRiwaya: يعرض الاختيار فقط (عند فتح الصفحة) ولا يحفظ شيئًا،
   حتى لا تُعدّ الرواية الافتراضية اختيارًا من المستخدم. */
function applyRiwaya(type) {
  if (!RIWAYAT.includes(type)) type = "warsh";
  document.documentElement.dataset.riwaya = type;
  document.querySelectorAll("[data-riwaya]").forEach(btn => {
    if (btn.tagName === "BUTTON") {
      btn.classList.toggle("active", btn.dataset.riwaya === type);
    }
  });
}

/* setRiwaya: اختيار صريح من المستخدم، فيُحفظ ويُعلَّم بأنه اختير فعلًا
   (صفحة القرآن لا تعرض شاشة الاختيار الإجباري بعده). */
function setRiwaya(type) {
  if (!RIWAYAT.includes(type)) type = "warsh";
  storeSet("riwaya", type);
  storeSet("riwayaChosen", "1");
  document.documentElement.dataset.riwaya = type;
  document.querySelectorAll("[data-riwaya]").forEach(btn => {
    if (btn.tagName === "BUTTON") {
      btn.classList.toggle("active", btn.dataset.riwaya === type);
    }
  });
}

function setFontSize(size) {
  if (!FONT_SIZES.includes(size)) size = "medium";
  storeSet("fontSize", size);
  document.documentElement.dataset.fontsize = size;
  document.querySelectorAll("[data-size]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.size === size);
  });
}

/* ===== البدء بالقراءة ===== */
function startReading() {
  const last = getLastRead();
  if (last) {
    location.href = "quran/page.html?r=" + last.r + "&p=" + last.p;
  } else {
    location.href = "quran/index.html";
  }
}

/* فتح فهرس السور */
function openQuran() {
  location.href = "quran/index.html";
}

/* آخر قراءة: يكتبها قارئ المصحف في localStorage تحت المفتاح lastRead */
function getLastRead() {
  try {
    const o = JSON.parse(storeGet("lastRead", "null"));
    if (o && o.p > 0 && ["hafs", "warsh", "warsh_ma"].includes(o.r)) return o;
  } catch (e) { /* لا شيء */ }
  return null;
}

const RIWAYA_NAMES = { hafs: "حفص", warsh: "ورش", warsh_ma: "ورش بالرسم المغربي" };
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function arNum(n) { return String(n).replace(/\d/g, d => AR_DIGITS[d]); }

function renderLastRead() {
  const last = getLastRead();
  if (!last) return;
  const t = document.getElementById("lastTitle");
  const s = document.getElementById("lastSub");
  const b = document.getElementById("lastBtn");
  const badge = document.getElementById("lastBadge");
  if (t) t.textContent = last.name ? "سورة " + last.name : "المصحف الشريف";
  if (s) s.textContent = "صفحة " + arNum(last.r === "warsh_ma" ? last.p - 1 : last.p) + (last.juz ? " · الجزء " + arNum(last.juz) : "") + " · برواية " + RIWAYA_NAMES[last.r];
  if (b) b.textContent = "تابع القراءة";
  if (badge) badge.textContent = "حفظ تلقائي";
}

/* ===== عند فتح الصفحة: استرجاع الإعدادات المحفوظة ===== */
document.addEventListener("DOMContentLoaded", () => {
  applyRiwaya(storeGet("riwaya", "warsh"));
  renderLastRead();
  setFontSize(storeGet("fontSize", "medium"));

  /* النقر على شاشة البداية يتخطاها */
  document.getElementById("splash").addEventListener("click", hideSplash);
});

/* مفتاح Esc يغلق النافذة المفتوحة */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeSettings();
    closeDrawer();
  }
});

/* فتح قسم الأذكار */
function openAdkar() {
  location.href = "adkar/index.html";
}

/* بطاقة أوقات الصلاة في الرئيسية (من قسم prayer) */
(function () {
  if (!window.Prayer) return;
  var ORDER = [0, 2, 3, 4, 5];
  function draw() {
    Prayer.next(Prayer.cityCode()).then(function (n) {
      var t = n.today.t, h = Math.floor(n.secs / 3600), m = Math.floor((n.secs % 3600) / 60);
      document.getElementById("prayerNext").textContent = n.name + " بعد " + (h ? h + " س " : "") + m + " د";
      document.getElementById("prayerRows").innerHTML = ORDER.map(function (i) {
        var on = !n.tomorrow ? n.i === i : i === 0;
        return '<div class="prayer-row' + (on ? " active" : "") + '"><span>' + Prayer.NAMES[i] + (on ? ' <span class="now">القادمة</span>' : "") + "</span><b>" + Prayer.fmt(t[i]) + "</b></div>";
      }).join("");
    }).catch(function () { /* تبقى القيم الافتراضية */ });
  }
  draw();
  setInterval(draw, 60000);
})();

/* فتح صفحة مواقيت الصلاة */
function openPrayer() {
  location.href = "prayer/index.html";
}

/* فتح قسم الحديث (الأربعون النووية) */
function openHadith() {
  location.href = "hadith/index.html";
}
