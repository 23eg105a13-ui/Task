# GitHub Profile Analyzer API

A backend service that fetches a GitHub user's public profile via the [GitHub REST API](https://docs.github.com/en/rest), computes useful derived insights (language breakdown, star/fork totals, an activity score, etc.), and persists everything in MySQL.

Built with **Node.js, Express.js, TypeScript, and MySQL** as required.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Design Notes & Extra Features](#design-notes--extra-features)
- [Deployment](#deployment)
- [Postman Collection](#postman-collection)

---

## Features

**Required:**
1. ✅ Fetch a public GitHub profile by username
2. ✅ Compute and store useful insights (repo count, followers, etc.)
3. ✅ Persist results in MySQL
4. ✅ `GET` endpoint to list all analyzed profiles
5. ✅ `GET` endpoint to fetch a single analyzed profile

**Added on top of the spec** (see [Design Notes](#design-notes--extra-features) for rationale):
- Language breakdown per profile (top languages by repo count, with %)
- Aggregated star/fork/watcher totals across a user's non-fork repos
- A computed **Activity Score** (0–100ish) blending followers, stars, repo count, account age, and recency of pushes
- "Most starred repo" and "last pushed" tracking, with a recent-activity flag
- Top-10 repositories stored per profile (for richer single-profile responses)
- Historical snapshots on every re-analysis (`analysis_runs` table) so growth over time can be tracked
- Pagination, sorting, and search on the list endpoint
- A `/api/profiles/stats/summary` aggregate dashboard endpoint
- In-memory caching to avoid re-hitting GitHub for the same username repeatedly
- Rate limiting, Helmet security headers, gzip compression, request logging
- Centralized error handling with clear, consistent JSON error responses
- Input validation (GitHub username format, pagination bounds, sort allow-list)
- A `/health` endpoint for uptime monitors / deployment platforms
- Full TypeScript types across the codebase

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (≥18) |
| Language | TypeScript |
| Framework | Express.js |
| Database | MySQL (via `mysql2/promise`) |
| External API | GitHub REST API (`api.github.com`) |
| Caching | `node-cache` (in-memory) |
| Security | `helmet`, `cors`, `express-rate-limit` |
| Logging | `morgan` |

---

## Project Structure

```
github-profile-analyzer/
├── database/
│   └── schema.sql              # Full DDL — run directly or via `npm run migrate`
├── src/
│   ├── config/
│   │   ├── env.ts              # Centralized environment variable loading
│   │   └── database.ts         # MySQL connection pool
│   ├── controllers/
│   │   └── profileController.ts
│   ├── database/
│   │   └── migrate.ts          # Applies schema.sql programmatically
│   ├── middleware/
│   │   ├── errorHandler.ts
│   │   └── validators.ts
│   ├── models/
│   │   └── types.ts            # Shared TypeScript interfaces
│   ├── routes/
│   │   ├── healthRoutes.ts
│   │   └── profileRoutes.ts
│   ├── services/
│   │   ├── githubService.ts     # GitHub API client
│   │   ├── insightsService.ts   # Pure computation logic (no I/O) — see below
│   │   ├── analyzerService.ts   # Orchestrates fetch -> compute -> persist
│   │   ├── profileRepository.ts # All SQL queries
│   │   └── cacheService.ts
│   ├── utils/
│   │   ├── asyncHandler.ts
│   │   └── formatters.ts        # Converts DB rows -> clean API JSON
│   ├── app.ts                   # Express app wiring (middleware + routes)
│   └── server.ts                # Entry point
├── postman_collection.json
├── .env.example
├── package.json
└── tsconfig.json
```

`insightsService.ts` is deliberately a pure function with no database or network calls — this made it straightforward to unit test in isolation (17 assertions covering normal cases, zero-repo users, and fork-only users were run during development) and keeps the "business logic" cleanly separated from I/O.

---

## Setup Instructions

### Prerequisites
- Node.js ≥ 18
- A running MySQL server (local install, Docker container, or a managed service like PlanetScale/Aiven/Railway MySQL)
- (Optional but recommended) a [GitHub personal access token](https://github.com/settings/tokens) — no scopes needed, just creating one raises your API rate limit from 60/hr to 5000/hr

### Steps

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd github-profile-analyzer

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# edit .env with your MySQL credentials and (optionally) a GITHUB_TOKEN

# 4. Create the database & tables
npm run migrate:dev
# (or manually: mysql -u root -p < database/schema.sql)

# 5. Run in development (auto-reload)
npm run dev

# --- OR run a production build ---
npm run build
npm start
```

The server starts on `http://localhost:3000` by default (configurable via `PORT`).

Verify it's working:
```bash
curl http://localhost:3000/health
```

---

## Environment Variables

See `.env.example` for the full list with comments. Key ones:

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default `3000`) | Port the server listens on |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Yes | MySQL connection details |
| `GITHUB_TOKEN` | No, but recommended | Personal access token to raise GitHub's rate limit |
| `CACHE_TTL_SECONDS` | No (default `300`) | How long a successful analysis is cached |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | No | API-level rate limiting on this service itself |

---

## Database Schema

Full DDL lives in [`database/schema.sql`](./database/schema.sql). Summary:

### `profiles`
One row per analyzed GitHub username (uniquely keyed on GitHub's immutable numeric `github_id`, so renaming a GitHub account doesn't create a duplicate row). Stores raw GitHub fields (bio, company, follower/repo counts, etc.) plus all computed insight columns (`activity_score`, `most_used_language`, `top_languages_json`, etc.).

### `analysis_runs`
Append-only historical log. Every time a profile is (re-)analyzed, a snapshot of its key metrics is inserted here, enabling growth-over-time tracking without bloating the main table.

### `repositories`
The top 10 repositories (by stars) captured per profile at analysis time, used to power the "top repositories" section of the single-profile response and to compute the most-starred-repo / language-breakdown insights.

Re-running `npm run migrate` is always safe — every statement uses `CREATE ... IF NOT EXISTS`.

---

## API Reference

Base URL: `http://localhost:3000` (or your deployed URL)

### `GET /health`
Liveness + DB-connectivity check.
```json
{ "success": true, "status": "ok", "database": "connected", "timestamp": "..." }
```

### `POST /api/profiles/analyze`
Fetches a GitHub profile, computes insights, and stores/updates it.

**Body:**
```json
{ "username": "octocat" }
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile 'octocat' analyzed and stored successfully.",
  "data": {
    "id": 1,
    "username": "octocat",
    "name": "The Octocat",
    "counts": { "publicRepos": 8, "publicGists": 8, "followers": 18000, "following": 9 },
    "insights": {
      "totalStarsReceived": 2300,
      "mostUsedLanguage": "Ruby",
      "topLanguages": [{ "language": "Ruby", "repoCount": 3, "percentage": 60 }],
      "mostStarredRepo": { "name": "Hello-World", "stars": 2300 },
      "accountAgeDays": 5000,
      "activityScore": 78.4,
      "hasRecentActivity": true
    },
    "topRepositories": [ /* ... */ ]
  }
}
```

Re-analyzing the same username updates the existing row rather than duplicating it, and appends a new entry to the historical log.

### `GET /api/profiles`
List all analyzed profiles, paginated.

**Query params:** `page` (default 1), `limit` (default 10, max 100), `sortBy` (`followers_count` | `activity_score` | `public_repos_count` | `analyzed_at`), `order` (`ASC`|`DESC`), `search` (matches username/name).

```
GET /api/profiles?page=1&limit=10&sortBy=followers_count&order=DESC
```

### `GET /api/profiles/:username`
Full detail for one previously-analyzed profile, including its top repositories and analysis history. Returns `404` if that username hasn't been analyzed yet.

### `DELETE /api/profiles/:username`
Removes a stored profile (cascades to its repositories and history).

### `GET /api/profiles/stats/summary`
Aggregate stats across every analyzed profile (total profiles, combined followers/stars, average activity score) — a small bonus "dashboard" endpoint.

All error responses follow the same shape:
```json
{ "success": false, "error": "Human-readable message" }
```

---

## Design Notes & Extra Features

A few choices worth calling out, since the brief explicitly invited adding improvements:

- **Activity Score** — a single composite number meant to give an at-a-glance sense of how active/established a profile is, blending log-scaled followers and stars (so one viral repo doesn't dominate the score), repo count, account age, and a recency bonus. The exact weights are documented inline in `insightsService.ts` and easy to tune.
- **Non-fork filtering** — star/fork/language stats are computed from the user's *original* repos, not their forks, so someone who forked a hugely popular repo doesn't get credit for its stars. Falls back to including forks only if the user has zero original repos, so the stats aren't needlessly zeroed out.
- **Historical snapshots** — rather than overwriting metrics on every re-analysis, a row is appended to `analysis_runs` each time, so you could later build a "followers over time" chart for any tracked profile.
- **Caching** — repeatedly analyzing the same username within `CACHE_TTL_SECONDS` skips the GitHub round-trip entirely, which matters because GitHub's unauthenticated rate limit is only 60 requests/hour.
- **GitHub token is optional** — the app works without one (good for quick local testing) but rate-limits fast; setting `GITHUB_TOKEN` is a one-line config change that raises the ceiling by ~80x.

---

## Deployment

This project has **not** been deployed yet — it's built to be deployment-ready on any standard Node host. A typical free-tier path:

1. **Database:** a managed MySQL instance (e.g. [Aiven](https://aiven.io), [Railway](https://railway.app), [PlanetScale](https://planetscale.com), or [Clever Cloud](https://www.clever-cloud.com)).
2. **App host:** [Railway](https://railway.app), [Render](https://render.com), or [Fly.io](https://fly.io) — all support: set env vars → `npm run build` → `npm start`.
3. Run `npm run migrate` once against the production database (or paste `database/schema.sql` into the provider's SQL console).
4. Set `GITHUB_TOKEN` in the host's environment variables to avoid rate-limit issues in production.

> Once deployed, replace this section (and the submission email/form) with your live API URL.

---

## Postman Collection

Import [`postman_collection.json`](./postman_collection.json) into Postman. It includes every endpoint above plus two intentional error-case requests (invalid username format, profile-not-found) to demonstrate the validation and error-handling layer.

---

## Author

**Vivek (Donkena Sri Vivek Chand)**
B.Tech Computer Science, Anurag University, Hyderabad
GitHub: [github.com/Vivek105013](https://github.com/Vivek105013) · LinkedIn: [donkena-sri-vivek-chand](https://linkedin.com/in/donkena-sri-vivek-chand)
