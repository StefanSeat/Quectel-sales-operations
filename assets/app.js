(function () {
  const D = window.SALES_DATA;
  const OPPS = D.opportunities;
  const REGIONS = Object.keys(D.targets_musd);
  const CLOSED = ["Mass production", "Lost"];
  const isOpen = (o) => !CLOSED.includes(o.stage);

  const STAGES = [
    { name: "Lead", p: 5, days: "0 to 30",
      entry: "Contact or company shows interest (website, tradeshow, distributor, referral).",
      exit: ["Use case and application known", "Decision maker or engineer identified", "Rough volume estimate"],
      fields: ["Account", "Source", "Country", "Product interest"] },
    { name: "Qualified", p: 10, days: "15 to 45",
      entry: "There is a real device project with a timeline.",
      exit: ["Project created in CRM", "Target launch date", "Annual volume estimate", "Module family selected"],
      fields: ["Project", "Vertical", "Annual units", "Expected close"] },
    { name: "Sample / Evaluation", p: 20, days: "30 to 90",
      entry: "Customer is testing our module on an evaluation board.",
      exit: ["Samples or EVB shipped and logged", "FAE assigned", "Technical feedback received"],
      fields: ["Sample request ID", "FAE", "Competitor", "Next action"] },
    { name: "Design-in", p: 40, days: "60 to 180",
      entry: "Our module is in the customer's hardware design.",
      exit: ["Schematic or layout review done", "Price quote accepted in principle", "Certification plan known"],
      fields: ["Quote", "ASP", "Certification needs", "Next action"] },
    { name: "Design-win", p: 70, days: "30 to 120",
      entry: "Customer confirms our module is selected for the product.",
      exit: ["Written confirmation or BOM lock", "Production volumes and ramp plan", "Pilot date agreed"],
      fields: ["Win confirmation", "Ramp plan", "Project life (years)"] },
    { name: "Pilot", p: 85, days: "30 to 90",
      entry: "Pre-series production with first orders.",
      exit: ["Pilot PO received", "Certification passed", "Mass production PO date"],
      fields: ["Pilot PO", "Shipment link", "Forecast category"] },
    { name: "Mass production", p: 100, days: "Ongoing",
      entry: "Recurring orders. The opportunity is won and revenue is tracked as shipments.",
      exit: ["Hand over to account management", "Monthly shipment vs forecast tracking"],
      fields: ["Shipment data from Finance", "Next project for cross-sell"] },
  ];
  const STAGE_NAMES = STAGES.map((s) => s.name);

  const RULES = [
    { flag: "Missing next action", why: "Without a next step, deals stall silently.", owner: "Sales rep", sla: "5 working days" },
    { flag: "Missing volume", why: "No units means no value, so the record is invisible in the forecast.", owner: "Sales rep", sla: "5 working days" },
    { flag: "Missing vertical", why: "Breaks reporting by market segment and product planning.", owner: "Sales rep", sla: "5 working days" },
    { flag: "Close date in past", why: "Inflates the current period forecast with deals that slipped.", owner: "Sales rep", sla: "Before forecast close" },
    { flag: "Stale (>30 days)", why: "An old update usually means the real status is unknown.", owner: "Sales rep", sla: "5 working days" },
    { flag: "Possible duplicate", why: "Double counts pipeline and confuses account ownership.", owner: "Sales Ops", sla: "10 working days" },
  ];

  const fmtM = (v) => (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const fmtUSD = (v) => "$" + Math.round(v).toLocaleString("en-US");
  const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
  const pct = (v, d = 0) => (v * 100).toFixed(d) + "%";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NS = "http://www.w3.org/2000/svg";

  /* ---------- tooltip ---------- */
  const tip = document.getElementById("tooltip");
  function showTip(e, html) {
    tip.innerHTML = html;
    tip.classList.add("show");
    const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
    const y = Math.max(8, e.clientY - tip.offsetHeight - 10);
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  function hideTip() { tip.classList.remove("show"); }

  /* ---------- tabs ---------- */
  const tabs = [...document.querySelectorAll(".tab")];
  const panels = [...document.querySelectorAll(".panel")];
  function openTab(id, scroll) {
    if (!panels.some((p) => p.id === id)) id = "overview";
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === id)));
    panels.forEach((p) => (p.hidden = p.id !== id));
    if (history.replaceState) history.replaceState(null, "", "#" + id);
    if (scroll) {
      const bar = document.querySelector(".tabs-bar");
      const top = bar.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top, behavior: "smooth" });
    }
    const active = tabs.find((t) => t.dataset.tab === id);
    if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
  }
  tabs.forEach((t) => t.addEventListener("click", () => openTab(t.dataset.tab, true)));
  document.querySelectorAll("[data-go]").forEach((el) =>
    el.addEventListener("click", (e) => { e.preventDefault(); openTab(el.dataset.go, true); }));
  window.addEventListener("hashchange", () => openTab(location.hash.slice(1), true));
  openTab(location.hash.slice(1) || "overview", false);

  /* ---------- stage model ---------- */
  const stagesEl = document.getElementById("stages");
  const detailEl = document.getElementById("stage-detail");
  function renderStage(i) {
    [...stagesEl.children].forEach((b, j) => b.setAttribute("aria-pressed", String(i === j)));
    const s = STAGES[i];
    const inStage = OPPS.filter((o) => o.stage === s.name);
    const val = inStage.reduce((a, o) => a + o.annual_value_usd, 0);
    detailEl.innerHTML = `
      <div class="card">
        <span class="tag red">Stage ${i + 1} · ${s.p}% probability</span>
        <h3>${s.name}</h3>
        <p>${s.entry}</p>
        <p class="small muted">Typical time in stage: ${s.days} days</p>
      </div>
      <div class="card">
        <h3>Exit criteria</h3>
        <p class="small muted">All must be true before moving on</p>
        <ul>${s.exit.map((x) => `<li>${x}</li>`).join("")}</ul>
      </div>
      <div class="card">
        <h3>Required fields</h3>
        <ul>${s.fields.map((x) => `<li>${x}</li>`).join("")}</ul>
        <h4>In the demo data</h4>
        <p class="small num">${inStage.length} opportunities · ${fmtM(val)}M USD annual value</p>
      </div>`;
  }
  STAGES.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "stage";
    b.innerHTML = `<span class="idx">${i + 1}</span><span class="n">${s.name}</span><span class="p">${s.p}%</span>`;
    b.addEventListener("click", () => renderStage(i));
    stagesEl.appendChild(b);
  });
  renderStage(3);

  /* ---------- svg helpers ---------- */
  function svg(w, h) {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", `0 0 ${w} ${h}`);
    s.setAttribute("role", "img");
    return s;
  }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs = {}) {
    const t = el("text", { x, y, ...attrs }, parent);
    t.textContent = str;
    return t;
  }
  // bar with rounded data-end (right side), square at baseline
  function hbarPath(x, y, w, h, r = 4) {
    if (w <= 0) return "";
    r = Math.min(r, w, h / 2);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  function vbarPath(x, y0, w, h, r = 4) {
    if (h <= 0) return "";
    r = Math.min(r, h, w / 2);
    const y = y0 - h;
    return `M${x},${y0}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y0}Z`;
  }

  /* horizontal bar chart: rows [{label, value, display, tip, dim}] */
  function hbars(container, rows, opts = {}) {
    container.innerHTML = "";
    const W = 560, labelW = opts.labelW || 150, valueW = 64, rowH = 34, barH = 18;
    const H = rows.length * rowH + 24;
    const s = svg(W, H);
    const plotW = W - labelW - valueW;
    const max = opts.max || Math.max(...rows.map((r) => r.value), 1e-9);
    const sx = (v) => (v / max) * plotW;
    // gridlines
    const ticks = opts.ticks || [];
    ticks.forEach((t) => {
      el("line", { x1: labelW + sx(t), x2: labelW + sx(t), y1: 0, y2: rows.length * rowH, class: "grid" }, s);
      text(s, labelW + sx(t), rows.length * rowH + 16, opts.tickFmt ? opts.tickFmt(t) : t, { class: "axis-label", "text-anchor": "middle" });
    });
    rows.forEach((r, i) => {
      const g = el("g", { class: "row" }, s);
      const y = i * rowH + (rowH - barH) / 2;
      text(g, labelW - 10, y + barH / 2 + 4, r.label, { "text-anchor": "end" });
      el("rect", { x: 0, y: i * rowH, width: W, height: rowH, class: "hit" }, g);
      el("path", { d: hbarPath(labelW, y, Math.max(sx(r.value), r.value > 0 ? 2 : 0), barH), class: "bar" + (r.dim ? " dim" : "") }, g);
      text(g, labelW + sx(r.value) + 8, y + barH / 2 + 4, r.display, { class: "num", style: "fill:var(--ink)" });
      g.addEventListener("mousemove", (e) => showTip(e, r.tip));
      g.addEventListener("mouseleave", hideTip);
    });
    if (opts.ref != null) {
      const x = labelW + sx(opts.ref);
      el("line", { x1: x, x2: x, y1: -4, y2: rows.length * rowH, class: "ref" }, s);
    }
    container.appendChild(s);
  }

  /* ---------- dashboard ---------- */
  let region = "All";
  const filtersEl = document.getElementById("region-filters");
  ["All", ...REGIONS].forEach((r) => {
    const c = document.createElement("button");
    c.className = "chip";
    c.textContent = r === "All" ? "All EMEA" : r;
    c.addEventListener("click", () => { region = r; renderDashboard(); });
    filtersEl.appendChild(c);
  });

  function renderDashboard() {
    [...filtersEl.querySelectorAll(".chip")].forEach((c, i) =>
      c.setAttribute("aria-pressed", String((i === 0 ? "All" : REGIONS[i - 1]) === region)));
    const rows = region === "All" ? OPPS : OPPS.filter((o) => o.region === region);
    const open = rows.filter(isOpen);
    const openVal = open.reduce((a, o) => a + o.annual_value_usd, 0);
    const weighted = open.reduce((a, o) => a + o.annual_value_usd * o.probability, 0);
    const target = (region === "All" ? REGIONS.reduce((a, r) => a + D.targets_musd[r], 0) : D.targets_musd[region]) * 1e6;
    const cov = openVal / target;
    const won = rows.filter((o) => o.stage === "Mass production").length;
    const lost = rows.filter((o) => o.stage === "Lost").length;
    const winRate = won / Math.max(won + lost, 1);
    const clean = rows.filter((o) => o.flags.length === 0).length / rows.length;
    const stale = open.filter((o) => o.days_since_update > 30).length / Math.max(open.length, 1);

    const kpis = [
      { l: "Open pipeline, annual value", v: "$" + fmtM(openVal) + "M", d: `${open.length} open opportunities`, c: "neutral" },
      { l: "Weighted pipeline", v: "$" + fmtM(weighted) + "M", d: "value × stage probability", c: "neutral" },
      { l: "Pipeline coverage", v: cov.toFixed(1) + "×", d: cov >= 3 ? "▲ above 3× target" : "▼ below 3× target", c: cov >= 3 ? "good" : "bad" },
      { l: "Win rate", v: pct(winRate), d: `${won} won · ${lost} lost`, c: "neutral" },
      { l: "Data completeness", v: pct(clean), d: clean >= 0.95 ? "▲ at 95% target" : "▼ target 95%", c: clean >= 0.95 ? "good" : "bad" },
      { l: "Stale open opportunities", v: pct(stale), d: stale < 0.05 ? "▲ under 5% target" : "▼ target under 5%", c: stale < 0.05 ? "good" : "bad" },
    ];
    document.getElementById("kpis").innerHTML = kpis.map((k) =>
      `<div class="kpi"><span class="label">${k.l}</span><div class="value num">${k.v}</div><div class="delta ${k.c}">${k.d}</div></div>`).join("");

    // pipeline by stage
    const stageRows = STAGE_NAMES.filter((s) => !CLOSED.includes(s)).map((s) => {
      const list = open.filter((o) => o.stage === s);
      const v = list.reduce((a, o) => a + o.annual_value_usd, 0);
      return { label: s, value: v, display: fmtM(v), tip: `<b>${s}</b><br>${list.length} opportunities<br>${fmtUSD(v)} annual value` };
    });
    hbars(document.getElementById("chart-stage"), stageRows);

    // coverage by region
    const covRows = REGIONS.map((r) => {
      const v = OPPS.filter((o) => o.region === r && isOpen(o)).reduce((a, o) => a + o.annual_value_usd, 0);
      const c = v / (D.targets_musd[r] * 1e6);
      return { label: r, value: c, display: c.toFixed(1) + "×", dim: region !== "All" && region !== r,
        tip: `<b>${r}</b><br>Pipeline ${fmtM(v)}M USD<br>Target ${D.targets_musd[r].toFixed(1)}M USD<br>Coverage ${c.toFixed(2)}×` };
    });
    hbars(document.getElementById("chart-coverage"), covRows, {
      ref: 3, max: Math.max(5, ...covRows.map((r) => r.value)) * 1.05, ticks: [0, 1, 2, 3, 4, 5], tickFmt: (t) => t + "×",
    });

    // conversion: share of non-lost records that reached each stage
    const live = rows.filter((o) => o.stage !== "Lost");
    const conv = STAGE_NAMES.map((s, i) => {
      const reached = live.filter((o) => STAGE_NAMES.indexOf(o.stage) >= i).length;
      const share = reached / Math.max(live.length, 1);
      return { label: s, value: share, display: pct(share), tip: `<b>${s}</b><br>${reached} of ${live.length} reached this stage` };
    });
    hbars(document.getElementById("chart-conversion"), conv, { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], tickFmt: (t) => pct(t) });
  }

  /* forecast vs actual: outlined forecast bar with solid actual bar inside */
  function renderForecast() {
    const box = document.getElementById("chart-forecast");
    const Q = D.forecast;
    const W = 560, H = 290, L = 40, B = 250, T = 20;
    const s = svg(W, H);
    const max = 12;
    const sy = (v) => ((B - T) * v) / max;
    [0, 3, 6, 9, 12].forEach((t) => {
      el("line", { x1: L, x2: W, y1: B - sy(t), y2: B - sy(t), class: "grid" }, s);
      text(s, L - 8, B - sy(t) + 4, t, { class: "axis-label", "text-anchor": "end" });
    });
    const step = (W - L) / Q.length, fw = step * 0.56, aw = fw * 0.5;
    Q.forEach((q, i) => {
      const g = el("g", { class: "row" }, s);
      const cx = L + step * i + step / 2;
      el("rect", { x: cx - step / 2, y: T, width: step, height: B - T, class: "hit" }, g);
      el("path", { d: vbarPath(cx - fw / 2, B, fw, sy(q.forecast_musd)), class: "fc" }, g);
      if (q.actual_musd != null) el("path", { d: vbarPath(cx - aw / 2, B, aw, sy(q.actual_musd)), class: "bar" }, g);
      text(g, cx, B + 18, q.quarter, { "text-anchor": "middle" });
      const acc = q.actual_musd != null ? 1 - Math.abs(q.actual_musd - q.forecast_musd) / q.forecast_musd : null;
      text(g, cx, B - sy(q.forecast_musd) - 8, acc != null ? pct(acc) : "open", { "text-anchor": "middle", class: "axis-label" });
      g.addEventListener("mousemove", (e) => showTip(e, `<b>${q.quarter}</b><br>Forecast ${q.forecast_musd.toFixed(1)}M<br>` +
        (q.actual_musd != null ? `Actual ${q.actual_musd.toFixed(1)}M<br>Accuracy ${pct(acc, 1)}` : "Quarter in progress")));
      g.addEventListener("mouseleave", hideTip);
    });
    box.appendChild(s);
    const p = document.createElement("p");
    p.className = "small muted";
    p.style.margin = "8px 0 0";
    p.textContent = "Label above each bar: forecast accuracy. Target 90% or higher. All EMEA, not affected by the region filter.";
    box.appendChild(p);
  }

  /* ---------- data quality ---------- */
  function renderQuality() {
    const counts = {};
    OPPS.forEach((o) => o.flags.forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
    document.getElementById("rules-body").innerHTML = RULES.map((r) =>
      `<tr><td><b>${r.flag}</b></td><td>${r.why}</td><td>${r.owner}</td><td>${r.sla}</td><td class="r num">${counts[r.flag] || 0}</td></tr>`).join("");

    document.getElementById("dq-body").innerHTML = REGIONS.map((r) => {
      const rows = OPPS.filter((o) => o.region === r);
      const bad = rows.filter((o) => o.flags.length).length;
      const score = 1 - bad / rows.length;
      const c = (f) => rows.filter((o) => o.flags.includes(f)).length;
      const status = score >= 0.95 ? '<span class="tag good">✓ On target</span>'
        : score >= 0.8 ? '<span class="tag warn">! Needs work</span>' : '<span class="tag bad">✕ Priority</span>';
      return `<tr><td>${r}</td><td class="r num">${rows.length}</td><td class="r num">${bad}</td>
        <td><div style="display:flex;align-items:center;gap:10px"><div class="meter" style="flex:1"><i class="${score < 0.95 ? "low" : ""}" style="width:${score * 100}%"></i></div><span class="num">${pct(score)}</span></div></td>
        <td class="r num">${c("Stale (>30 days)")}</td><td class="r num">${c("Close date in past")}</td><td class="r num">${c("Possible duplicate")}</td><td>${status}</td></tr>`;
    }).join("");

    let dqRegion = "All";
    const f = document.getElementById("dq-filters");
    const sel = document.createElement("select");
    sel.className = "chip";
    sel.setAttribute("aria-label", "Filter issues by region");
    sel.innerHTML = ["All", ...REGIONS].map((r) => `<option value="${esc(r)}">${r === "All" ? "All regions" : esc(r)}</option>`).join("");
    sel.addEventListener("change", () => { dqRegion = sel.value; draw(); });
    f.appendChild(sel);
    function draw() {
      const list = OPPS.filter((o) => o.flags.length && (dqRegion === "All" || o.region === dqRegion))
        .sort((a, b) => b.annual_value_usd - a.annual_value_usd).slice(0, 15);
      document.getElementById("issues-body").innerHTML = list.map((o) =>
        `<tr><td class="num">${o.opportunity_id}</td><td>${esc(o.account)}</td><td>${esc(o.owner)}</td><td>${o.stage}</td>
         <td class="r num">${o.annual_value_usd ? fmtUSD(o.annual_value_usd) : "<span class='muted'>unknown</span>"}</td>
         <td class="r num">${o.days_since_update}</td><td>${o.flags.map((x) => `<span class="flag">${x}</span>`).join("")}</td></tr>`).join("");
    }
    draw();
  }

  /* ---------- tradeshows ---------- */
  function renderShows() {
    document.getElementById("shows-body").innerHTML = D.tradeshows.map((t) => {
      const done = t.leads != null;
      const dash = '<span class="muted">upcoming</span>';
      return `<tr><td><b>${t.event}</b><br><span class="small muted">${t.city}</span></td><td>${t.month}</td>
        <td class="r num">€${fmtInt(t.cost_eur)}</td>
        <td class="r num">${done ? fmtInt(t.leads) : dash}</td><td class="r num">${done ? fmtInt(t.qualified) : ""}</td>
        <td class="r num">${done ? t.opportunities : ""}</td><td class="r num">${done ? fmtUSD(t.pipeline_usd) : ""}</td>
        <td class="r num">${done ? pct(t.qualified / t.leads) : ""}</td>
        <td class="r num">${done ? "€" + fmtInt(t.cost_eur / t.qualified) : ""}</td>
        <td class="r num">${done ? (t.pipeline_usd / t.cost_eur).toFixed(0) : ""}</td></tr>`;
    }).join("");
    const rows = D.tradeshows.filter((t) => t.leads != null).map((t) => {
      const v = t.pipeline_usd / t.cost_eur;
      return { label: t.event, value: v, display: "$" + v.toFixed(0),
        tip: `<b>${t.event}</b><br>Pipeline ${fmtUSD(t.pipeline_usd)}<br>Cost €${fmtInt(t.cost_eur)}<br>${t.opportunities} opportunities` };
    }).sort((a, b) => b.value - a.value);
    hbars(document.getElementById("chart-shows"), rows, { labelW: 160 });
  }

  document.getElementById("hs-opps").textContent = OPPS.length;
  renderDashboard();
  renderForecast();
  renderQuality();
  renderShows();
})();
