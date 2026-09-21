# MapMiners & `mapminers-worker.js` Architecture Specification

> **CRITICAL ARCHITECTURAL DIRECTIVE FOR FUTURE AGENTS / EDITS:**
> Before making any edits to MapMiners components (`src/components/mapminers/*`), routing in `src/services/api.ts`, database schemas in `cloudflare/schema.sql`, or Cloudflare Worker endpoints in `cloudflare/mapminers-worker.js`:
> **You MUST review this document to preserve the contracts, R2 binary paths, D1 tables, route paths, and caching policies.**

---

## 1. System Overview & Service Boundaries

MapMiners is the dedicated geospatial routing and community crowdsourcing module of **Walk Nepal Walk**. It handles:
- Uploading, storing, parsing, and rendering GPS map tracks (KML and GPX formats).
- Community trail submissions, moderation workflow (pending / approved / rejected).
- Direct file streaming from Cloudflare R2 object storage.
- Elevation profiling, route metrics (distance, ascent, descent, time estimates).
- Live interactive trail comments decoupled from Firestore quota constraints.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             React Client (Vite)                             │
│       src/components/mapminers/MapMinersDashboard.tsx                       │
│       src/components/mapminers/RouteDetail.tsx                              │
│       src/components/mapminers/kmlParser.ts                                 │
│       src/services/api.ts (apiUrl & apiFetch)                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       │ HTTPS REST Calls
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│              MapMiners Cloudflare Worker (`mapminers-worker.js`)             │
│              URL: https://walk-nepal-walk-mapminers-api.velinrai-vr.workers.dev
│              Config: cloudflare/wrangler-mapminers.toml                     │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
                       ▼ D1 SQL Bind (`env.DB`)        ▼ R2 Storage (`env.TRAILS_BUCKET`)
        ┌───────────────────────────────┐     ┌───────────────────────────────┐
        │     Cloudflare D1 Database    │     │      Cloudflare R2 Bucket     │
        │     Database: walk_nepal_walk │     │   Bucket: mapminers-trails    │
        │     Tables:                   │     │   Keys:                       │
        │     - `community_trails`      │     │   - `kml/<fileName>`          │
        │     - `trail_comments`        │     │   - `images/<fileName>`       │
        └───────────────────────────────┘     └───────────────────────────────┘
