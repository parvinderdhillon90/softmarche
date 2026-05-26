# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Softmarche** is a Next.js social media management tool for Facebook and Instagram. It lets a social media team schedule posts, publish immediately via the Meta Graph API, and view performance analytics — all from a calendar-driven UI.

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # production build
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript type check (no build output)

npx prisma generate          # regenerate Prisma client after schema changes
npx prisma migrate dev       # create + apply a new migration (requires DATABASE_URL)
npx prisma studio            # open Prisma Studio GUI
```

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `META_APP_ID` | Meta developer app ID |
| `META_APP_SECRET` | Meta developer app secret |
| `CRON_SECRET` | Bearer token that secures `/api/cron` |

## Architecture

### Data flow

```
Meta Graph API
    ↕  (src/lib/meta.ts)
API Routes  ←→  Prisma ORM  ←→  PostgreSQL
    ↕
Next.js App Router pages (client components)
```

### Key files

| Path | Role |
|---|---|
| `src/lib/meta.ts` | All Meta Graph API calls — publish FB/IG posts, fetch insights, OAuth exchange |
| `src/lib/scheduler.ts` | Picks up `SCHEDULED` posts whose `scheduledAt` has passed and publishes them |
| `src/lib/prisma.ts` | Singleton Prisma client (safe for Next.js hot-reload) |
| `prisma/schema.prisma` | Database schema — `Account`, `Post`, `Analytics` models |
| `prisma.config.ts` | Prisma 7 config; datasource URL comes from here, NOT from `schema.prisma` |

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/accounts` | GET | List connected Meta pages |
| `/api/accounts` | POST | Connect pages from a short-lived Meta user token |
| `/api/posts` | GET | List posts; filter by `?month=YYYY-MM` and `?status=` |
| `/api/posts` | POST | Create draft or scheduled post |
| `/api/posts/[id]` | PATCH / DELETE | Edit or delete a post |
| `/api/publish` | POST | Publish a post immediately via Meta API |
| `/api/analytics` | GET | Aggregate metrics; filter by `?platform=` and `?days=` |
| `/api/analytics` | POST | Pull fresh metrics from Meta for all published posts |
| `/api/cron` | GET | Called by Vercel Cron every minute; requires `Authorization: Bearer <CRON_SECRET>` |

### Pages (App Router, `src/app/(dashboard)/`)

- **`/calendar`** — monthly grid; click a day to create a post pre-filled with that date; click a post chip to view/edit/publish/delete
- **`/analytics`** — metric cards + bar chart + post table; refresh pulls live data from Meta
- **`/accounts`** — paste a short-lived Meta user token to connect all pages (and linked Instagram accounts) at once

### Database models

- **`Account`** — one row per Facebook Page. `instagramId` is set when the page has a linked Instagram Business account.
- **`Post`** — platform-specific post. `mediaUrls[]` holds public URLs Meta fetches from. Status lifecycle: `DRAFT → SCHEDULED → PUBLISHED | FAILED`.
- **`Analytics`** — one-to-one with `Post`; refreshed on demand via `/api/analytics` POST.

### Meta API notes

- Both Facebook and Instagram are accessed through the same Meta Graph API (`v19.0`).
- Authentication: short-lived user token → long-lived page token (stored in `Account.accessToken`).
- Instagram requires the Facebook Page to have a linked **Instagram Business Account** (`instagramId`).
- Carousel posts on Instagram upload each image as a container first, then publish them together.
- Insights are fetched per-post after publishing; metric names differ between platforms (see `src/lib/meta.ts` and `src/app/api/analytics/route.ts` for the mapping).

### Scheduled publishing

`/api/cron` is called by Vercel Cron every minute. It calls `processScheduledPosts()` in `src/lib/scheduler.ts`, which finds all `SCHEDULED` posts with `scheduledAt <= now` and publishes them. On failure the post moves to `FAILED` and the error is saved in `errorMsg`.
