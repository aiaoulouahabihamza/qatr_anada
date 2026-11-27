/* ==========================================================================
   قطر الندى — nav.js : التنقّل الهرمي ومحاكاة زر الرجوع في أندرويد
   --------------------------------------------------------------------------
   الفكرة: لا نبني سجلًّا يكبر مع كل صفحة. السجلّ ثابت دائمًا على مدخلين فقط
   (الصفحة + حارس)، والانتقال يتم بالاستبدال لا بالإضافة، فلا يتباطأ الرجوع
   مهما تنقّلت. زر الرجوع يعمل بحسب موضع الصفحة في التطبيق:
       آية  ← فهرس السور ← الرئيسية ← خروج
   وإن كانت نافذة أو قائمة مفتوحة أُغلقت أولًا.
   ========================================================================== */
/* ===== الوضع الليلي: يُطبَّق قبل الرسم لتفادي الوميض ===== */
(function () {
  var root = document.documentElement, KEY = "theme";
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(t) {
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#04101f" : "#033649");
  }
  var t = get() || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  apply(t);
  window.toggleTheme = function () {
    var n = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, n); } catch (e) { /* لا شيء */ }
    apply(n);
    var b = document.getElementById("themeBtn"); if (b) b.setAttribute("aria-pressed", n === "dark");
  };
  /* تنظيف الأقواس: ﴿{...}﴾ و {…} و ((…)) و ( ) الفارغة وتوازن ﴿ ﴾ */
  window.cleanText = function (s) {
    if (typeof s !== "string" || !s) return s;
    return s
      .replace(/﴿\s*\{\s*/g, "﴿").replace(/\s*\}\s*﴾/g, "﴾")
      .replace(/\{([^{}]{1,600}?)\}/g, "﴿$1﴾")
      .replace(/\[([^\[\]{}]{1,60}?)\}/g, "[$1]")
      .replace(/\(\(\s*([^()]{1,900}?)\s*\)\)/g, "«$1»")
      .replace(/\(\s*\)/g, "")
      .replace(/﴿{2,}/g, "﴿").replace(/﴾{2,}/g, "﴾")
      .replace(/﴿\s+/g, "﴿").replace(/\s+﴾/g, "﴾")
      .replace(/[ \t]{2,}/g, " ");
  };
  window.cleanDeep = function f(o) {
    if (typeof o === "string") return window.cleanText(o);
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) o[i] = f(o[i]); return o; }
    if (o && typeof o === "object") { for (var k in o) o[k] = f(o[k]); }
    return o;
  };
})();

(function () {
  "use strict";
  var hist = window.history;

  /* الرئيسية تحمّل var.css من نفس المجلد، والأقسام من المجلد الأعلى */
  var link = document.querySelector('link[href$="var.css"]');
  var isHome = !!link && link.getAttribute("href") === "var.css";
  var file = location.pathname.split("/").pop() || "index.html";
  var parent = isHome ? null : (file === "index.html" ? "../index.html" : "index.html");

  var pending = null;     /* وجهة تنتظر عودة السجلّ إلى مدخله الأول */
  var ignorePop = 0;      /* نتجاهل popstate الذي أحدثناه نحن */
  var armed = false;

  function depth() { return hist.state && typeof hist.state.qn === "number" ? hist.state.qn : -1; }

  /* ===== الانتقال: يستبدل الصفحة الحالية ولا يضيف مدخلًا ===== */
  function go(url) {
    var d = depth();
    if (d > 0) {
      pending = url;
      hist.go(-d);
      setTimeout(function () { if (pending) { var u = pending; pending = null; location.replace(u); } }, 350);
    } else {
      location.replace(url);
    }
  }
  window.go = go;

  /* ===== الروابط العادية تمرّ عبر go ===== */
  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var a = e.target.closest && e.target.closest("a[href]");
    if (!a || a.target || a.hasAttribute("download")) return;
    var h = a.getAttribute("href");
    if (!h || h.charAt(0) === "#" || /^(mailto:|tel:|javascript:)/i.test(h)) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin) return;
    e.preventDefault();
    go(h);
  });

  /* ===== النوافذ والقوائم المفتوحة ===== */
  function openLayers() {
    return Array.prototype.slice.call(document.querySelectorAll(".modal.show, #drawer.open"));
  }
  function closeLayers() {
    openLayers().forEach(function (el) {
      if (el.classList.contains("modal")) el.click();          /* نقرة الخلفية تنفّذ الإغلاق الأصلي (وإن كان له تنظيف) */
      if (el.classList.contains("modal") && el.classList.contains("show")) el.classList.remove("show");
      if (el.id === "drawer") {
        if (typeof window.closeDrawer === "function") window.closeDrawer();
        else { el.classList.remove("open"); var o = document.getElementById("overlay"); if (o) o.classList.remove("show"); }
      }
    });
  }

  /* ===== الحارس: مدخل واحد فوق الصفحة، يُنشأ عند أول لمسة =====
     (كروم يتجاهل المدخلات المضافة دون تفاعل المستخدم، لذلك ننتظر اللمسة) */
  function arm() {
    if (armed) return;
    armed = true;
    ["pointerup", "pointerdown", "click", "keydown", "touchend"].forEach(function (n) { document.removeEventListener(n, arm, true); });
    if (depth() < 0) hist.replaceState({ qn: 0 }, "");
    if (depth() === 0) hist.pushState({ qn: 1 }, "");
  }
  ["pointerup", "pointerdown", "click", "keydown", "touchend"].forEach(function (n) { document.addEventListener(n, arm, true); });

  /* ===== مدخل إضافي لكل نافذة مفتوحة، ويُزال عند إغلاقها بالواجهة ===== */
  function layersChanged() {
    var open = openLayers().length > 0, d = depth();
    if (open && d === 1) hist.pushState({ qn: 2 }, "");
    else if (!open && d === 2) { ignorePop++; hist.back(); }
  }
  function watch() {
    if (!window.MutationObserver) return;
    var mo = new MutationObserver(function () { layersChanged(); });
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);

  /* ===== زر الرجوع ===== */
  window.addEventListener("popstate", function () {
    if (ignorePop > 0) { ignorePop--; return; }
    if (pending) { var u = pending; pending = null; location.replace(u); return; }
    var d = depth();
    if (d === 1 && openLayers().length) { closeLayers(); return; }  /* رجعنا من مستوى النافذة */
    if (d === 2) return;
    if (d <= 0) {                                                   /* وصلنا إلى مدخل الصفحة نفسها */
      if (openLayers().length) { closeLayers(); }
      if (parent) location.replace(parent);
      else hist.back();                                             /* الرئيسية: خروج من التطبيق */
    }
  });

})();