```

---

## 2. Worker Configuration (`wrangler-mapminers.toml`)

* **Worker Name:** `walk-nepal-walk-mapminers-api`
* **Entry Point:** `cloudflare/mapminers-worker.js`
* **Bindings:**
  * `env.DB` → Cloudflare D1 Database binding (Target database: `walk_nepal_walk_db` / `walk-nepal-walk-db`)
  * `env.TRAILS_BUCKET` (or fallback `env.BUCKET`) → Cloudflare R2 Bucket binding (`mapminers-trails` / `walk-nepal-walk-trails`)

---

## 3. Worker API Endpoints & Route Contracts

All endpoints normalize leading and duplicate slashes (`path.replace(/\/+/g, '/')`) and support both `/mapminers/*` prefixed and root paths for maximum compatibility.

### 3.1 Trails & Geodata
| Method | Endpoint Routes | Purpose | Storage Target |
|---|---|---|---|
| `GET` | `/mapminers/trails`<br>`/community_trails`<br>`/trails` | List all trails with metadata, distance, elevation, bounds, status. Edge-cached with `?fresh` bypass. | D1 (`community_trails`) |
| `POST` | `/mapminers/upload`<br>`/community_trails/upload`<br>`/upload` | Upload new trail. Streams XML text directly to R2 under `kml/${fileName}` and indexes parsed route metrics into D1. | R2 + D1 |
| `GET` | `/mapminers/download/:fileName`<br>`/community_trails/download/:fileName`<br>`/download/:fileName` | Streams raw KML/GPX file content from R2 to client with `Content-Type: application/vnd.google-earth.kml+xml; charset=utf-8`. | R2 (`kml/:fileName`) |
| `PATCH`| `/mapminers/trails/:id`<br>`/community_trails/:id` | Moderation update: Approve or reject community trail submission. | D1 (`community_trails`) |
| `DELETE`| `/mapminers/trails/:id`<br>`/community_trails/:id` | Deletes trail metadata row from D1 AND purges file object from R2. | D1 + R2 |

### 3.2 Trail Comments (D1 Resilient)
| Method | Endpoint Routes | Purpose | Storage Target |
|---|---|---|---|
| `GET` | `/mapminers/comments?trailId=:id` | Fetch comments for a specific trail. Ordered chronologically. | D1 (`trail_comments`) |
| `POST` | `/mapminers/comments` | Post a new comment (`id`, `trailId`, `text`, `authorName`, `authorEmail`, `guestSessionId`, `timestamp`). | D1 (`trail_comments`) |
| `DELETE`| `/mapminers/comments/:id` | Delete a comment by its unique ID. | D1 (`trail_comments`) |

### 3.3 Static Assets
| Method | Endpoint Routes | Purpose | Storage Target |
|---|---|---|---|
| `GET` | `/images/:fileName` | Serve uploaded images directly from R2 with appropriate image `Content-Type` and 1-year cache headers. | R2 |

---

## 4. D1 Database Schema Contracts

### Table: `community_trails`
```sql
CREATE TABLE IF NOT EXISTS community_trails (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  difficulty TEXT CHECK(difficulty IN ('Easy', 'Moderate', 'Challenging', 'Strenuous')),
  distance REAL,
  elevation_gain REAL,
  elevation_loss REAL,
  min_elevation REAL,
  max_elevation REAL,
  estimated_hours REAL,
  province TEXT,
  district TEXT,
  nearby_city TEXT,
  highlights TEXT,
  contributor_name TEXT,
  contributor_email TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'approved' CHECK(status IN ('pending', 'approved', 'rejected')),
  bounds_json TEXT,       -- [[minLat, minLng], [maxLat, maxLng]]
  start_pos_json TEXT,     -- {"lat": 27.7, "lng": 85.3}
  file_size INTEGER DEFAULT 0
);
```

### Table: `trail_comments`
```sql
CREATE TABLE IF NOT EXISTS trail_comments (
  id TEXT PRIMARY KEY,
  trail_id TEXT NOT NULL,
  text TEXT NOT NULL,
  author_name TEXT,
  author_email TEXT,
  guest_session_id TEXT,
  timestamp INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_trail_comments_trail_id ON trail_comments (trail_id);
```

---

## 5. Client Integration Rules (`src/`)

### Rule 1: Multi-Worker Route Resolution in `src/services/api.ts`
`apiUrl(path)` and `apiFetch(path)` check whether the path belongs to MapMiners:
```typescript
const isMapMinersPath = cleanPath.startsWith("mapminers") || 
                        cleanPath.startsWith("community_trails") || 
                        cleanPath.startsWith("images");
const baseUrl = isMapMinersPath ? MAPMINERS_WORKER_URL : CLOUDFLARE_WORKER_URL;
```
* **Base URL Normalization:** Always strip trailing slashes from `MAPMINERS_WORKER_URL`.
* **Path Sanitization:** Replace `^\/+` and collapse `/\/+/g` to a single `/`.

### Rule 2: Dual KML/GPX Parsing (`src/components/mapminers/kmlParser.ts`)
* Always use `parseRouteFile(fileText, fileName, nameOverride)`.
* It detects whether the file contains GPX tags (`<trkpt>`, `<rtept>`, `<gpx>`) or KML tags (`<coordinates>`, `<LineString>`) regardless of file extension mismatches.
* Never assume the file extension reflects the internal XML markup.

### Rule 3: Zero-Cost Quota Resiliency (No Heavy Payloads in Firestore)
* **Map XML Files:** **NEVER** save raw KML/GPX text payloads or multi-megabyte coordinate arrays into Firestore documents. All files MUST go to Cloudflare R2 through the Worker.
* **Trail Comments:** Comments query the Cloudflare Worker D1 endpoint first and cache locally in `localStorage`. Firestore listeners must be lazy-loaded (only when the Comments tab is active) and wrap `resource-exhausted` / `quota` errors gracefully without crashing the UI.

---

## 6. Pre-Edit Verification Checklist

Before deploying or submitting modifications to MapMiners:
1. [ ] Check that `apiFetch` calls use normalized paths without leading double slashes.
2. [ ] Verify that new trail uploads send the payload to `mapminers/upload`.
3. [ ] Confirm that `mapminers-worker.js` handles CORS preflight (`OPTIONS`) with status `204`.
4. [ ] Ensure both snake_case and camelCase attributes are mapped for compatibility between D1 rows and React components.
5. [ ] Run `npm run lint` (`tsc --noEmit`) to verify zero type mismatches across MapMiners components.
