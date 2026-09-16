# AI-Native Estimation Model

How to turn a work breakdown into hours, a calendar, and a number you can defend in front of a client.

The model has four steps. Do them in order and show your work — an estimate whose arithmetic is hidden is an estimate nobody can negotiate, and a client who cannot negotiate walks.

```
traditional hours  ×  AI-native multiplier  +  risk buffer  →  billable hours  →  calendar
```

---

## Step 1 — Traditional baseline

Estimate every WBS leaf task as if a competent senior engineer were writing it by hand, no AI. Use hours, not story points: the client buys hours, and points do not convert to money without a made-up ratio.

Anchor against these, which are per-task, not per-feature:

| Task shape | Baseline hours |
|---|---:|
| Static page from an approved design | 4–7 |
| CRUD entity: model, migration, repo, 5 endpoints, tests | 10–14 |
| Auth: register, login, refresh, reset, roles | 30–45 |
| Third-party integration (payments, email, SMS, maps) | 12–24 |
| File upload + storage + processing pipeline | 16–28 |
| Admin dashboard with filters, tables, bulk actions | 40–70 |
| Realtime feature (chat, notifications, live updates) | 30–55 |
| Search with facets and ranking | 25–50 |
| Mobile screen with state, validation, offline handling | 8–14 |
| Design system foundation (tokens, primitives, docs) | 25–40 |
| CI/CD, environments, monitoring, error tracking | 16–30 |

Estimate by *counting*, not by feel. Eleven screens × 9 hours is an estimate. "The frontend is about three weeks" is a guess wearing an estimate's clothes.

## Step 2 — AI-native multiplier

AI does not speed up all work equally, and pretending it does is how AI-native shops end up losing money on the exact projects they win. Apply the multiplier **per task**, by the task's shape:

| Work type | Multiplier | Why |
|---|---:|---|
| Boilerplate, scaffolding, config, migrations | **0.25×** | Near-total generation; review is the only real cost |
| CRUD, forms, standard endpoints, known patterns | **0.35×** | Pattern is in the model's weights and in the repo |
| UI from an approved design spec | **0.40×** | Fast to generate, slow to get pixel-honest |
| Standard feature with a known library | **0.50×** | Generation fast, wiring and edge cases are not |
| Third-party integration | **0.65×** | Docs drift, sandboxes break, webhooks need real testing |
| Novel business logic, pricing rules, workflows | **0.75×** | The thinking is the work; AI types it faster, that is all |
| Algorithmic / ML / performance-critical | **0.85×** | Correctness needs a human who understands it |
| Data migration from a legacy system | **0.85×** | Reality of the old data dominates |
| Discovery, requirements, stakeholder work | **1.00×** | No speedup. Meetings run at human speed |
| QA, security review, accessibility, UAT fixes | **0.80×** | Faster to find, same time to verify |
| Deployment, infra, environments | **0.50×** | Config generation helps; credentials and DNS do not |

A whole-project blend usually lands at **0.42–0.55×**, i.e. roughly **2× traditional velocity**. If your blend comes out below 0.35×, you have under-counted the discovery, integration and QA that AI does not accelerate — go back and check.

**Never quote the multiplier to the client as a discount.** The client buys an outcome at a market price and a shorter calendar. The multiplier is your margin model, not their line item.

## Step 3 — Risk buffer

Add on top of post-multiplier hours:

| Condition | Add |
|---|---:|
| Baseline (always) | +10% |
| Requirements from meeting notes only, no written spec signed | +15% |
| More than two decision-makers on the client side | +10% |
| Any integration with a system you have not seen working | +15% |
| Design not yet approved when the estimate is issued | +12% |
| Legacy data migration in scope | +20% |
| Regulatory scope (health, finance, GDPR-heavy, accessibility statutory) | +15% |
| Fixed launch date tied to a client event | +10% |

Cap the total buffer at **+45%**. Past that the project is not estimable and the honest move is a paid discovery phase — quote that alone, and quote the build after it.

## Step 4 — Calendar

Hours are not weeks. Convert with real capacity:

- Solo AI-native engineer: **6 productive hours/day, 5 days/week = 30 h/week.** Never 40.
- PM/discovery overhead: **+1 day/week** on top, not inside, the engineering hours.
- Client review latency: **3 business days per approval gate.** Put every gate on the calendar.
- Nothing runs in parallel with one engineer. With two, assume **1.7×** throughput, not 2×.

```
calendar weeks = billable hours / 30, then + one week per approval gate
```

State the assumed start date and mark the estimate valid for **30 days**.

---

## Sanity tiers — check your total against these before sending

If your number sits outside its tier, either the scope is genuinely unusual (say so explicitly in the assumptions) or the estimate is wrong.

| Project shape | Billable hours | Calendar | Price at mid-market |
|---|---:|---:|---:|
| Marketing site, 5–8 pages, CMS, no auth | 60–110 | 3–5 wks | $4.5k–8.5k |
| Marketing site + blog + forms + i18n | 110–170 | 5–7 wks | $8k–13k |
| Web app MVP: auth + 3–4 modules + admin | 220–380 | 8–13 wks | $16k–29k |
| Web app v1: the above + payments + reporting + roles | 400–600 | 13–20 wks | $30k–46k |
| Mobile MVP (cross-platform) + backend + store submission | 320–520 | 11–17 wks | $24k–40k |
| Mobile + web + shared backend | 550–800 | 18–26 wks | $42k–61k |
| Multi-tenant SaaS platform, billing, admin, integrations | 650–950 | 20–30 wks | $50k–72k |

---

## What the ESTIMATE.md must contain

1. The task table: task, work type, baseline hours, multiplier, post-multiplier hours.
2. Phase subtotals.
3. The buffer line, itemised by condition, with the percentage shown.
4. Total billable hours.
5. Calendar with dates, approval gates marked.
6. **The three things most likely to blow this estimate**, named. This is the most useful paragraph in the document and the one that earns trust when something does slip.
