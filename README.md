# Mobile Shop POS Backend

Express 5, TypeScript, MySQL, and Drizzle ORM backend foundation for a Mobile Phone Shop POS and Repair Management System.

## Requirements

- Node.js 24 or newer
- Docker and Docker Compose
- MySQL 8 when running outside Docker

## Setup

```bash
cp .env.example .env
npm install
```

## Local MySQL

Use this setup when MySQL is installed on your computer and managed through MySQL Workbench.

1. Open MySQL Workbench and connect to your local MySQL server.
2. Run this SQL to create the development database:

```sql
CREATE DATABASE IF NOT EXISTS mobee_pos;
```

3. Make sure `.env` contains your local MySQL connection settings:

```bash
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=mobee_pos
DB_PORT=3306
```

If you prefer a separate app user instead of `root`, create one in Workbench and use that username/password in `.env`.

The backend uses those values to create a `mysql2` connection pool. You can also keep `DATABASE_URL` in `.env` for Drizzle CLI commands:

```bash
DATABASE_URL=mysql://root:your_local_mysql_password@localhost:3306/mobee_pos
```

Use your own local MySQL username, password, and database name if they are different.

## Development

Start the API locally:

```bash
npm run dev
```

Start the API and MySQL through Docker Compose:

```bash
npm run docker:up
```

When the API runs inside Docker and MySQL runs on your computer, use `host.docker.internal` instead of `localhost` in the container environment:

```bash
DB_HOST=host.docker.internal
DATABASE_URL=mysql://mobile_shop_user:mobile_shop_password@host.docker.internal:3306/mobile_shop_pos
```

View API logs:

```bash
npm run docker:logs
```

Stop Docker services:

```bash
npm run docker:down
```

## Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Expected response shape:

```json
{
  "success": true,
  "message": "Mobile Shop POS API is healthy.",
  "data": {
    "application": "mobile-shop-pos-backend",
    "status": "operational",
    "database": "connected",
    "environment": "development",
    "uptimeSeconds": 10,
    "timestamp": "2026-07-17T00:00:00.000Z"
  }
}
```

## Scripts

- `npm run dev` starts the development server with `tsx watch`.
- `npm run build` compiles TypeScript to `dist`.
- `npm start` runs the compiled server.
- `npm run typecheck` checks TypeScript without emitting files.
- `npm run db:generate` generates Drizzle migrations.
- `npm run db:migrate` creates `src/db/manual-migration.sql` from generated SQL files.
- `npm run db:sql` does the same thing as `db:migrate`.
- `npm run db:push` pushes schema changes to the database.
- `npm run db:studio` opens Drizzle Studio.

## Manual SQL Migration

This project does not automatically run migrations when you use `npm run db:migrate`. Instead, it creates one SQL file that you can review and copy into MySQL Workbench.

```bash
npm run db:generate
npm run db:migrate
```

Then open:

```bash
src/db/manual-migration.sql
```

Copy the SQL from that file and paste it into MySQL Workbench when you are ready to update the database.

Database schemas are defined under `src/db/schema`, grouped by POS business module.

## Production deployment

The GitHub Actions CI/CD and Hostinger VPS setup are documented in [`docs/PRODUCTION_DEPLOYMENT.md`](docs/PRODUCTION_DEPLOYMENT.md).
