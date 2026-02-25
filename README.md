# AMA Board

A live, production-ready "Ask Me Anything" web app for company events. Employees submit questions, upvote/downvote others, and hosts mark questions as answered in real time.

## Features

- Multiple simultaneous AMA events
- Anonymous or named question submission
- Upvote / downvote with once-per-browser enforcement (DB unique constraint)
- Vote toggling (upvote ↔ downvote ↔ clear)
- Live polling every 3 s — no WebSockets required
- Host/admin live mode: mark questions as Answered; they disappear from the public list instantly
- Admin protected by a simple password + signed HttpOnly cookie session
- No SSO / no OAuth — voter ID is a stable cookie

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (any hosted provider) |
| Styling | Tailwind CSS |
| Deploy | Vercel (serverless, no Docker) |

---

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd ama-board
npm install
```

### 2. Create a Postgres database

Use any hosted Postgres provider. Two popular free options:

**Neon** (recommended for Vercel)
1. Go to [neon.tech](https://neon.tech) → create a project
2. Copy the connection string (pooled endpoint)

**Supabase**
1. Go to [supabase.com](https://supabase.com) → create a project
2. Settings → Database → Connection string (URI mode)

> Either way you'll get a `postgresql://...` URL. Do **not** use provider-specific SDKs — just set `DATABASE_URL`.

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://user:password@host:5432/ama_board?sslmode=require"
ADMIN_PASSWORD="your-secure-admin-password"
ADMIN_SESSION_SECRET="a-random-string-at-least-32-characters-long"
```

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run Prisma migrations

```bash
# Create and apply migrations (development)
npm run db:migrate:dev

# Or just apply existing migrations (production / CI)
npm run db:migrate
```

### 5. Seed the first event (optional)

```bash
npm run db:seed
```

This creates one "Company All-Hands AMA" event if no events exist yet. You can also create events from the admin UI.

### 6. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Admin Usage

1. Navigate to `/admin/login`
2. Enter the `ADMIN_PASSWORD` value
3. You're taken to the admin dashboard where you can:
   - Create and activate/deactivate events
   - Click **Manage** on any event to enter live host mode
   - See all open questions sorted by score
   - Click **Mark Answered** — the question disappears from the public board immediately
   - Switch to the **Answered** tab to review or **Reopen** answered questions

---

## Deploying to Vercel

### 1. Push to GitHub / GitLab

```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### 2. Import project on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your repository
3. Framework preset: **Next.js** (auto-detected)

### 3. Set environment variables in Vercel

In **Project Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `ADMIN_PASSWORD` | Your admin password |
| `ADMIN_SESSION_SECRET` | Your 32+ char random secret |

> For Neon: use the **pooled** connection string for serverless compatibility.
> For Supabase: use the **Transaction** mode pooler URL (port 6543).

### 4. Run migrations before first deploy

Option A — run locally with production `DATABASE_URL`:
```bash
DATABASE_URL="<production-url>" npm run db:migrate
```

Option B — add a Vercel build command:
In Vercel project settings, set **Build Command** to:
```
prisma migrate deploy && next build
```
(The `postinstall` script already runs `prisma generate`.)

### 5. Deploy

Vercel builds and deploys automatically on every push to `main`.

---

## Required Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ADMIN_PASSWORD` | Password to access `/admin` | Yes |
| `ADMIN_SESSION_SECRET` | Secret for signing admin session cookie (min 16 chars) | Yes |

---

## Data Model

```
Event        — id, title, description?, isActive, createdAt
Question     — id, eventId, text, submittedName?, isAnonymous, status(OPEN|ANSWERED), createdAt
Vote         — id, questionId, voterId, value(+1|-1), unique(questionId, voterId)
```

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/events` | Public | List active events |
| POST | `/api/events` | Admin | Create event |
| GET | `/api/events/:id/questions` | Public/Admin | List questions (OPEN only for public; all for admin) |
| POST | `/api/events/:id/questions` | Public | Submit question |
| POST | `/api/questions/:id/vote` | Public | Upsert vote (+1/-1/0) |
| POST | `/api/questions/:id/answer` | Admin | Mark as ANSWERED |
| DELETE | `/api/questions/:id/answer` | Admin | Reopen question |
| GET | `/api/admin/events` | Admin | List all events |
| PATCH | `/api/admin/events` | Admin | Toggle event active state |
| POST | `/api/admin/login` | — | Admin login |
| POST | `/api/admin/logout` | — | Admin logout |
