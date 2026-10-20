"""Generate the synthetic EMEA sales dataset used by the site and the Excel workbook.

All company names and figures are fictional. Run from the repo root:
    python3 tools/generate_data.py
"""
import csv
import json
import random
from datetime import date, timedelta

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

random.seed(42)
TODAY = date(2026, 10, 20)

REGIONS = {
    "DACH": ["Germany", "Austria", "Switzerland"],
    "UK & Ireland": ["United Kingdom", "Ireland"],
    "France & Benelux": ["France", "Netherlands", "Belgium"],
    "Southern Europe": ["Italy", "Spain", "Portugal"],
    "Nordics": ["Sweden", "Finland", "Denmark", "Norway"],
    "CEE": ["Poland", "Czechia", "Serbia", "Hungary", "Romania"],
    "Middle East & Africa": ["Israel", "UAE", "Turkey", "South Africa"],
}
OWNERS = {
    "DACH": ["J. Weber", "L. Hoffmann"],
    "UK & Ireland": ["S. Clarke", "R. Patel"],
    "France & Benelux": ["C. Martin", "B. de Vries"],
    "Southern Europe": ["M. Rossi", "A. Garcia"],
    "Nordics": ["E. Lindqvist"],
    "CEE": ["K. Nowak", "D. Jovanovic"],
    "Middle East & Africa": ["Y. Cohen", "O. Demir"],
}
VERTICALS = ["Smart metering", "Automotive & C-V2X", "Asset tracking", "Industrial IoT",
             "POS & payments", "Healthcare", "Smart home & security", "Telematics"]
PRODUCTS = {
    "5G RedCap": (38, 62),
    "5G eMBB": (85, 140),
    "LTE Cat 1 bis": (7.5, 11),
    "LTE-M / NB-IoT": (5.5, 8.5),
    "GNSS": (3.5, 9),
    "Smart module": (45, 95),
    "Wi-Fi / Bluetooth": (2.5, 6),
}
# stage, probability, typical days spent in stage
STAGES = [
    ("Lead", 0.05), ("Qualified", 0.10), ("Sample / Evaluation", 0.20),
    ("Design-in", 0.40), ("Design-win", 0.70), ("Pilot", 0.85),
    ("Mass production", 1.00), ("Lost", 0.0),
]
STAGE_WEIGHTS = [10, 14, 18, 16, 11, 7, 12, 12]
PREFIX = ["Nordwind", "Alpenlink", "Bluecell", "Meridian", "Stellar", "Ferro", "Helix", "Arcturus",
          "Kestrel", "Lumen", "Vector", "Orbis", "Tessera", "Corvid", "Pannon", "Danubia", "Iberix",
          "Solent", "Baltix", "Atlas", "Quorra", "Zenit", "Morava", "Cedar", "Rhenus", "Sava"]
SUFFIX = ["Metering", "Telematics", "Systems", "Devices", "Mobility", "Electronics", "Labs",
          "Industrial", "Health", "Connect", "Tracking", "Energy"]
LOSS_REASONS = ["Price", "Competitor module", "Project cancelled", "Certification timeline", "Technical fit"]


def make_accounts(n=95):
    names, accounts = set(), []
    while len(accounts) < n:
        name = f"{random.choice(PREFIX)} {random.choice(SUFFIX)}"
        if name in names:
            continue
        names.add(name)
        region = random.choices(list(REGIONS), weights=[26, 15, 15, 13, 9, 12, 10])[0]
        accounts.append({"name": name, "region": region, "country": random.choice(REGIONS[region])})
    return accounts


