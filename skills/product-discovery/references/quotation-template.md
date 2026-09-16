# Quotation Template

Copy into `.project-doc/commercial/QUOTATION.md`. Rates and construction rules come from `rate-card.md`; hours come from `.project-doc/plan/ESTIMATE.md`. Never invent a number here — every figure in this document must trace to a row in the estimate.

```markdown
---
title: <Product Name>
subtitle: Proposal and fixed-price quotation
doc-type: Quotation
client: <Client legal name>
date: <YYYY-MM-DD>
version: v1.0
author: <Your company>
status: Valid for 30 days
---

## 1. What you are buying

Four sentences. The outcome, not the technology. A client who has to read a stack list to understand what they are getting will compare you on price, because you have given them nothing else to compare on.

## 2. Scope of delivery

| Phase | What it delivers | You receive at the end |
|---|---|---|
| 1. Discovery & design | ... | Approved PRD, design system, page specs |
| 2. Foundation | ... | Running environments, auth, deployed shell |
| 3. Core build | ... | The primary user journeys, working |
| 4. Completion | ... | Remaining features, admin, integrations |
| 5. Hardening & launch | ... | Tested, audited, deployed, handed over |

Full detail: `.project-doc/docs/PRD.md`. Everything outside it: `.project-doc/docs/SCOPE.md`.

## 3. Timeline

| Phase | Duration | Starts after | Your involvement |
|---|---:|---|---|

**Total: <n> weeks** from signature, assuming a start on or before <date> and approvals returned within 3 business days at each gate.

## 4. Investment

| Phase | Effort (h) | Price |
|---|---:|---:|
| 1. Discovery & design | 00 | $0,000 |
| 2. Foundation | 00 | $0,000 |
| 3. Core build | 00 | $0,000 |
| 4. Completion | 00 | $0,000 |
| 5. Hardening & launch | 00 | $0,000 |
| **Total** | **000** | **$00,000** |

Fixed price. The phase prices are firm for the scope described in the PRD at version <x>.

### Payment schedule

| Milestone | Due | Amount |
|---|---|---:|
| On signature | Before mobilisation | 30% — $0,000 |
| <Midpoint milestone> accepted | Within 7 days | 40% — $0,000 |
| Final acceptance | Before production handover | 30% — $0,000 |

## 5. What is included

- All engineering, design and project management for the scope above.
- Source code, in your repository, transferred to you on final payment.
- The complete `.project-doc/` documentation set — PRD, architecture, data model, API contract, decision log. Portable, plain Markdown, readable by any team or AI tool you use later.
- Deployment to your production environment and a handover walkthrough.
- 30 days of defect correction after launch. A defect is a deviation from the approved PRD.

## 6. What is not included

- Third-party licences, subscriptions and usage fees (hosting, email, SMS, payment processing, maps, error tracking).
- Domain registration and DNS management.
- Content writing, copy-editing, translation, and paid stock photography or video.
- App store developer accounts and the fees attached to them.
- Ongoing maintenance beyond the 30-day defect window — see §9.
- Everything listed under Out of Scope in `.project-doc/docs/SCOPE.md`.

## 7. What we need from you

| We need | From | By |
|---|---|---|
| A single named decision-maker with authority to approve | | Signature |
| Brand assets — logo files, fonts, colour references | | Phase 1, day 3 |
| Content — copy, images, product data | | Phase 3 start |
| Credentials for <integration> | | Phase 4 start |
| Approval at each phase gate | | Within 3 business days |

Delay in any of these moves the delivery date by the same number of days. This is the single most common cause of a missed launch and the reason it is written down here rather than discovered later.

## 8. Changes

Anything not in the approved PRD is a change request. We quote it in hours at $70/hr (2-hour minimum) and do not start it until you approve in writing. Small changes are usually absorbed; we will tell you plainly when one is not.

## 9. After launch

| Option | What you get | Price |
|---|---|---:|
| Care plan | Hosting oversight, dependency and security updates, monitoring, 4 h/month of changes | $000/month |
| Support retainer | The above plus 20 h/month of development | $0,000/month |
| Ad hoc | Billed as used, scheduled subject to availability | $70/hr |

## 10. Assumptions this price depends on

Numbered, and cross-referenced to the PRD assumptions section. If one turns out to be untrue, we will tell you what it does to the price and the date before doing any work on it.

## 11. Terms

- **Validity:** 30 days from <date>.
- **Currency:** USD. <Taxes / VAT treatment.>
- **Intellectual property:** all deliverables transfer to you on receipt of final payment.
- **Confidentiality:** mutual, covering all material exchanged.
- **Cancellation:** work completed to the date of notice is invoiced pro rata; deposits cover mobilisation and are non-refundable.
- **Warranty:** the 30-day defect window in §5. No warranty on third-party services.

## 12. Acceptance

| | Client | Supplier |
|---|---|---|
| Name | | |
| Role | | |
| Signature | | |
| Date | | |
```

## Rules for producing it

- **Every number traces to the estimate.** If the estimate changes, regenerate the quotation; never patch a figure by hand.
- **Never show the client the AI-native multiplier or the traditional baseline.** They buy an outcome at market price on a short calendar. Internal arithmetic stays in `plan/ESTIMATE.md`.
- **Round the total down** to a clean figure. $23,850 → $23,500.
- **Three price points beat one** when the client's budget is unknown: quote the recommended scope, a reduced Phase-1-only option, and an extended option. Most clients pick the middle, and the ones who cannot afford it self-select without a negotiation.
- **Name the exclusions concretely.** "Third-party costs" is a dispute; "Stripe fees, SendGrid subscription, Apple Developer account $99/yr" is a shared understanding.
