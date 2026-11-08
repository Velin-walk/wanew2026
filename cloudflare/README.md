# Cloudflare Worker & D1 Setup for Walk Nepal Walk & MapMiners

This directory contains the Cloudflare Worker script, D1 database schema, and Wrangler deployment configuration for Walk Nepal Walk.

## 1. Quick One-Command Deployment

Run the following command from the project root:

```bash
npx wrangler deploy --config cloudflare/wrangler.toml
```

## 2. Setting Up D1 Database & R2 Storage (Optional)

1. Create a D1 database:
   ```bash
   npx wrangler d1 create walknepalwalk-db
   ```
   Copy the `database_id` into `cloudflare/wrangler.toml`.

2. Initialize the SQL database schema:
   ```bash
   npx wrangler d1 execute walknepalwalk-db --file=cloudflare/schema.sql
   ```

3. Create the R2 Bucket for MapMiners GPX/KML file storage:
   ```bash
   npx wrangler r2 bucket create mapminers-trails
   ```

## 3. Environment Variable Configuration

In your AI Studio workspace `.env` file (or platform environment settings):

```env
CLOUDFLARE_WORKER_URL=https://walknepalwalk-api.velinrai-vr.workers.dev
```

When `CLOUDFLARE_WORKER_URL` is set, the Express backend automatically proxies requests to your live Cloudflare Worker and syncs registrations, feedback, itineraries, and trail files. If Cloudflare is unreachable or missing data, the server automatically provides fallback local data so your app always functions smoothly!
