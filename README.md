# DeBag Metrics

Production-style web app for time-and-motion observations on UPS DeBag workers.

## Stack

- Next.js (App Router, TypeScript)
- Prisma ORM
- PostgreSQL (Supabase or Neon)
- Tailwind CSS

## Why PostgreSQL

SQLite is not reliable on Vercel serverless because local disk is not persistent.  
This project is configured for Postgres so deployed data is durable.

## Features

- Mobile-friendly dashboard with clear workflow zones
- Tap-based timer modal for observation capture
- Quick add person + searchable person selection
- Real-time log with quick filters and sticky table header
- Reports tab with date-range summaries
- CSV export endpoint
- Optional app PIN gate (`APP_PIN`)
- Private `/documents` page with Supabase Storage uploads (no DB blobs)

## Project Structure

```text
ups_project/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── pin/route.ts
│   │   │   ├── documents/
│   │   │   │   ├── [id]/route.ts
│   │   │   │   ├── [id]/signed-url/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── observations/
│   │   │   │   ├── [id]/route.ts
│   │   │   │   ├── export/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── people/route.ts
│   │   │   └── reports/route.ts
│   │   ├── documents/page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── pin/page.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── debag-metrics-dashboard.tsx
│   └── lib/
│       ├── auth.ts
│       ├── auth-session.ts
│       ├── prisma.ts
│       ├── supabaseAdmin.ts
│       ├── supabaseClient.ts
│       └── validation.ts
├── middleware.ts
├── .env.example
├── package.json
└── README.md
```

## Environment Variables

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="YOUR_ANON_KEY"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
APP_PIN=""
```

- `DATABASE_URL`: pooled Postgres URL (runtime, Vercel-safe)
- `DIRECT_URL`: direct Postgres URL (for Prisma migrations)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase browser anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase server-side service role key
- `APP_PIN`: Optional UI/API PIN

## Local Setup

From the `ups_project` folder:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - lint code
- `npm run db:generate` - generate Prisma client
- `npm run db:migrate` - create/apply development migration
- `npm run db:migrate:deploy` - apply existing migrations in target environment
- `npm run db:push` - push schema without migrations
- `npm run db:seed` - seed starter people

## Vercel Deployment (Recommended)

1. Create free Postgres DB (Supabase or Neon).
2. In Vercel environment variables add:
   - `DATABASE_URL` (pooled Supabase URL)
   - `DIRECT_URL` (direct Supabase URL)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - optional `APP_PIN`
3. Import repo into Vercel and deploy.
4. Run migrations once from your local machine:
   - `npm run db:migrate:deploy`
5. Redeploy in Vercel after migrations succeed.

## PIN Auth (Documents)

- `POST /api/auth/pin` validates the PIN and sets `dm_auth=1` (httpOnly cookie, 7-day expiry).
- `POST /api/auth/logout` clears the auth cookie.
- `middleware.ts` protects:
  - `/documents`
  - `/api/documents/*`
- On unauthorized page access, users are redirected to `/pin?next=...`.

## Documents Uploads (Private)

- Files are uploaded from browser to a private Supabase bucket (`debag-docs`) and never stored in Postgres.
- Prisma stores only metadata (`storageBucket`, `storagePath`, filename, mime type, size, notes/tags).
- Open action calls signed URL route:
  - `GET /api/documents/:id/signed-url` (5-minute URL)
- Delete action removes both storage object and DB row.

## API Runtime Note

All Prisma API route handlers explicitly use Node runtime:

```ts
export const runtime = "nodejs";
```

This avoids Prisma issues on Edge runtime.

## API Endpoints

- `GET /api/people`
- `POST /api/people`
- `POST /api/auth/pin`
- `POST /api/auth/logout`
- `GET /api/documents?query=&type=&sort=`
- `POST /api/documents`
- `PATCH /api/documents/:id`
- `DELETE /api/documents/:id`
- `GET /api/documents/:id/signed-url`
- `GET /api/observations`
- `POST /api/observations`
- `DELETE /api/observations/:id`
- `GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/observations/export?start=YYYY-MM-DD&end=YYYY-MM-DD`

## CSV Export

```bash
curl "http://localhost:3000/api/observations/export?start=2026-02-01&end=2026-02-16" -o debags.csv
```

With PIN:

```bash
curl -H "x-app-pin: 1234" "http://localhost:3000/api/observations/export?start=2026-02-01&end=2026-02-16" -o debags.csv
```
