# Vercel Next.js Frontend Migration — Design Spec

**Date:** 2026-05-02
**Status:** Approved

---

## Overview

Migrate the existing vanilla HTML/CSS/JS frontend (`static/`) into a Next.js app deployed on Vercel. The FastAPI backend moves to Railway (separately). Vercel auto-deploys on every push to `main`. The frontend is a pure client-side app — no SSR, no auth (both deferred to a future iteration).

---

## Architecture

```
GitHub repo (main branch)
       │ push → auto-deploy
       ▼
   Vercel (Next.js, client-side only)
       │ fetch → NEXT_PUBLIC_API_URL
       ▼
  Railway (FastAPI) → SQLite + Claude API
```

- Vercel hosts the Next.js app as a static/client-side export
- All API calls go directly from the browser to the Railway backend URL
- `NEXT_PUBLIC_API_URL` is set in the Vercel dashboard for production and in `.env.local` for local dev (`http://localhost:8000`)
- Railway backend already has `allow_origins=["*"]` — no CORS changes needed

---

## Visual Design

Inspired by Whoop / Strong fitness apps:

| Token | Value |
|---|---|
| Background | `#0a0a0a` |
| Surface | `#111` / `#1a1a1a` |
| Accent | `#c0f000` (neon green) |
| Text primary | `#ffffff` |
| Text muted | `#666` / `#888` |
| Border | `#222` |
| Success | `#c0f000` |
| Danger | `#ff4040` |

Typography: bold uppercase labels (`font-weight: 800`, `letter-spacing: 1.5px`, `text-transform: uppercase`) for section headers and stat labels. Body text stays normal case.

Replaces the existing red (`#e94560`) accent theme entirely.

---

## Styling

**CSS Modules** — one `.module.css` file per component. No Tailwind, no CSS-in-JS. Direct port and rewrite of `static/style.css` rules into scoped modules.

---

## File Structure

```
/
├── app/
│   ├── layout.tsx          # root layout, font, global reset
│   ├── page.tsx            # tabs shell (Saved Plans / New Plan / GymBot)
│   └── globals.css         # body background, font-family reset only
├── components/
│   ├── PlansTab/
│   │   ├── PlansTab.tsx
│   │   └── PlansTab.module.css
│   ├── NewPlanTab/
│   │   ├── NewPlanTab.tsx  # profile wizard (8-question flow)
│   │   └── NewPlanTab.module.css
│   ├── GymBotTab/
│   │   ├── GymBotTab.tsx   # chat UI — included as current unfinished state
│   │   └── GymBotTab.module.css
│   ├── PlanModal/
│   │   ├── PlanModal.tsx   # edit modal (day tabs, exercises, meals)
│   │   └── PlanModal.module.css
│   └── Toast/
│       ├── Toast.tsx       # bottom-right notification
│       └── Toast.module.css
├── lib/
│   └── api.ts              # typed fetch wrappers, reads NEXT_PUBLIC_API_URL
├── .env.local              # NEXT_PUBLIC_API_URL=http://localhost:8000 (gitignored)
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Component Responsibilities

| Component | Mirrors current | Notes |
|---|---|---|
| `PlansTab` | `#plans-tab` | List of saved plans, expand/collapse, restore, delete |
| `NewPlanTab` | `#new-tab` + `#wizard` | Profile wizard, generate plan button |
| `GymBotTab` | `#chat-tab` + `#gymbot` | Chat messages, input, generate plan from chat |
| `PlanModal` | `#modal-overlay` | Edit exercises/meals per day, save/cancel |
| `Toast` | `#toast` | Show/hide notification with success/error variants |

---

## API Layer (`lib/api.ts`)

Typed wrappers for all backend endpoints. No component calls `fetch` directly.

| Function | Method | Endpoint |
|---|---|---|
| `getProfile` | GET | `/api/profile` |
| `putProfile` | PUT | `/api/profile` |
| `getQuestions` | GET | `/api/questions` |
| `generatePlan` | POST | `/api/plans/generate` |
| `listPlans` | GET | `/api/plans` |
| `getPlan` | GET | `/api/plans/:id` |
| `updatePlan` | PUT | `/api/plans/:id` |
| `restorePlan` | POST | `/api/plans/:id/restore` |
| `deletePlan` | DELETE | `/api/plans/:id` |
| `getCheckOffs` | GET | `/api/check-offs` |
| `postCheckOff` | POST | `/api/check-offs` |
| `deleteCheckOff` | DELETE | `/api/check-offs/:id` |
| `postMealCheck` | POST | `/api/meal-check` |
| `postChat` | POST | `/api/chat` |
| `postChatGenerate` | POST | `/api/chat/generate` |

---

## Deployment Setup

1. Create Vercel project linked to this GitHub repo
2. Set `NEXT_PUBLIC_API_URL` in Vercel dashboard → Railway backend URL
3. Every push to `main` triggers automatic Vercel deployment
4. No `vercel.json` needed — Next.js App Router is auto-detected

---

## Out of Scope (deferred)

- **Authentication** — no login, anyone with the URL can use the app. To be added later (NextAuth or similar).
- **SSR / Server Components** — all data fetched client-side. To be added later if SEO or performance requires it.
- **Backend changes** — Railway FastAPI unchanged
- **GymBot completion** — GymBot tab migrated as-is; finishing it is a separate task
