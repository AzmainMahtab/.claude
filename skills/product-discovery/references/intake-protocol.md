# Intake Protocol

How to turn a pile of client material into a business context you can build a PRD on.

## 1 — Preserve the raw material

Everything the client gave you goes into `.project-doc/context/raw/` **verbatim and unedited**: meeting minutes, call transcripts, WhatsApp exports, emailed feature lists, screenshots, competitor links, brand PDFs. Name files `YYYY-MM-DD-<type>-<topic>.md`.

Never paraphrase into the raw folder and never delete from it. Six weeks later, when the client says "we agreed the app would do X", the raw folder is the only thing that settles it.

Index every file in `context/SOURCES.md`:

| File | Date | Type | Participants | What we took from it |
|---|---|---|---|---|

## 2 — Extract, do not summarise

Read every source and pull four separate lists. Keep them separate — collapsing them is the most common intake mistake, because a wish becomes a requirement the moment nobody remembers which it was.

- **Facts** — verifiable statements about the business today. "They process 40 bookings a week by phone."
- **Requirements** — things the product must do. Tag each with its source: `[2026-09-02 kickoff]`.
- **Wishes** — things someone said they would like. Not commitments. These feed the Deferred list, not the PRD.
- **Constraints** — budget, deadline, existing systems, regulation, team capability, brand rules.

Anything that is an assumption dressed as a fact goes to `memory/OPEN_QUESTIONS.md`.

## 3 — Find what is missing

Run the checklist below against the extracted material. Every unanswered item is either an assumption you state explicitly in the PRD, or a question you ask. Prefer asking.

**Business**
- What is the measurable business outcome? Revenue, cost saved, time saved, risk removed?
- How is that measured today, and what is the number now?
- Who is the paying customer, and is that the same person as the user?
- What happens if this ships and nobody uses it? What is the fallback?

**Users**
- Who are the distinct user types, and which one is primary for v1?
- What does each one do today instead of using this product?
- What device and context do they use it in? Desk, phone, warehouse floor, poor connectivity?
- What is their tolerance for friction — captive users or a market with alternatives?

**Scope**
- What is the one thing that, if the product does not do it, makes the whole project pointless?
- What did they mention that is genuinely v2?
- Which existing systems must this talk to, and does an API exist for each?
- Is there data to migrate? How much, from where, in what state?

**Delivery**
- Is there a hard date, and what is it tied to? An event, a funding round, a contract?
- Who signs off, and who can veto after they sign off?
- Who provides content, brand assets and credentials, and by when?
- Budget range — ask directly. "What range were you expecting?" is a normal question and the answer prevents two wasted weeks.

**Non-functional**
- Expected users in month one and month twelve?
- Any regulatory or accessibility obligation? Health data, payment data, EU users, public sector?
- Availability expectation — is an hour of downtime an inconvenience or an incident?
- Who operates this after launch: us, them, or nobody?

## 4 — Ask well

Batch questions. One list of twelve beats twelve messages. Group by theme, mark each as **Blocking** or **Non-blocking**, and propose your own answer for every non-blocking one:

> **Non-blocking — 7. Guest checkout.** We assume guests can book without an account, and we will build it that way unless you say otherwise. Confirming costs you nothing; changing it later costs about 6 hours.

That format gets answers, because it converts an open question into a cheap confirmation. Reserve genuine open questions for the blocking ones.

## 5 — Write it down

`context/BUSINESS.md` gets: the business in three sentences, the outcome being bought, the users, the constraints, the competitive alternatives, and the commercial reality (budget signals, decision process, timeline pressure).

`context/STAKEHOLDERS.md` gets every named person, their role, **what they decide**, and how fast they answer. Mark the one person who can say yes on their own — if there isn't one, that fact is a project risk and belongs in the estimate buffer.
