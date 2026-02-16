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
│   │   │   ├── observations/
│   │   │   │   ├── [id]/route.ts
│   │   │   │   ├── export/route.ts
│   │   │   │   └── route.ts
│   │   │   ├── people/route.ts
│   │   │   └── reports/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── debag-metrics-dashboard.tsx
│   └── lib/
│       ├── auth.ts
│       ├── prisma.ts
│       └── validation.ts
├── .env.example
├── package.json
└── README.md
```

## Environment Variables

Create `.env` from `.env.example`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
APP_PIN=""
```

- `DATABASE_URL`: Postgres connection string (Supabase/Neon)
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
- `npm run build` - production build (runs `prisma migrate deploy` on Vercel)
- `npm run start` - start production server
- `npm run lint` - lint code
- `npm run db:generate` - generate Prisma client
- `npm run db:migrate` - create/apply development migration
- `npm run db:push` - push schema without migrations
- `npm run db:seed` - seed starter people

## Vercel Deployment (Recommended)

1. Create free Postgres DB (Supabase or Neon).
2. Add `DATABASE_URL` and optional `APP_PIN` in Vercel project environment variables.
3. Import repo into Vercel and deploy.
4. Migrations are applied during Vercel builds via:
   - `if [ "$VERCEL" = "1" ]; then prisma migrate deploy; fi && prisma generate && next build`

## API Runtime Note

All Prisma API route handlers explicitly use Node runtime:

```ts
export const runtime = "nodejs";
```

This avoids Prisma issues on Edge runtime.

## API Endpoints

- `GET /api/people`
- `POST /api/people`
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
