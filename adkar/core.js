/* قطر الندى — adkar/core.js : البيانات والتخزين المشتركان */
(function () {
  "use strict";
  const A = (window.A = {});
  const SRC = "../assets/json/hisnmuslim.json";
  let cache = null;

  A.get = function (k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  A.set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* لا شيء */ } };
  A.ar = function (n) { return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]); };
  A.esc = function (s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); };

  A.load = function () {
    if (!cache) cache = fetch(SRC).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    return cache;
  };

  /* تقدّم اليوم: يُصفَّر مع كل يوم جديد { d: "2026-11-19", c: { "1": { "0": 2 } } } (المتبقّي من كل ذكر) */
  function today() { const t = new Date(); return t.getFullYear() + "-" + (t.getMonth() + 1) + "-" + t.getDate(); }
  A.prog = function () {
    try { const p = JSON.parse(A.get("adkarProg", "{}")); if (p.d === today() && p.c) return p; } catch (e) { /* لا شيء */ }
    return { d: today(), c: {} };
  };
  A.saveProg = function (p) { A.set("adkarProg", JSON.stringify(p)); };
  A.remaining = function (p, cid, i, count) {
    const m = p.c[cid];
    return m && m[i] !== undefined ? m[i] : count;
  };
  A.setRemaining = function (p, cid, i, v) { (p.c[cid] = p.c[cid] || {})[i] = v; };
  A.doneCount = function (p, cat) {
    return cat.array.filter((z, i) => A.remaining(p, cat.id, i, z.count) === 0).length;
  };
})();
