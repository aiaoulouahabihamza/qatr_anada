(function () {
  "use strict";
  let n = +new URLSearchParams(location.search).get("n") || 1;
  n = Math.max(1, Math.min(H.TOTAL, n));
  const body = document.getElementById("body"), tabsEl = document.getElementById("tabs");
  let data = null, tab = H.get("hadithTab", "hadith");

  function tabs() { return H.TABS.filter(t => (data["h" + n + "_" + t.k] || "").trim()); }

  function draw() {
    const ts = tabs();
    if (!ts.some(t => t.k === tab)) tab = "hadith";
    tabsEl.innerHTML = ts.map(t => '<button data-k="' + t.k + '" class="' + (t.k === tab ? "on" : "") + '">' + t.t + "</button>").join("");
    const T = H.TABS.find(t => t.k === tab), html = H.clean(data["h" + n + "_" + tab]);
    body.innerHTML = '<article class="hcard' + (tab === "hadith" ? " hhadith" : "") + '">' +
      (T.s ? '<div class="hsrc">' + T.s + "</div>" : "") + '<div class="htxt">' + html + "</div></article>";
    const on = tabsEl.querySelector(".on"); if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
    window.scrollTo(0, 0);
  }

  function setN(k) {
    n = k; H.set("hadithLast", n);
    history.replaceState(null, "", "?n=" + n);
    document.getElementById("barTitle").textContent = "الحديث " + H.ORD[n - 1];
    document.getElementById("barSub").textContent = H.ar(n) + " من " + H.ar(H.TOTAL);
    document.title = "الحديث " + H.ORD[n - 1] + " — قطر الندى";
    document.getElementById("prev").disabled = n <= 1;
    document.getElementById("next").disabled = n >= H.TOTAL;
    draw();
  }

  tabsEl.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (!b) return; tab = b.dataset.k; H.set("hadithTab", tab); draw(); });
  document.getElementById("prev").onclick = () => n > 1 && setN(n - 1);
  document.getElementById("next").onclick = () => n < H.TOTAL && setN(n + 1);

  H.load().then(m => { data = m; setN(n); window.__ready = true; })
    .catch(() => { body.innerHTML = '<p class="qempty">تعذّر تحميل الحديث</p>'; });
})();
