# EMEA Sales Operations Playbook

How I would organize, track and support an EMEA sales organization in the IoT cellular module business. Built as a portfolio project for a **Sales Operations Executive, EMEA** application.

> Personal project. Not affiliated with or endorsed by Quectel Wireless Solutions. All companies, people and figures in the demo data are fictional.

## What is inside

| Section | What it shows |
|---|---|
| Overview | 90 day plan and working principles |
| Organization | Regional structure, Sales Ops as a hub, RACI, operating rhythm |
| Pipeline & CRM | Design-in based stage model with exit criteria, CRM object model, value logic, lead routing |
| Data quality | Six weekly checks, completeness scorecard by region, correction loop, issue list |
| Forecast & KPIs | Live dashboard with region filter, forecast categories, KPI definitions |
| Tradeshows | Post-event funnel, cost per qualified lead, pipeline per EUR, event checklist |
| Enablement | Handbook structure, follow-up template, improvement log, downloads |

## Files

- `index.html`, `assets/`: the site (plain HTML, CSS and JavaScript, no build step)
- `data/opportunities.csv`: demo CRM export, 246 fictional opportunities
- `data/EMEA_Sales_Ops_Toolkit.xlsx`: Excel workbook with formula-based data quality checks, SUMIFS pipeline pivot, forecast accuracy and tradeshow ROI
- `docs/SOP-opportunity-management.md`: sample standard operating procedure
- `tools/generate_data.py`: regenerates the demo data and the workbook (`python3 tools/generate_data.py`, needs `openpyxl`)

## View it

Open `index.html` in a browser, or publish with GitHub Pages: **Settings → Pages → Deploy from a branch → `main` / root**.
