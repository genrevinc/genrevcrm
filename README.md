# GenRev

A production-grade B2B CRM built with React + Node.js + PostgreSQL. Deploys to Railway in one click.

## Features

- **Pipeline kanban** — drag deals through 9 customizable stages
- **Contacts & companies** — full profiles with activity timeline
- **Deal management** — value tracking, probability, close dates
- **Task manager** — due dates, priorities, overdue alerts
- **AI lead scoring** — 0-100 scores with signal breakdown (Claude-powered)
- **AI email drafter** — personalized follow-up emails in seconds
- **AI pipeline health** — flags idle deals, stale proposals, risks
- **Automation engine** — trigger/condition/action rules with 6 built-in recipes
- **Reports** — pipeline funnel, forecast, rep performance
- **Quotes & products** — line-item quote builder
- **Multi-user** — roles: admin, manager, sales, support, viewer

## Quick Start (Local)

```bash
# 1. Clone and install
git clone https://github.com/yourname/genrev
cd genrev
npm install --prefix backend
npm install --prefix frontend

# 2. Set up Postgres and create .env
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL

# 3. Run migrations
node backend/src/db/migrate.js

# 4. Start dev servers
# Terminal 1:
cd backend && npm run dev
# Terminal 2:
cd frontend && npm run dev

# 5. Open http://localhost:5173
# Login: admin@genrevcrm.com / Admin123!
```

## Deploy to Railway (Production)

### Step 1 — Push to GitHub
```bash
git init && git add . && git commit -m "GenRev v1"
git remote add origin https://github.com/YOURNAME/genrev.git
git push -u origin main
```

### Step 2 — Create Railway project
1. Go to [railway.app](https://railway.app) → **New Project**
2. Click **Deploy from GitHub repo** → select `genrev`
3. Click **Add service → Database → PostgreSQL**
   - Railway automatically injects `DATABASE_URL` ✓

### Step 3 — Set environment variables
In Railway dashboard → your service → **Variables** tab:
```
NODE_ENV=production
JWT_SECRET=your-very-long-random-secret-here
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx   ← optional, enables AI features
```

### Step 4 — Deploy
- Railway detects `nixpacks.toml` and builds automatically
- Build: installs deps + builds React frontend
- Start: `node backend/src/index.js` serves both API and frontend

### Step 5 — Run migrations (first deploy only)
In Railway → your service → **Terminal** (or use Railway CLI):
```bash
node backend/src/db/migrate.js
```

### Step 6 — Access your CRM
Railway gives you a URL like: `https://genrev-production.up.railway.app`

**Default login:**
- Email: `admin@genrevcrm.com`
- Password: `Admin123!`
- ⚠️ Change this immediately after first login via Settings

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Auto-set by Railway Postgres plugin |
| `JWT_SECRET` | ✅ | Long random string for JWT signing |
| `NODE_ENV` | ✅ | Set to `production` on Railway |
| `ANTHROPIC_API_KEY` | Optional | Enables Claude AI features |
| `PORT` | Auto | Railway sets this automatically |

## API

The CRM exposes a full REST API at `/api`:

```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/contacts
POST   /api/contacts
GET    /api/deals/pipeline-view
POST   /api/deals
PATCH  /api/deals/:id
GET    /api/dashboard/stats
POST   /api/ai/score-contact/:id
POST   /api/ai/suggest-tasks/:dealId
POST   /api/ai/draft-email/:contactId
GET    /api/ai/pipeline-health
POST   /api/automations/trigger
```

All endpoints require `Authorization: Bearer <token>` except auth routes.

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, React Router
- **Backend**: Node.js, Express, PostgreSQL (pg), JWT
- **AI**: Anthropic Claude API (claude-haiku-4-5-20251001)
- **Deploy**: Railway (Nixpacks build, Postgres plugin)

## Project Structure

```
genrev/
├── backend/
│   └── src/
│       ├── index.js          # Express app entry
│       ├── jobs.js           # Background job runner
│       ├── db/
│       │   ├── index.js      # PG pool
│       │   └── migrate.js    # Schema + seed
│       ├── middleware/
│       │   └── auth.js       # JWT middleware
│       └── routes/
│           ├── auth.js
│           ├── contacts.js
│           ├── deals.js
│           ├── ai.js         # AI scoring, drafting, health
│           ├── automations.js
│           └── other.js      # Companies, tasks, dashboard...
├── frontend/
│   └── src/
│       ├── pages/            # 15 pages
│       ├── components/       # Layout, modals
│       ├── hooks/            # Auth context
│       └── lib/              # Axios client
├── railway.json
└── nixpacks.toml
```
