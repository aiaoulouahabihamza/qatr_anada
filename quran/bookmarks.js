/* قطر الندى — قائمة العلامات المرجعية */
(function () {
  "use strict";
  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const fEl = document.getElementById("filters");
  let color = "";

  function render() {
    const all = Q.bms();
    document.getElementById("bmCount").textContent = all.length ? Q.ar(all.length) + " علامة" : "لا علامات";
    const used = Q.BM_COLORS.filter(c => all.some(b => b.color === c.id));
    fEl.innerHTML = used.length > 1
      ? '<button data-c="" class="' + (color ? "" : "on") + '">الكل</button>' + used.map(c =>
        '<button data-c="' + c.id + '" class="' + (color === c.id ? "on" : "") + '" style="--c:' + c.hex + '"><i></i>' + c.name + "</button>").join("")
      : "";
    const items = all.filter(b => !color || b.color === color);
    emptyEl.hidden = all.length > 0;
    listEl.innerHTML = items.map(b => {
      const href = "page.html?r=" + b.r + "&p=" + b.p;
      return '<a class="bmrow" href="' + href + '" style="--c:' + Q.bmColor(b.color) + '">' +
        '<span class="dot"></span><span class="bmi"><b>' + Q.esc(b.name) + "</b><small>سورة " + Q.esc(b.sname) + " · الآية " + Q.ar(b.aya) +
        " · ص " + Q.ar(Q.showPage(b.r, b.p)) + " · " + Q.EDITIONS[b.r].name + "</small></span>" +
        '<button class="x" data-r="' + b.r + '" data-v="' + b.v + '" aria-label="حذف العلامة"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.7"><path class="fl" d="M7 7l1 13h8l1-13z" /><path d="M4.5 7h15M9 7V4h6v3M7 7l1 13h8l1-13" /><path class="ac" d="M10.2 11v6M13.8 11v6" /></svg></button></a>';
    }).join("");
  }
  fEl.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (b) { color = b.dataset.c; render(); } });
  listEl.addEventListener("click", e => {
    const x = e.target.closest(".x");
    if (!x) return;
    e.preventDefault();
    if (confirm("حذف هذه العلامة؟")) { Q.bmDel(x.dataset.r, x.dataset.v); render(); }
  });
  render();
})();
