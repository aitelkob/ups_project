# DeBag Metrics

Production-style local web app for collecting time-and-motion observations on UPS DeBag workers.

## Stack

- Next.js (App Router, TypeScript)
- SQLite
- Prisma ORM
- Tailwind CSS

## Features

- Single-page mobile-friendly data entry form
- Quick-add Person modal
- Server-side validation for people and observations
- Today log table (latest 50 observations) with filter chips
- Delete observation with confirmation
- Reports section for date-range analytics
- CSV export for observation data
- Optional PIN gate (`APP_PIN`) for simple local protection

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
│   │   └── debag-metrics-app.tsx
│   └── lib/
│       ├── auth.ts
│       ├── prisma.ts
│       └── validation.ts
├── .env.example
├── package.json
└── README.md
```

## Setup Commands

From the `ups_project` folder:

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open: `http://localhost:3000`

## Environment Variables

Use `.env`:

```env
DATABASE_URL="file:./dev.db"
APP_PIN=""
```

- `DATABASE_URL`: SQLite database path (stored at `prisma/dev.db`)
- `APP_PIN`: Optional PIN. If set, UI prompts for PIN and API expects `x-app-pin`.

## Database Notes

- Prisma schema: `prisma/schema.prisma`
- SQLite file: `prisma/dev.db`
- Migration files: `prisma/migrations/*`

## Scripts

- `npm run dev` - start Next.js dev server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - run ESLint
- `npm run db:generate` - generate Prisma client
- `npm run db:migrate` - run/create local migrations
- `npm run db:push` - push schema without migration
- `npm run db:seed` - seed starter people

## API Endpoints

- `GET /api/people`
- `POST /api/people`
- `GET /api/observations`
- `POST /api/observations`
- `DELETE /api/observations/:id`
- `GET /api/reports?start=YYYY-MM-DD&end=YYYY-MM-DD`
- `GET /api/observations/export?start=YYYY-MM-DD&end=YYYY-MM-DD`

## CSV Export

Use the "Export CSV" button in Reports, or call:

```bash
curl "http://localhost:3000/api/observations/export?start=2026-02-01&end=2026-02-16" -o debags.csv
```

If `APP_PIN` is set:

```bash
curl -H "x-app-pin: 1234" "http://localhost:3000/api/observations/export?start=2026-02-01&end=2026-02-16" -o debags.csv
```
