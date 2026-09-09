Stack and conventions for `mtns-academy-frontend/`. Imported by `CLAUDE.md`.

| Concern | Tool |
|---------|------|
| Framework | React 19 |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Server state | TanStack Query v5 |
| Forms | react-hook-form + Zod v4 |
| UI | shadcn/ui + Radix UI + Tailwind CSS v4 |
| HTTP | axios (`src/lib/api.ts`) |
| Build | Vite 8 + TypeScript 6 |

Routes live under `src/routes/`. Auth-gated routes are nested inside `_authenticated/`. Queries and mutations go in `src/lib/queries.ts`.

Use `/react` (skill) for the step-by-step recipe, `/react-coder` (agent) to implement.

Before finishing frontend work, run `npx tsc --noEmit`.
