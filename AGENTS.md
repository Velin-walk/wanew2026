# AGENTS Instructions - Walk Nepal Walk

## 1. Cloudflare Workers & MapMiners Architecture
Whenever working with MapMiners, trails, geodata, GPX/KML routes, trail comments, or Cloudflare Workers:
- **MANDATORY CHECK**: You MUST read `/cloudflare/MAPMINERS_ARCHITECTURE.md` before making changes to:
  - `src/components/mapminers/*`
  - `src/services/api.ts`
  - `cloudflare/mapminers-worker.js`
  - `cloudflare/wrangler-mapminers.toml`
  - `cloudflare/schema.sql`
- **NEVER** save large KML/GPX map tracks to Firestore documents (this exhausts Firestore quotas and violates the 1MB document limit). All map files must be uploaded to Cloudflare R2 and indexed in Cloudflare D1 via `mapminers-worker.js`.
- Always verify API paths in `src/services/api.ts` strip duplicate slashes to prevent 404 routing errors on Cloudflare Workers.
- Map files should be parsed with `parseRouteFile()` from `src/components/mapminers/kmlParser.ts` to transparently handle both GPX and KML format variations.

## 2. Firebase Database
- The user's Firestore database is `ai-studio-wanewa-6770744b-b8a0-416a-8000-d84fd557a006`.
- Treat Firestore as a lightweight metadata/sync service and always handle quota limits gracefully without unhandled console errors.

## 3. Architecture Documentation Protocol
- **MANDATORY**: Whenever any architectural, API, worker, database, or state synchronization change is made in this application, you MUST update `/ARCHITECTURE.md` to reflect the current codebase structure, data flow, and deployment instructions. This ensures future modifications remain coherent and prevents components from becoming entangled.