def make_opportunities(accounts, n=240):
    rows = []
    for i in range(n):
        acc = random.choice(accounts)
        stage, prob = random.choices(STAGES, weights=STAGE_WEIGHTS)[0]
        product = random.choice(list(PRODUCTS))
        lo, hi = PRODUCTS[product]
        asp = round(random.uniform(lo, hi), 2)
        units = random.choice([2, 3, 5, 8, 10, 15, 20, 30, 50, 80]) * 1000
        life = random.choice([2, 3, 3, 4, 5])
        value = round(units * asp * life)
        created = TODAY - timedelta(days=random.randint(20, 640))
        stage_idx = [s for s, _ in STAGES].index(stage)
        if stage in ("Mass production", "Lost"):
            close = created + timedelta(days=random.randint(120, 420))
            close = min(close, TODAY - timedelta(days=random.randint(1, 30)))
        else:
            close = TODAY + timedelta(days=random.randint(-40, 420 - stage_idx * 40))
        last_update = random.choices(
            [random.randint(0, 14), random.randint(15, 30), random.randint(31, 120)],
            weights=[60, 22, 18])[0]
        row = {
            "opportunity_id": f"OPP-{26000 + i}",
            "account": acc["name"],
            "region": acc["region"],
            "country": acc["country"],
            "owner": random.choice(OWNERS[acc["region"]]),
            "vertical": random.choice(VERTICALS),
            "product_family": product,
            "stage": stage,
            "probability": prob,
            "annual_units": units,
            "asp_usd": asp,
            "project_life_years": life,
            "annual_value_usd": round(units * asp),
            "lifetime_value_usd": value,
            "weighted_value_usd": round(value * prob),
            "created_date": created.isoformat(),
            "expected_close": close.isoformat(),
            "days_since_update": last_update,
            "next_action": random.choice([
                "Send samples", "Technical review call", "Quote revision", "Certification plan",
                "Pilot build follow-up", "Forecast confirmation", "Design review", "Price negotiation"]),
            "source": random.choices(
                ["Direct", "Distributor", "Tradeshow", "Website", "FAE referral"],
                weights=[35, 25, 18, 10, 12])[0],
            "loss_reason": random.choice(LOSS_REASONS) if stage == "Lost" else "",
        }
        # inject realistic data quality problems
        r = random.random()
        if r < 0.07:
            row["next_action"] = ""
        elif r < 0.12:
            row["annual_units"] = ""
            row["annual_value_usd"] = 0
            row["lifetime_value_usd"] = 0
            row["weighted_value_usd"] = 0
        elif r < 0.16 and stage not in ("Mass production", "Lost"):
            row["expected_close"] = (TODAY - timedelta(days=random.randint(10, 90))).isoformat()
        elif r < 0.19:
            row["vertical"] = ""
        rows.append(row)
    # a few duplicates with slightly different account spelling
    for src in random.sample(rows, 6):
        dup = dict(src)
        dup["opportunity_id"] = f"OPP-{26000 + len(rows)}"
        dup["account"] = src["account"].upper() if random.random() < 0.5 else src["account"] + " GmbH"
        dup["days_since_update"] = random.randint(40, 150)
        rows.append(dup)
    return rows


def quality_flags(row):
    flags = []
    if not row["next_action"]:
        flags.append("Missing next action")
    if not row["annual_units"]:
        flags.append("Missing volume")
    if not row["vertical"]:
        flags.append("Missing vertical")
    open_stage = row["stage"] not in ("Mass production", "Lost")
    if open_stage and row["expected_close"] < TODAY.isoformat():
        flags.append("Close date in past")
    if open_stage and row["days_since_update"] > 30:
        flags.append("Stale (>30 days)")
    return flags


def mark_duplicates(rows):
    seen = {}
    for row in rows:
        key = (row["account"].upper().replace(" GMBH", ""), row["product_family"], row["vertical"])
        if key in seen:
            row["_dup"] = True
        else:
            seen[key] = row["opportunity_id"]
            row["_dup"] = False


def quarters():
    out = []
    for q, (fc, act) in enumerate([(8.2, 7.4), (8.9, 9.2), (9.4, 8.3), (9.9, 9.6), (10.6, 10.3), (11.2, None)]):
        label = ["Q3 25", "Q4 25", "Q1 26", "Q2 26", "Q3 26", "Q4 26"][q]
        out.append({"quarter": label, "forecast_musd": fc, "actual_musd": act})
    return out


