/* ==========================================================================
   قطر الندى — nav.js : المظهر الليلي، التنقّل الهرمي، وخصائص PWA والعمل دون نت
   ========================================================================== */
(function () {
  var root = document.documentElement, KEY = "theme";
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(t) {
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", t === "dark" ? "#121417" : "#033649");
  }
  var t = get() || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  apply(t);
  window.toggleTheme = function () {
    var n = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try { localStorage.setItem(KEY, n); } catch (e) { /* لا شيء */ }
    apply(n);
    var b = document.getElementById("themeBtn");
    if (b) b.setAttribute("aria-pressed", n === "dark");
    document.dispatchEvent(new CustomEvent("qatr-theme", { detail: n }));
  };

  /* تنظيف الأقواس: ﴿{...}﴾ و {…} و ((…)) و ( ) الفارغة وتوازن ﴿ ﴾ */
  window.cleanText = function (s) {
    if (typeof s !== "string" || !s) return s;
    return s
      .replace(/﴿\s*\{\s*/g, "﴿").replace(/\s*\}\s*﴾/g, "﴾")
      .replace(/\{([^{}]{1,600}?)\}/g, "﴿$1﴾")
      .replace(/\[([^\[\]{}]{1,600}?)\}/g, "[$1]")
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
  var scriptEl = document.currentScript;
  var ROOT_URL = scriptEl ? new URL("./", scriptEl.src).href : (location.origin + "/");
  var ROOT_PATH = new URL(ROOT_URL).pathname;

  var path = location.pathname;
  var rel = path.indexOf(ROOT_PATH) === 0 ? path.slice(ROOT_PATH.length) : path.replace(/^\/+/, "");
  rel = rel.replace(/\/+$/, "");

  var isHome = !rel || rel === "index.html";
  var segs = rel ? rel.split("/") : [];
  var isSectionIndex = !isHome && (segs.length === 1 || (segs.length === 2 && segs[1] === "index.html"));
  var parent = isHome ? null : (isSectionIndex ? ROOT_URL + "index.html" : ROOT_URL + segs[0] + "/index.html");

  var ignorePop = 0;
  var guardArmed = false;
  var navigating = false;
  var closingFromPop = false;
  var layerTimer = 0;

  function stateVal() { return hist.state && hist.state.qn; }

  function openLayers() {
    return Array.prototype.slice.call(document.querySelectorAll(".modal.show, #drawer.open"));
  }
  function closeLayers() {
    openLayers().forEach(function (el) {
      if (el.classList.contains("modal")) {
        el.classList.remove("show");
      }
      if (el.id === "drawer") {
        if (typeof window.closeDrawer === "function") window.closeDrawer();
        else { el.classList.remove("open"); var o = document.getElementById("overlay"); if (o) o.classList.remove("show"); }
      }
    });
  }

  /* ===== التنقّل: ينتقل مباشرةً مع الحفاظ على التدرّج الهرمي ===== */
  function go(url, replaceMode) {
    var target;
    try { target = new URL(url, location.href).href; } catch (e) { target = url; }
    navigating = true;
    clearTimeout(layerTimer);
    try { sessionStorage.setItem("qatrNav", "1"); } catch (e) { /* لا شيء */ }

    var layers = openLayers();
    if (layers.length) {
      layers.forEach(function (el) {
        el.classList.remove("show");
        el.classList.remove("open");
      });
      var ov = document.getElementById("overlay");
      if (ov) ov.classList.remove("show");
    }

    if (replaceMode) location.replace(target);
    else location.assign(target);
  }
  window.go = go;

  /* ===== الروابط الداخلية تمرّ عبر go ===== */
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
    go(u.href);
  });

  /* ===== حارس الدخول المباشر لصفحة فرعية (كي لا يخرج زر الرجوع من التطبيق) ===== */
  function needsDirectGuard() {
    if (isHome) return false;
    var hasInAppRef = document.referrer && document.referrer.indexOf(ROOT_URL) === 0;
    var hasNav = false;
    try { hasNav = sessionStorage.getItem("qatrNav") === "1"; } catch (e) { /* لا شيء */ }
    if (hasInAppRef && hasNav && hist.length > 1) return false;
    return true;
  }

  function armDirectGuard() {
    if (guardArmed || !needsDirectGuard()) return;
    guardArmed = true;
    ["pointerdown", "keydown", "touchend", "click"].forEach(function (n) {
      document.removeEventListener(n, armDirectGuard, true);
    });
    if (stateVal() !== "guard" && stateVal() !== "layer") {
      hist.replaceState({ qn: "base" }, "");
      hist.pushState({ qn: "guard" }, "");
    }
  }
  if (needsDirectGuard()) {
    try {
      if (stateVal() !== "guard" && stateVal() !== "layer") {
        hist.replaceState({ qn: "base" }, "");
        hist.pushState({ qn: "guard" }, "");
        guardArmed = true;
      }
    } catch (e) { /* ينتظر أول لمسة */ }
    ["pointerdown", "keydown", "touchend", "click"].forEach(function (n) {
      document.addEventListener(n, armDirectGuard, true);
    });
  }

  /* ===== مدخل للنافذة/القائمة المفتوحة ليغلقها زر الرجوع أولًا ===== */
  function syncLayers() {
    if (navigating || closingFromPop) return;
    var open = openLayers().length > 0;
    var sv = stateVal();
    if (open && sv !== "layer") {
      hist.pushState({ qn: "layer" }, "");
    } else if (!open && sv === "layer") {
      ignorePop++;
      hist.back();
    }
  }
  function scheduleSyncLayers() {
    if (navigating || closingFromPop) return;
    clearTimeout(layerTimer);
    layerTimer = setTimeout(syncLayers, 30);
  }
  function watch() {
    if (!window.MutationObserver || !document.body) return;
    var mo = new MutationObserver(scheduleSyncLayers);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  if (document.body) watch(); else document.addEventListener("DOMContentLoaded", watch);

  /* ===== استجابة زر الرجوع ===== */
  window.addEventListener("popstate", function () {
    if (ignorePop > 0) { ignorePop--; return; }
    if (openLayers().length) {
      closingFromPop = true;
      clearTimeout(layerTimer);
      closeLayers();
      setTimeout(function () { closingFromPop = false; }, 80);
      return;
    }
    if (!isHome && stateVal() === "base" && parent) {
      navigating = true;
      try { sessionStorage.setItem("qatrNav", "1"); } catch (e) { /* لا شيء */ }
      location.replace(parent);
    }
  });

  window.addEventListener("pageshow", function () {
    navigating = false;
    closingFromPop = false;
  });

  /* ===== PWA: Service Worker + التثبيت + شارة عدم الاتصال ===== */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(ROOT_URL + "sw.js", { scope: ROOT_PATH })
        .then(function (reg) { if (reg && reg.update) reg.update(); })
        .catch(function () { /* لا شيء */ });
    });
  }

  var deferredPrompt = null;
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }
  function syncInstallButtons() {
    var btn = document.getElementById("pwaInstallBtn");
    if (!btn) return;
    /* الزر يظهر دائمًا ما لم يكن التطبيق مثبّتًا، ليحصل المستخدم على استجابة في كل المتصفحات */
    btn.hidden = isStandalone();
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    syncInstallButtons();
    document.dispatchEvent(new CustomEvent("qatr-pwa-ready"));
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    syncInstallButtons();
  });

  var iosStepsHTML = null;
  var OTHER_STEPS = "<li>افتح قائمة المتصفح (<b>⋮</b> أو <b>⋯</b>).</li>" +
    "<li>اختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.</li>" +
    "<li>إن لم يظهر الخيار فافتح الموقع في Chrome أو Edge أو Safari مباشرةً، وليس من داخل تطبيق آخر مثل فيسبوك أو واتساب.</li>";

  function showInstallHelp(ios) {
    var m = document.getElementById("iosInstallModal");
    if (!m) return false;
    var ol = m.querySelector(".ios-steps");
    if (ol) {
      if (iosStepsHTML === null) iosStepsHTML = ol.innerHTML;
      ol.innerHTML = ios ? iosStepsHTML : OTHER_STEPS;
    }
    if (typeof window.closeDrawer === "function") window.closeDrawer();
    m.classList.add("show");
    return true;
  }

  window.QatrPWA = {
    isStandalone: isStandalone,
    isIOS: isIOS,
    canInstall: function () { return !isStandalone(); },
    promptInstall: async function () {
      if (isStandalone()) return false;
      if (deferredPrompt) {
        var p = deferredPrompt;
        deferredPrompt = null; /* prompt() يُستدعى مرة واحدة فقط لكل حدث */
        try {
          if (typeof window.closeDrawer === "function") window.closeDrawer();
          p.prompt();
          await p.userChoice;
        } catch (e) { /* لا شيء */ }
        syncInstallButtons();
        return true;
      }
      /* لا يوجد طلب تثبيت من المتصفح: نعرض الخطوات اليدوية */
      return showInstallHelp(isIOS());
    }
  };

  function updateOnlineBadge() {
    if (!document.body) return;
    var el = document.getElementById("offlinePill");
    if (navigator.onLine) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement("div");
      el.id = "offlinePill";
      el.className = "offline-pill";
      el.setAttribute("role", "status");
      el.textContent = "وضع عدم الاتصال — التصفح من المحفوظ";
      document.body.appendChild(el);
    }
  }
  window.addEventListener("online", updateOnlineBadge);
  window.addEventListener("offline", updateOnlineBadge);
  document.addEventListener("DOMContentLoaded", function () {
    syncInstallButtons();
    updateOnlineBadge();
  });
})();
