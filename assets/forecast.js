(function () {
  const STAGES = { "Qualified": 10, "Sample / Evaluation": 20, "Design-in": 40, "Design-win": 70, "Pilot": 85 };
  const QUARTERS = ["Q4 2026", "Q1 2027", "Q2 2027"];
  const PRODUCTS = ["5G RedCap", "5G eMBB", "LTE Cat 1 bis", "LTE-M / NB-IoT", "GNSS", "Smart module", "Wi-Fi / Bluetooth"];
  const DEFAULT_TARGET = 1800000;
  const DEMO = [
    ["Alpenlink Metering", "LTE-M / NB-IoT", "Pilot", 620000, 85, "Q4 2026"],
    ["Rhenus Tracking", "LTE Cat 1 bis", "Design-win", 480000, 70, "Q4 2026"],
    ["Nordwind Energy", "LTE-M / NB-IoT", "Pilot", 350000, 85, "Q4 2026"],
    ["Kestrel Telematics", "5G RedCap", "Design-in", 900000, 40, "Q4 2026"],
    ["Solent Health", "Wi-Fi / Bluetooth", "Sample / Evaluation", 150000, 20, "Q4 2026"],
    ["Iberix Mobility", "GNSS", "Design-win", 260000, 70, "Q4 2026"],
    ["Meridian Systems", "5G RedCap", "Design-in", 1200000, 40, "Q1 2027"],
    ["Baltix Devices", "LTE Cat 1 bis", "Design-win", 540000, 70, "Q1 2027"],
    ["Pannon Electronics", "Smart module", "Sample / Evaluation", 700000, 20, "Q1 2027"],
    ["Lumen Connect", "LTE Cat 1 bis", "Pilot", 410000, 85, "Q1 2027"],
    ["Danubia Labs", "GNSS", "Qualified", 300000, 10, "Q1 2027"],
    ["Atlas Mobility", "5G eMBB", "Design-in", 850000, 40, "Q2 2027"],
    ["Zenit Tracking", "LTE-M / NB-IoT", "Sample / Evaluation", 640000, 20, "Q2 2027"],
    ["Cedar Industrial", "LTE Cat 1 bis", "Qualified", 500000, 10, "Q2 2027"],
  ].map(([account, product, stage, amount, prob, close]) => ({ account, product, stage, amount, prob, close }));

  const KEY = "fc-demo-v1";
  let state = load();
  let quarter = "All";

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.rows)) return s;
    } catch (e) { /* storage unavailable */ }
    return { rows: DEMO.map((r) => ({ ...r })), target: DEFAULT_TARGET };
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
  }

  const fmtUSD = (v) => "$" + Math.round(v).toLocaleString("en-US");
  const fmtK = (v) => (Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : "$" + Math.round(v / 1000) + "k");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const category = (p) => (p >= 70 ? "Commit" : p >= 40 ? "Best case" : "Pipeline");
  const catTag = (p) => {
    const c = category(p);
    return `<span class="tag ${c === "Commit" ? "good" : c === "Best case" ? "warn" : ""}">${c}</span>`;
  };
  const weighted = (r) => (r.amount || 0) * (r.prob || 0) / 100;

  /* ---------- tooltip ---------- */
  const tip = document.getElementById("tooltip");
  function showTip(e, html) {
    tip.innerHTML = html;
    tip.classList.add("show");
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8) + "px";
    tip.style.top = Math.max(8, e.clientY - tip.offsetHeight - 10) + "px";
  }
  const hideTip = () => tip.classList.remove("show");

  /* ---------- controls ---------- */
  const targetEl = document.getElementById("target");
  targetEl.value = state.target;
  targetEl.addEventListener("input", () => { state.target = Math.max(0, +targetEl.value || 0); save(); renderSummary(); });

  const chips = document.getElementById("q-chips");
  ["All", ...QUARTERS].forEach((q) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = q === "All" ? "All quarters" : q;
    b.dataset.q = q;
    b.addEventListener("click", () => { quarter = q; renderTable(); renderSummary(); });
    chips.appendChild(b);
  });

  /* ---------- table ---------- */
  const rowsEl = document.getElementById("rows");
  const visible = () => state.rows.map((r, i) => ({ r, i })).filter(({ r }) => quarter === "All" || r.close === quarter);

  function renderTable() {
    rowsEl.innerHTML = visible().map(({ r, i }) => `
      <tr data-i="${i}">
        <td><input class="fc-input fc-text" data-f="account" value="${esc(r.account)}" aria-label="Account"></td>
        <td><select class="fc-input" data-f="product" aria-label="Product">${PRODUCTS.map((p) => `<option${p === r.product ? " selected" : ""}>${p}</option>`).join("")}</select></td>
        <td><select class="fc-input" data-f="stage" aria-label="Stage">${Object.keys(STAGES).map((s) => `<option${s === r.stage ? " selected" : ""}>${s}</option>`).join("")}</select></td>
        <td class="r"><input class="fc-input fc-num" data-f="amount" type="number" min="0" step="10000" value="${r.amount}" aria-label="Amount"></td>
        <td class="r"><span class="fc-pct"><input class="fc-input fc-num fc-small" data-f="prob" type="number" min="0" max="100" step="5" value="${r.prob}" aria-label="Probability">%</span></td>
        <td><select class="fc-input" data-f="close" aria-label="Close quarter">${QUARTERS.map((q) => `<option${q === r.close ? " selected" : ""}>${q}</option>`).join("")}</select></td>
        <td class="r num" data-out="w">${fmtUSD(weighted(r))}</td>
        <td data-out="c">${catTag(r.prob)}</td>
        <td><button class="fc-del" title="Remove" aria-label="Remove prospect">×</button></td>
      </tr>`).join("");
    document.querySelectorAll("#q-chips .chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.q === quarter)));
  }

  rowsEl.addEventListener("input", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const tr = e.target.closest("tr");
    const r = state.rows[+tr.dataset.i];
    let v = e.target.value;
    if (f === "amount") v = Math.max(0, +v || 0);
    if (f === "prob") v = Math.min(100, Math.max(0, +v || 0));
    r[f] = v;
    if (f === "stage") {
      r.prob = STAGES[v];
      tr.querySelector('[data-f="prob"]').value = r.prob;
    }
    tr.querySelector('[data-out="w"]').textContent = fmtUSD(weighted(r));
    tr.querySelector('[data-out="c"]').innerHTML = catTag(r.prob);
    save();
    if (f === "close" && quarter !== "All") renderTable();
    renderSummary();
  });
  rowsEl.addEventListener("click", (e) => {
    if (!e.target.classList.contains("fc-del")) return;
    state.rows.splice(+e.target.closest("tr").dataset.i, 1);
    save(); renderTable(); renderSummary();
  });

  document.getElementById("add").addEventListener("click", () => {
    state.rows.push({ account: "New prospect", product: PRODUCTS[2], stage: "Qualified", amount: 100000, prob: 10,
      close: quarter === "All" ? QUARTERS[0] : quarter });
    save(); renderTable(); renderSummary();
    const inputs = rowsEl.querySelectorAll(".fc-text");
    const last = inputs[inputs.length - 1];
    if (last) { last.focus(); last.select(); }
  });
  document.getElementById("reset").addEventListener("click", () => {
    state = { rows: DEMO.map((r) => ({ ...r })), target: DEFAULT_TARGET };
    targetEl.value = state.target;
    save(); renderTable(); renderSummary();
  });
  document.getElementById("csv").addEventListener("click", () => {
    const head = ["account", "product", "stage", "amount_usd", "probability_pct", "close_quarter", "weighted_usd", "category"];
    const lines = state.rows.map((r) => [r.account, r.product, r.stage, r.amount, r.prob, r.close, Math.round(weighted(r)), category(r.prob)]
      .map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "forecast.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* ---------- summary and charts ---------- */
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, s, attrs = {}) { const t = el("text", { x, y, ...attrs }, parent); t.textContent = s; return t; }
  function vbarPath(x, y0, w, h, r = 4) {
    if (h <= 0) return "";
    r = Math.min(r, h, w / 2);
    const y = y0 - h;
    return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`;
  }

  /* vertical bars with a dashed target line per bar */
  function bars(box, items) {
    box.innerHTML = "";
    const W = 520, H = 260, L = 10, B = 220, T = 24;
    const s = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    const max = Math.max(...items.map((d) => Math.max(d.value, d.target)), 1) * 1.15;
    const sy = (v) => ((B - T) * v) / max;
    el("line", { x1: L, x2: W - L, y1: B, y2: B, class: "grid" }, s);
    const step = (W - 2 * L) / items.length, bw = Math.min(90, step * 0.5);
    items.forEach((d, i) => {
      const g = el("g", { class: "row" }, s);
      const cx = L + step * i + step / 2;
      el("rect", { x: cx - step / 2, y: 0, width: step, height: B, class: "hit" }, g);
      el("path", { d: vbarPath(cx - bw / 2, B, bw, sy(d.value)), class: "bar" }, g);
      const ty = B - sy(d.target);  // target line per bar
      el("line", { x1: cx - bw / 2 - 12, x2: cx + bw / 2 + 12, y1: ty, y2: ty, class: "ref" }, g);
      text(g, cx, B - sy(d.value) - 8, fmtK(d.value), { "text-anchor": "middle", class: "num", style: "fill:var(--ink);font-weight:600" });
      text(g, cx, B + 18, d.label, { "text-anchor": "middle" });
      const pct = d.target ? Math.round((d.value / d.target) * 100) + "% of target" : "";
      text(g, cx, B + 34, pct, { "text-anchor": "middle", class: "axis-label" });
      g.addEventListener("mousemove", (e) => showTip(e, `<b>${d.label}</b><br>${d.tip || ""}Forecast ${fmtUSD(d.value)}<br>Target ${fmtUSD(d.target)}<br>Gap ${fmtUSD(d.value - d.target)}`));
      g.addEventListener("mouseleave", hideTip);
    });
    box.appendChild(s);
  }

  function renderSummary() {
    const rows = state.rows.filter((r) => quarter === "All" || r.close === quarter);
    const nQ = quarter === "All" ? QUARTERS.length : 1;
    const target = state.target * nQ;
    const total = rows.reduce((a, r) => a + (r.amount || 0), 0);
    const w = rows.reduce((a, r) => a + weighted(r), 0);
    const commit = rows.filter((r) => r.prob >= 70).reduce((a, r) => a + r.amount, 0);
    const best = rows.filter((r) => r.prob >= 40 && r.prob < 70).reduce((a, r) => a + r.amount, 0);
    const gap = w - target;
    const cov = target ? total / target : 0;

    const kpis = [
      ["Total pipeline", fmtK(total), "neutral", `${rows.length} prospects`],
      ["Weighted forecast", fmtK(w), "neutral", "amount × probability"],
      ["Target", fmtK(target), "neutral", quarter === "All" ? `${nQ} quarters` : quarter],
      ["Gap to target", (gap >= 0 ? "+" : "−") + fmtK(Math.abs(gap)).slice(0), gap >= 0 ? "good" : "bad", gap >= 0 ? "▲ on track" : "▼ below target"],
      ["Commit", fmtK(commit), "neutral", "probability 70% or more"],
      ["Pipeline coverage", cov.toFixed(1) + "×", cov >= 3 ? "good" : "bad", cov >= 3 ? "▲ 3× or more" : "▼ aim for 3×"],
    ];
    document.getElementById("fc-kpis").innerHTML = kpis.map(([l, v, c, d]) =>
      `<div class="kpi"><span class="label">${l}</span><div class="value num">${v}</div><div class="delta ${c}">${d}</div></div>`).join("");

    document.getElementById("scen-sub").textContent = (quarter === "All" ? "All quarters" : quarter) + " vs target";
    bars(document.getElementById("chart-scen"), [
      { label: "Commit only", value: commit, target, tip: "Only deals at 70% or more, full amount<br>" },
      { label: "Commit + Best case", value: commit + best, target, tip: "Deals at 40% or more, full amount<br>" },
      { label: "Weighted", value: w, target, tip: "Every deal × its probability<br>" },
    ]);
    bars(document.getElementById("chart-q"), QUARTERS.map((q) => {
      const qr = state.rows.filter((r) => r.close === q);
      return { label: q, value: qr.reduce((a, r) => a + weighted(r), 0), target: state.target, tip: `${qr.length} prospects<br>` };
    }));

    document.getElementById("foot").innerHTML = `<tr><td colspan="3"><b>Total</b></td><td class="r num"><b>${fmtUSD(total)}</b></td>
      <td class="r num">${total ? Math.round((w / total) * 100) + "% avg" : ""}</td><td></td><td class="r num"><b>${fmtUSD(w)}</b></td><td colspan="2"></td></tr>`;
  }

  renderTable();
  renderSummary();
})();