TRADESHOWS = [
    {"event": "Embedded World", "city": "Nuremberg", "month": "Mar 2026", "cost_eur": 92000,
     "meetings": 148, "leads": 412, "qualified": 131, "opportunities": 38, "pipeline_usd": 9_400_000},
    {"event": "MWC", "city": "Barcelona", "month": "Mar 2026", "cost_eur": 118000,
     "meetings": 96, "leads": 265, "qualified": 70, "opportunities": 17, "pipeline_usd": 6_100_000},
    {"event": "Hannover Messe", "city": "Hannover", "month": "Apr 2026", "cost_eur": 54000,
     "meetings": 61, "leads": 188, "qualified": 49, "opportunities": 14, "pipeline_usd": 3_300_000},
    {"event": "IoT Tech Expo Europe", "city": "Amsterdam", "month": "Sep 2026", "cost_eur": 31000,
     "meetings": 44, "leads": 156, "qualified": 38, "opportunities": 9, "pipeline_usd": 1_700_000},
    {"event": "electronica", "city": "Munich", "month": "Nov 2026", "cost_eur": 86000,
     "meetings": None, "leads": None, "qualified": None, "opportunities": None, "pipeline_usd": None},
]

# Annual revenue targets, set so that pipeline coverage differs per region (some below the 3x rule)
COVERAGE = {"DACH": 3.6, "UK & Ireland": 2.4, "France & Benelux": 3.1, "Southern Europe": 1.9,
            "Nordics": 2.8, "CEE": 3.3, "Middle East & Africa": 2.2}
TARGETS_MUSD = {}


def set_targets(rows):
    for reg, cov in COVERAGE.items():
        open_annual = sum(r["annual_value_usd"] for r in rows
                          if r["region"] == reg and r["stage"] not in ("Mass production", "Lost"))
        TARGETS_MUSD[reg] = round(open_annual / cov / 1e6 * 2) / 2


