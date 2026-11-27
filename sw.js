/* ==========================================================================
   قطر الندى — sw.js : خدمة العمل دون اتصال (PWA Service Worker)
   استراتيجية تخزين مؤقت ذكية: Cache-First للخطوط والصور، Network-First للصفحات والبيانات
   مع التحديث التلقائي للكاش وحفظ الصفحات دون اتصال
   ========================================================================== */

const SHELL_CACHE = "qatr-shell-v17";
const DATA_CACHE = "qatr-data-v6";
const AUDIO_CACHE = "qatr-audio-v2";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/var.css",
  "/style.css",
  "/nav.js",
  "/main.js",
  "/quran/index.html",
  "/quran/page.html",
  "/quran/bookmarks.html",
  "/quran/style.css",
  "/quran/core.js",
  "/quran/index.js",
  "/quran/page.js",
  "/quran/tafsir.js",
  "/quran/audio.js",
  "/quran/bookmarks.js",
  "/adkar/index.html",
  "/adkar/dhikr.html",
  "/adkar/style.css",
  "/adkar/core.js",
  "/adkar/index.js",
  "/adkar/dhikr.js",
  "/duaa/index.html",
  "/duaa/dua.html",
  "/duaa/style.css",
  "/duaa/core.js",
  "/duaa/index.js",
  "/duaa/dua.js",
  "/hadith/index.html",
  "/hadith/page.html",
  "/hadith/info.html",
  "/hadith/style.css",
  "/hadith/core.js",
  "/hadith/index.js",
  "/hadith/page.js",
  "/hadith/info.js",
  "/prayer/index.html",
  "/prayer/style.css",
  "/prayer/calc.js",
  "/prayer/core.js",
  "/prayer/prayer.js",
  "/assets/img/logo.png",
  "/assets/img/logo-s.png",
  "/assets/img/logo.svg",
  "/assets/img/icon-180.png",
  "/assets/img/icon-192.png",
  "/assets/img/icon-512.png",
  "/assets/img/icon-192.svg",
  "/assets/img/icon-512.svg",
  "/assets/img/icon-maskable-512.png",
  "/assets/img/ayah_frame_brown.svg",
  "/assets/img/surah_frame_brown.svg",
  "/assets/img/page_frame_box_brown.svg",
  "/assets/img/q-makki.svg",
  "/assets/img/q-madani.svg",
  "/assets/img/q-divider.svg",
  "/assets/img/q-juz-plate.svg",
  "/assets/img/q-medallion.svg",
  "/assets/img/q-mihrab.svg",
  "/assets/font/Amiri-Regular.ttf",
  "/assets/font/Cairo-Regular.ttf",
  "/assets/font/almarai-regular.ttf",
  "/assets/font/Tajawal-Light.ttf",
  "/assets/font/Tajawal-Regular.ttf",
  "/assets/font/Tajawal-Medium.ttf",
  "/assets/font/DecoType_Thuluth_Regular.ttf",
  "/assets/font/DIN.ttf",
  "/assets/font/hafs.ttf",
  "/assets/font/warsh.ttf",
  "/assets/font/aalmaghrabi.ttf",
  "/assets/font/surah-names.ttf",
  "/assets/font/%D8%AE%D8%B7%20%D8%A7%D8%B3%D9%85%D8%A7%D8%A1%20%D8%A7%D9%84%D8%B3%D9%88%D8%B1.ttf"
];

const CORE_DATA_ASSETS = [
  "/assets/quran_hafs/surah.json",
  "/assets/quran_hafs/page.json",
  "/assets/quran_hafs/juz.json",
  "/assets/quran_hafs/quran.json",
  "/assets/quran_warsh/warshData.json",
  "/assets/quran_warsh/map_hafs.json",
  "/assets/quran_warsh_ma/surah.json",
  "/assets/quran_warsh_ma/ahzab.json",
  "/assets/quran_warsh_ma/pages.json",
  "/assets/json/hisnmuslim.json",
  "/assets/json/duaa.json",
  "/assets/json/arba3un.json",
  "/assets/json/prayer_cities.json",
  "/assets/json/horaires-2026-11.js"
];

/* عند التثبيت: تحميل الأصول الأساسية والخطوط في الكاش */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.allSettled(
      SHELL_ASSETS.map((url) => shell.add(new Request(url, { cache: "no-cache" })))
    );
    const data = await caches.open(DATA_CACHE);
    await Promise.allSettled(
      CORE_DATA_ASSETS.map((url) => data.add(url))
    );
    await self.skipWaiting();
  })());
});

/* عند التفعيل: حذف الإصدارات القديمة من الكاش تلقائياً */
self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, DATA_CACHE, AUDIO_CACHE]);
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (keep.has(k) ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isHtmlRequest(req, url) {
  return req.mode === "navigate" || url.pathname === "/" || url.pathname.endsWith(".html");
}

function isFontOrImage(url) {
  return /\.(ttf|woff|woff2|eot|otf|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(url.pathname);
}

function isJsonData(url) {
  return /\.json$/i.test(url.pathname) || url.pathname.startsWith("/assets/json/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  /* الصوتيات .mp3 يديرها audio.js */
  if (/\.mp3(\?.*)?$/i.test(url.pathname)) return;

  /* واجهة mp3quran للقرّاء والتوقيت: Network-First ثم المخبأ */
  if (url.hostname.includes("mp3quran.net")) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch (e) {
        const hit = await cache.match(req);
        return hit || new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* 1. الخطوط والصور: استراتيجية Cache-First الصارمة لأعلى أداء وسرعة */
  if (isFontOrImage(url)) {
    event.respondWith((async () => {
      const match = await caches.match(req, { ignoreSearch: true });
      if (match) return match;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const targetCache = await caches.open(SHELL_CACHE);
          targetCache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return new Response("", { status: 404 });
      }
    })());
    return;
  }

  /* 2. ملفات JSON والبيانات: Cache-First ذكي مع الحفظ عند التصفح لأول مرة */
  if (isJsonData(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          cache.put(req, res.clone());
        }
        return res;
      } catch (e) {
        return new Response(JSON.stringify({ error: "offline_missing" }), {
          status: 503,
          headers: { "Content-Type": "application/json; charset=utf-8" }
        });
      }
    })());
    return;
  }

  /* 3. صفحات HTML: استراتيجية Network-First للتحديث السريع مع الرجوع للكاش عند انقطاع النت */
  if (isHtmlRequest(req, url)) {
    event.respondWith((async () => {
      const shell = await caches.open(SHELL_CACHE);
      try {
        const freshReq = new Request(url.href, { method: "GET", credentials: req.credentials, cache: "no-cache" });
        const res = await fetch(freshReq);
        if (res && res.ok && !res.redirected) {
          shell.put(url.pathname, res.clone());
        }
        return res;
      } catch (e) {
        const cached = await shell.match(req, { ignoreSearch: true }) ||
          await shell.match(url.pathname, { ignoreSearch: true });
        if (cached) return cached;
        return (await shell.match("/index.html")) || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  /* 4. ملفات CSS/JS الأساسية: Cache-First مع تحديث الخلفية */
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const shell = await caches.open(SHELL_CACHE);
        shell.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return new Response("", { status: 504 });
    }
  })());
});
