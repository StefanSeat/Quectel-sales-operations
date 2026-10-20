(function () {
  const D = window.SALES_DATA;
  const OPPS = D.opportunities;
  const isOpen = (o) => o.stage !== "Mass production" && o.stage !== "Lost";
  const pct = (v) => Math.round(v * 100) + "%";
  const fmtInt = (v) => Math.round(v).toLocaleString("en-US");

  const STAGES = [
    ["Lead", 5, "Interest, use case known"],
    ["Qualified", 10, "Real device project and volume"],
    ["Sample / Evaluation", 20, "Customer tests our module"],
    ["Design-in", 40, "Module in the customer design"],
    ["Design-win", 70, "Customer confirms selection"],
    ["Pilot", 85, "First production orders"],
    ["Mass production", 100, "Recurring orders"],
  ];
  document.getElementById("steps").innerHTML = STAGES.map(([n, p, d], i) =>
    `<div class="stp"><span class="p">${p}%</span><strong>${i + 1}. ${n}</strong><span>${d}</span></div>`).join("");

  const RULES = [
    ["Missing next action", "Without a next step, deals stall quietly", "5 working days"],
    ["Missing volume", "No units means no value in the forecast", "5 working days"],
    ["Close date in past", "Makes the current forecast look bigger than it is", "Before forecast close"],
    ["Stale (>30 days)", "Real status of the deal is unknown", "5 working days"],
    ["Possible duplicate", "Pipeline is counted twice", "10 working days"],
  ];
  const counts = {};
  OPPS.forEach((o) => o.flags.forEach((f) => (counts[f] = (counts[f] || 0) + 1)));
  document.getElementById("rules-body").innerHTML = RULES.map(([f, why, sla]) =>
    `<tr><td><b>${f}</b></td><td>${why}</td><td>${sla}</td><td class="r num">${counts[f] || 0}</td></tr>`).join("");

  const open = OPPS.filter(isOpen);
  const clean = OPPS.filter((o) => o.flags.length === 0).length / OPPS.length;
  const stale = open.filter((o) => o.days_since_update > 30).length / open.length;
  const kpis = [
    ["Records checked", fmtInt(OPPS.length), "neutral", "full EMEA export"],
    ["Records without issues", pct(clean), clean >= 0.95 ? "good" : "bad", "target 95%"],
    ["Stale open deals", pct(stale), stale < 0.05 ? "good" : "bad", "target under 5%"],
    ["Records to fix", fmtInt(OPPS.filter((o) => o.flags.length).length), "neutral", "sent to owners"],
  ];
  document.getElementById("dq-kpis").innerHTML = kpis.map(([l, v, c, d]) =>
    `<div class="kpi"><span class="label">${l}</span><div class="value num">${v}</div><div class="delta ${c}">${d}</div></div>`).join("");

  document.getElementById("shows-body").innerHTML = D.tradeshows.filter((t) => t.leads != null).map((t) =>
    `<tr><td><b>${t.event}</b> <span class="muted small">${t.month}</span></td>
     <td class="r num">${fmtInt(t.leads)}</td><td class="r num">${fmtInt(t.qualified)}</td><td class="r num">${t.opportunities}</td>
     <td class="r num">€${fmtInt(t.cost_eur / t.qualified)}</td><td class="r num">$${(t.pipeline_usd / t.cost_eur).toFixed(0)}</td></tr>`).join("");

  document.getElementById("n-opps").textContent = OPPS.length;
})();
