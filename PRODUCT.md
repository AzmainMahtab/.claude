Product discovery and delivery planning — how a new client engagement becomes a buildable, priced repo. Imported by `CLAUDE.md`.

Applies to every new product, whatever the stack: a website, a web app, a mobile app, or a platform.

| Concern | Answer |
|---------|--------|
| Records directory | `.project-doc/` — plain Markdown, model-agnostic, readable by any harness |
| PRD | `.project-doc/docs/PRD.md` + `deliverables/PRD.pdf` |
| Estimate | Traditional baseline × per-task AI-native multiplier + itemised buffer |
| Blended rate | **$70/hr USD** — international mid-market, fixed price per phase |
| Payment | 30% signature / 40% midpoint / 30% acceptance |
| PDF export | `md2pdf.py` — Markdown → styled HTML → Chromium headless. No pandoc, no network |
| Delivery assumption | One senior AI-native engineer at 30 productive h/week, PM overhead on top |

The pipeline is seven phases with gates: **Intake → Clarify → Decompose → Specify → Estimate → Price → Hand off.** Never price an unapproved scope; never build one.

Non-negotiables:
- Every requirement traces to a source in `context/raw/`, or it is a labelled assumption in PRD §13.
- The out-of-scope list is never empty. If it is, the scope has not been understood yet.
- No unquantified adjectives in a PRD. "Fast" is a future argument; "under 1.5 s on 4G with 500 rows" is a requirement.
- Every quotation figure traces to a row in `plan/ESTIMATE.md`. Regenerate on change; never hand-patch a number.
- The AI-native multiplier and the traditional baseline never appear in a client document.
- Client-facing documents ship as `.md` (canonical, in the repo) **and** `.pdf` (in `deliverables/` and `~/Documents/<project>/`).

Use `/product-new` for a whole engagement, `/product-intake` when new client material arrives, `/product-prd`, `/product-quote`, `/product-wireframes` for a single artefact. The `product-discovery` skill holds the templates, the estimation model and the rate card; `product-manager` runs the pipeline.
