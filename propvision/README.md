# PropVision

AI Architectural & Real Estate Visualization Platform. Built for AgentCon Raleigh 2026 demo.

## Stack
- **Backend**: Node 22 + Express + TypeScript + Prisma + PostgreSQL
- **Workers**: BullMQ (Redis), PostgreSQL `LISTEN/NOTIFY` for live progress
- **Frontend**: Vite + React 18 + Tailwind 3 + react-router 6
- **Storage**: Azure Blob (with local-disk fallback when not configured)
- **AI**: Anthropic (vision/text) + Stability AI (images) + Azure OpenAI DALL-E (fallback) + mock provider for offline demo
- **Payments**: Stripe Checkout + Billing Portal
- **Auth**: JWT in httpOnly cookie

## Quickstart

```bash
# 0. Prereqs: Node 22+, PostgreSQL, Redis (optional but worker needs it)
cp .env.example .env   # fill in DATABASE_URL at minimum

# 1. Install
npm install

# 2. DB
npm --workspace server run db:generate
npm --workspace server run db:migrate
npm --workspace server run db:seed

# 3. Run (api + client)
npm run dev            # in another shell, run worker:
npm --workspace server run worker
```

API on :4000, client on :5173. Seeded users: `admin@propvision.local / admin123` and `agent@propvision.local / agent123`.

## Modes

- **Mock mode** — without `STABILITY_AI_API_KEY` and `ANTHROPIC_API_KEY`, the AI service falls back to a mock provider that returns demo images and stub analysis. Lets the whole UI run end-to-end with no external API keys.
- **Local storage** — without `AZURE_STORAGE_CONNECTION_STRING`, uploads land in `./uploads/` and are served via the API.
- **Stripe disabled** — billing routes return 503 if `STRIPE_SECRET_KEY` is missing.

## Layout

```
server/
  src/
    routes/        # Express handlers
    services/      # queue, streaming, storage, stripe, ai/
    workers/       # BullMQ dispatcher + handlers/ per job type
    middleware/    # auth
    config/        # credit costs, format presets
    lib/           # asset I/O, watermarking
client/
  src/
    pages/         # one per feature workflow
    components/    # AppShell, FileUploader, BeforeAfter, MaskPainter…
    hooks/         # useJobStream (SSE)
    lib/           # api client, auth context
```

## Pipeline test

```bash
npm --workspace server run worker          # in shell 1
npm --workspace server run dev             # in shell 2
tsx server/src/test-pipeline.ts            # in shell 3 — enqueues 3 jobs and watches them complete
```
