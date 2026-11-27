/* قطر الندى — adkar/core.js : البيانات والتخزين المشتركان */
(function () {
  "use strict";
  const A = (window.A = {});
  const SRC = "../assets/json/duaa.json";
  let cache = null;

  A.get = function (k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  A.set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* لا شيء */ } };
  A.ref = function (r) { return [r.book, r.numberOrPage ? "رقم/صفحة " + A.ar(r.numberOrPage) : "", r.grade].filter(Boolean).join(" — "); };
  A.ar = function (n) { return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]); };
  A.esc = function (s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); };

  /* الأبواب المتكررة بالاسم نفسه تُدمج في باب واحد */
  function merge(d) {
    const by = {}, out = [];
    d.forEach(c => { const k = c.category.trim(); if (by[k]) by[k].duaa = by[k].duaa.concat(c.duaa); else { by[k] = c; out.push(c); } });
    return out;
  }
  A.load = function () {
    if (!cache) cache = fetch(SRC).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(d => merge(window.cleanDeep ? cleanDeep(d) : d));
    return cache;
  };

})();
