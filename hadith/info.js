(function () {
  "use strict";
  const body = document.getElementById("body"), tabsEl = document.getElementById("tabs");
  /* الأقسام التعريفية: كتاب، مؤلف، مقدمة النووي، ومقدمات الشروح */
  const SECS = [
    { t: "الكتاب", k: ["ns_2001"] },
    { t: "المؤلف", k: ["ns_2002"] },
    { t: "مقدمة النووي", k: ["ns_2004"] },
    { t: "التحفة الربانية", k: ["ns_2005"] },
    { t: "الإعراب", k: ["ns_2006"] },
    { t: "ابن رجب", k: ["ns_2007"] },
    { t: "ابن عثيمين", k: ["ns_2008"] },
    { t: "الخضير", k: ["ns_2009"] }
  ];
  let data = null, cur = 0;
  function draw() {
    tabsEl.innerHTML = SECS.map((s, i) => '<button data-i="' + i + '" class="' + (i === cur ? "on" : "") + '">' + s.t + "</button>").join("");
    body.innerHTML = '<article class="hcard"><div class="htxt">' + SECS[cur].k.map(k => H.clean(data[k])).join("<br><br>") + "</div></article>";
    const on = tabsEl.querySelector(".on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
    window.scrollTo(0, 0);
  }
  tabsEl.addEventListener("click", e => { const b = e.target.closest("[data-i]"); if (!b) return; cur = +b.dataset.i; draw(); });
  H.load().then(m => { data = m; draw(); window.__ready = true; })
    .catch(() => { body.innerHTML = '<p class="qempty">تعذّر تحميل المحتوى</p>'; });
})();