def write_csv(rows):
    fields = [k for k in rows[0] if not k.startswith("_")]
    with open("data/opportunities.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def write_js(rows):
    payload = {
        "generated": TODAY.isoformat(),
        "opportunities": [
            {**{k: v for k, v in r.items() if not k.startswith("_")},
             "flags": quality_flags(r) + (["Possible duplicate"] if r["_dup"] else [])}
            for r in rows
        ],
        "forecast": quarters(),
        "tradeshows": TRADESHOWS,
        "targets_musd": TARGETS_MUSD,
    }
    with open("data/data.js", "w", encoding="utf-8") as f:
        f.write("// Synthetic demo data. Generated by tools/generate_data.py\n")
        f.write("window.SALES_DATA = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")


RED = "E2231A"
HEAD_FILL = PatternFill("solid", fgColor="111111")
HEAD_FONT = Font(bold=True, color="FFFFFF")


def style_header(ws, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill = HEAD_FILL
        cell.font = HEAD_FONT
        cell.alignment = Alignment(vertical="center")
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 22


def write_xlsx(rows):
    wb = Workbook()

    # Read me
    ws = wb.active
    ws.title = "Read me"
    lines = [
        ("EMEA Sales Operations Toolkit (demo workbook)", True),
        ("All accounts, people and figures are fictional and generated for demonstration.", False),
        ("", False),
        ("Opportunities: raw CRM export with formula-driven data quality checks (columns V to AB).", False),
        ("Pipeline summary: stage x region pivot built with SUMIFS so it updates with the data.", False),
        ("Data quality: completeness score per region, target 95%.", False),
        ("Forecast: forecast vs actual by quarter with accuracy %.", False),
        ("Tradeshows: post-event funnel and cost per qualified lead.", False),
    ]
    for i, (text, bold) in enumerate(lines, 1):
        ws.cell(row=i, column=1, value=text).font = Font(bold=bold, size=14 if bold else 11,
                                                         color=RED if bold else "111111")
    ws.column_dimensions["A"].width = 100

    # Opportunities with check columns
    ws = wb.create_sheet("Opportunities")
    fields = [k for k in rows[0] if not k.startswith("_")]
    checks = ["chk_next_action", "chk_volume", "chk_vertical", "chk_close_past", "chk_stale",
              "chk_duplicate", "issues"]
    ws.append(fields + checks)
    col = {f: get_column_letter(i + 1) for i, f in enumerate(fields)}
    n = len(rows) + 1
    for r_i, row in enumerate(rows, start=2):
        ws.append([row[f] for f in fields])
        open_expr = f'AND({col["stage"]}{r_i}<>"Mass production",{col["stage"]}{r_i}<>"Lost")'
        base = len(fields)
        formulas = [
            f'=IF({col["next_action"]}{r_i}="",1,0)',
            f'=IF({col["annual_units"]}{r_i}="",1,0)',
            f'=IF({col["vertical"]}{r_i}="",1,0)',
            f'=IF(AND({open_expr},DATEVALUE({col["expected_close"]}{r_i})<DATE(2026,10,20)),1,0)',
            f'=IF(AND({open_expr},{col["days_since_update"]}{r_i}>30),1,0)',
            f'=IF(COUNTIFS(${col["product_family"]}$2:${col["product_family"]}${n},'
            f'{col["product_family"]}{r_i},${col["vertical"]}$2:${col["vertical"]}${n},{col["vertical"]}{r_i},'
            f'${col["annual_units"]}$2:${col["annual_units"]}${n},{col["annual_units"]}{r_i},'
            f'${col["asp_usd"]}$2:${col["asp_usd"]}${n},{col["asp_usd"]}{r_i})>1,1,0)',
        ]
        for j, fml in enumerate(formulas):
            ws.cell(row=r_i, column=base + 1 + j, value=fml)
        first, last = get_column_letter(base + 1), get_column_letter(base + len(formulas))
        ws.cell(row=r_i, column=base + len(formulas) + 1, value=f"=SUM({first}{r_i}:{last}{r_i})")
    style_header(ws, len(fields) + len(checks))
    for i in range(1, len(fields) + len(checks) + 1):
        ws.column_dimensions[get_column_letter(i)].width = 16
    ws.column_dimensions[col["account"]].width = 26
    issues_col = get_column_letter(len(fields) + len(checks))
    ws.conditional_formatting.add(
        f"{issues_col}2:{issues_col}{n}",
        CellIsRule(operator="greaterThan", formula=["0"], fill=PatternFill("solid", fgColor="FBD5D3")))
    ws.auto_filter.ref = f"A1:{issues_col}{n}"
    opp = "Opportunities"

    # Pipeline summary
    ws = wb.create_sheet("Pipeline summary")
    stages = [s for s, _ in STAGES]
    regions = list(REGIONS)
    ws.append(["Lifetime value (USD) by stage and region"] )
    ws["A1"].font = Font(bold=True, size=13, color=RED)
    ws.append(["Stage"] + regions + ["Total"])
    for c in range(1, len(regions) + 3):
        ws.cell(row=2, column=c).fill = HEAD_FILL
        ws.cell(row=2, column=c).font = HEAD_FONT
    rng = lambda f: f"{opp}!${col[f]}$2:${col[f]}${n}"
    for s_i, s in enumerate(stages, start=3):
        ws.cell(row=s_i, column=1, value=s)
        for r_i, reg in enumerate(regions, start=2):
            ws.cell(row=s_i, column=r_i,
                    value=f'=SUMIFS({rng("lifetime_value_usd")},{rng("stage")},$A{s_i},{rng("region")},'
                          f'{get_column_letter(r_i)}$2)').number_format = '#,##0'
        tc = len(regions) + 2
        ws.cell(row=s_i, column=tc,
                value=f"=SUM(B{s_i}:{get_column_letter(tc - 1)}{s_i})").number_format = '#,##0'
    last = 2 + len(stages)
    ws.column_dimensions["A"].width = 22
    for i in range(2, len(regions) + 3):
        ws.column_dimensions[get_column_letter(i)].width = 17
    chart = BarChart()
    chart.type = "bar"
    chart.title = "Lifetime value by stage"
    chart.style = 10
    data = Reference(ws, min_col=len(regions) + 2, min_row=2, max_row=last - 1)
    cats = Reference(ws, min_col=1, min_row=3, max_row=last - 1)
    chart.add_data(data, titles_from_data=True)
    chart.set_categories(cats)
    chart.legend = None
    chart.height, chart.width = 8, 16
    chart.series[0].graphicalProperties.solidFill = RED
    ws.add_chart(chart, f"A{last + 3}")

    # Data quality by region
    ws = wb.create_sheet("Data quality")
    ws.append(["Region", "Records", "Records with issues", "Completeness %", "Stale open", "Close date in past",
               "Possible duplicates"])
    style_header(ws, 7)
    issues_rng = f"{opp}!${issues_col}$2:${issues_col}${n}"
    stale_rng = f"{opp}!${get_column_letter(len(fields) + 5)}$2:${get_column_letter(len(fields) + 5)}${n}"
    past_rng = f"{opp}!${get_column_letter(len(fields) + 4)}$2:${get_column_letter(len(fields) + 4)}${n}"
    dup_rng = f"{opp}!${get_column_letter(len(fields) + 6)}$2:${get_column_letter(len(fields) + 6)}${n}"
    for i, reg in enumerate(regions, start=2):
        ws.append([reg,
                   f'=COUNTIF({rng("region")},A{i})',
                   f'=COUNTIFS({rng("region")},A{i},{issues_rng},">0")',
                   f"=IF(B{i}=0,0,1-C{i}/B{i})",
                   f'=SUMIFS({stale_rng},{rng("region")},A{i})',
                   f'=SUMIFS({past_rng},{rng("region")},A{i})',
                   f'=SUMIFS({dup_rng},{rng("region")},A{i})'])
        ws.cell(row=i, column=4).number_format = "0.0%"
    end = len(regions) + 1
    ws.conditional_formatting.add(f"D2:D{end}", CellIsRule(operator="lessThan", formula=["0.95"],
                                  fill=PatternFill("solid", fgColor="FBD5D3")))
    ws.conditional_formatting.add(f"D2:D{end}", CellIsRule(operator="greaterThanOrEqual", formula=["0.95"],
                                  fill=PatternFill("solid", fgColor="D7F0DD")))
    for i, w in enumerate([22, 10, 18, 15, 12, 18, 18], start=1):
        ws.column_dimensions[get_column_letter(i)].width = w

    # Forecast
    ws = wb.create_sheet("Forecast")
    ws.append(["Quarter", "Forecast (M USD)", "Actual (M USD)", "Variance", "Accuracy %"])
    style_header(ws, 5)
    for i, q in enumerate(quarters(), start=2):
        ws.append([q["quarter"], q["forecast_musd"], q["actual_musd"],
                   f'=IF(C{i}="","",C{i}-B{i})', f'=IF(C{i}="","",1-ABS(C{i}-B{i})/B{i})'])
        ws.cell(row=i, column=5).number_format = "0.0%"
    ws.conditional_formatting.add("E2:E7", FormulaRule(formula=['AND(E2<>"",E2<0.9)'],
                                  fill=PatternFill("solid", fgColor="FBD5D3")))
    for c in "ABCDE":
        ws.column_dimensions[c].width = 18

    # Tradeshows
    ws = wb.create_sheet("Tradeshows")
    ws.append(["Event", "City", "Month", "Cost (EUR)", "Meetings", "Leads", "Qualified", "Opportunities",
               "Pipeline (USD)", "Lead to qualified %", "Cost per qualified lead", "Pipeline per EUR"])
    style_header(ws, 12)
    for i, t in enumerate(TRADESHOWS, start=2):
        ws.append([t["event"], t["city"], t["month"], t["cost_eur"], t["meetings"], t["leads"],
                   t["qualified"], t["opportunities"], t["pipeline_usd"],
                   f'=IF(F{i}="","",G{i}/F{i})', f'=IF(G{i}="","",D{i}/G{i})', f'=IF(I{i}="","",I{i}/D{i})'])
        ws.cell(row=i, column=10).number_format = "0.0%"
        ws.cell(row=i, column=11).number_format = '#,##0'
        ws.cell(row=i, column=12).number_format = '0.0'
        ws.cell(row=i, column=4).number_format = '#,##0'
        ws.cell(row=i, column=9).number_format = '#,##0'
    for i in range(1, 13):
        ws.column_dimensions[get_column_letter(i)].width = 17

    wb.save("data/EMEA_Sales_Ops_Toolkit.xlsx")


if __name__ == "__main__":
    accounts = make_accounts()
    rows = make_opportunities(accounts)
    mark_duplicates(rows)
    set_targets(rows)
    write_csv(rows)
    write_js(rows)
    write_xlsx(rows)
    print(f"{len(rows)} opportunities written")
