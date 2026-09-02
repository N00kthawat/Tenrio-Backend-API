# Tenrio Backend API

Initial NestJS-based backend API skeleton for Tenrio.

## Requirements

- Node.js 22+
- npm 11+
- PostgreSQL

## Configuration

Create a local `.env` file from `.env.example` and set `DATABASE_URL` for your
PostgreSQL database. Do not commit the `.env` file.

```bash
cp .env.example .env
```

## Run

```bash
npm install
npm run start:dev
```

The API starts on `http://localhost:3000`.

## Endpoints

- `GET /v1/health`
- Swagger docs: `GET /v1/docs`

## Prisma

```bash
npx prisma validate
npx prisma generate
```

## Quality Checks

```bash
npm run lint
npm run typecheck
npm test
```
