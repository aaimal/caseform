# Caseform

Spec → structured test cases, guided by your best manual exemplars, refined in a review loop, exported as CSV.

**Stack:** Next.js (App Router) · Supabase Cloud (Auth + Postgres) · OpenAI · Vercel

Cloud-only delivery: configure Supabase + Vercel env vars, push, use the preview URL. No local Docker/Postgres required.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. SQL editor → run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
3. Authentication → enable Email provider (disable confirm email for faster pilots if you want)

### 2. Environment

Copy `.env.example` into Vercel project settings (and optionally a local `.env.local` only if you choose to run tooling):

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server only) |
| `DATABASE_URL` | Supabase → Settings → Database → URI (prefer pooler / transaction mode, port 6543) |
| `OPENAI_API_KEY` | OpenAI dashboard |
| `AI_PROVIDER` | `openai` |

### 3. Vercel

1. Import this repo
2. Add the env vars
3. Deploy — prompts under `/prompts` ship with the app

## Product flow

1. **Exemplars** — import CSV of golden manual cases  
2. **Spec** — paste requirements, attach an exemplar set  
3. **Brief** — detail / coverage / preconditions / focus / always-consider  
4. **Generate** — two-pass AI (requirements → cases)  
5. **Review** — edit, comment, regenerate one case, accept  
6. **Export** — CSV or Jira-friendly CSV (accepted by default)

## Prompt templates

Edit YAML in `/prompts` (not app code). Recorded on each generation for reproducibility.

## Scripts

```bash
npm run lint
npm run build   # CI / Vercel
```
