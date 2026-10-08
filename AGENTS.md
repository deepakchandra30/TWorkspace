Project uses Next.js,
MongoDB
try to use prebuilt components like shadcn/ui as much as possible, and customise then, instead of writing them from scrtach

I'M VALERII do my part of work

Remember: 
@assets/PLAN.md

## Team — who owns what

Two people, one coding agent each. **Edit only your owner's files.** If a change needs someone else's file, stop and tell your human, who messages the owner.

| Owner | Role | Owns |
| --- | --- | --- |
| Valerii | Person A — server and database | `server/`, `server.js`, `lib/`, `scripts/` (except `seed.js`), `tests/`, `app/api/`, root config: `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `render.yaml`, `tsconfig.json`, `vitest*.config.ts`, `eslint.config.mjs` |
| Lisa | Person B — UI and shipping | `app/` except `app/api/`, `components/`, `public/`, `scripts/seed.js`, `README.md` |

Shared: `assets/PLAN.md` (pull before editing). `AGENTS.md` belongs to Valerii.

## Git rules for every agent

- Stage by path: `git add <paths>`. Never `git add -A` or `git add .`.
- `git pull --rebase` before every push. Push small commits often.
- `pnpm-lock.yaml` conflict: run `pnpm install` and commit the result. Never hand-merge it.
- Need a new dependency? Ask Valerii, who owns `package.json`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


