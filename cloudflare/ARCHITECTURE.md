# Cloudflare Worker System Architecture (Multi-Worker Microservices)

This specification document outlines the edge-native, serverless multi-worker architecture for the Walk Nepal Walk backend. The system has been separated into two microservices to decouple MapMiners map creation pipelines from core application features.

---

## 🏗️ System Overview

The system is engineered using a decentralized, edge-first microservice architecture to provide sub-millisecond response times. It leverages Cloudflare’s infrastructure to minimize database overhead, compress heavy payloads, and serve precomputed content instantly.

```
                               ┌──────────────────────┐
                               │    React Frontend    │ (Vite Client Web App)
                               └──────────┬───────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    │ (HTTPS Secure API Routing)                │ (HTTPS MapMiners/Trails Route)
                    ▼                                           ▼
       ┌──────────────────────────┐                ┌──────────────────────────┐
       │   Core App Worker        │                │   MapMiners Worker       │
       │   (worker.js)            │                │   (mapminers-worker.js)  │
       └────┬─────────────────┬───┘                └────┬─────────────────┬───┘
            │                 │                         │                 │
            │ (D1 SQL Bind)   │ (R2 Storage API)        │ (D1 SQL Bind)   │ (R2 Storage API)
            ▼                 ▼                         ▼                 ▼
       ┌─────────┐       ┌─────────┐               ┌─────────┐       ┌─────────┐
       │ D1 SQL  │       │ R2 Blob │               │ D1 SQL  │       │ R2 Blob │
       │ Database│       │ Bucket  │               │ Database│       │ Bucket  │
       └─────────┘       └─────────┘               └─────────┘       └─────────┘
```

### 1. Core Worker Service (`worker.js`)
* **Endpoint Base:** `https://walk-nepal-walk-api.velinrai-vr.workers.dev/`
* **Responsibilities:** Handles master trek itineraries, event execution scheduling, attendee bookings, payments/reconciliation rosters, hacker profiles, real-time feedback reviews, shared photos and comments index, and admin activity audit trails.
* **Wrangler Configuration:** `/cloudflare/wrangler.toml`

### 2. MapMiners Worker Service (`mapminers-worker.js`)
* **Endpoint Base:** `https://walk-nepal-walk-mapminers-api.velinrai-vr.workers.dev/` (or custom sub-path routing)
* **Responsibilities:** Handles GPX/KML community map trail contributions, status approvals/rejections, file storage & downloads directly from the Cloudflare R2 bucket, and serves R2 uploaded images.
* **Wrangler Configuration:** `/cloudflare/wrangler-mapminers.toml`

---

## ⚡ Edge Performance Optimizations

To handle peak concurrent traffic and avoid relational bottlenecks, the Cloudflare Worker implements three principal optimizations:

### 1. Dual-Tier Caching System (Web Cache API)
* **Read-Heavy Endpoints:** General fetch endpoints (e.g., `GET /treks`, `GET /leaderboard`) leverage Cloudflare's native regional CDN cache via `caches.default.match()`.
* **Dynamic Cache Invalidation:** Write requests (`POST`, `PUT`, `DELETE`, `PATCH`) trigger immediate, explicit cache busts for affected query keys.
* **On-Demand Cache Bypass:** Admins can bypass cached states by passing explicit cache-busting keys or when requesting through authorized admin tokens.

### 2. Base64 Offloading & R2 Binary Pipelines
* **The Constraint:** Massive base64 string buffers embedded in JSON payloads degrade database row throughput and can trigger D1 payload limits.
* **The Solution:** The worker scans incoming request payloads for heavy base64 images. It automatically decodes them on the edge, streams the binary outputs to the **R2 storage bucket**, and swaps the base64 content with a high-speed, cached public R2 URL before committing the row to the database.

### 3. Precomputed System Snapshots
* **The Constraint:** Calculating real-time leaderboards, ranking points, distance tracking, and aggregated statistics over hundreds of hikers is database-expensive.
* **The Solution:** The worker implements a **Snapshot Pattern**. It pre-calculates, formats, and saves the complex leaderboard hierarchy into the `system_snapshots` table as a serialized JSON blob named `leaderboard_master`. Frontend requests retrieve this precomputed state in $O(1)$ constant time.

---

## 🗄️ Relational Database Schema (Cloudflare D1)

Your relational schema is optimized with indexes on highly searched columns (e.g., `hike_number`, `email`, `registration_id`).

### 1. `treks`
Stores master itineraries and custom trek configurations.
```sql
CREATE TABLE treks (
  hike_number TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  difficulty TEXT,
  duration_days INTEGER,
  elevation_gain_m INTEGER,
  gpx_file_url TEXT,
  status TEXT DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_json TEXT NOT NULL
);
```

### 2. `registrations`
Tracks user enrollments imported/synced from Google Sheets/Forms or web portals.
```sql
CREATE TABLE registrations (
  id TEXT PRIMARY KEY,
  trek_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT,
  email_address TEXT NOT NULL,
  whatsapp_number TEXT,
  blood_group TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relation TEXT,
  emergency_contact_phone TEXT,
  pax INTEGER DEFAULT 1,
  registration_date DATETIME,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. `bookings_roster`
Holds payment status, financial reconciliation, and coordinator records.
```sql
CREATE TABLE bookings_roster (
  registration_id TEXT PRIMARY KEY,
  trek_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  payment_status TEXT DEFAULT 'Pending',
  total_payable_npr REAL DEFAULT 0,
  paid_amount_npr REAL DEFAULT 0,
  due_amount_npr REAL DEFAULT 0,
  payment_history_json TEXT,
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(registration_id) REFERENCES registrations(id)
);
```

### 4. `event_executions`
Manages real-time execution parameters for scheduled or ongoing events.
```sql
CREATE TABLE event_executions (
  hike_number TEXT PRIMARY KEY,
  execution_status TEXT DEFAULT 'Scheduled',
  assigned_leader TEXT,
  current_participants_count INTEGER DEFAULT 0,
  max_capacity INTEGER DEFAULT 100,
  notes TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(hike_number) REFERENCES treks(hike_number)
);
```

### 5. `community_trails`
Contains coordinates, metadata, and visual maps generated by the MapMiners module.
```sql
CREATE TABLE community_trails (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  region TEXT,
  distance_km REAL,
  elevation_gain_m INTEGER,
  gpx_data TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  approved_status TEXT DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 6. `feedback`
Captures ratings and qualitative reviews following completed treks.
```sql
CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  hike_number TEXT,
  hiker_email TEXT NOT NULL,
  overall_rating INTEGER CHECK(overall_rating BETWEEN 1 AND 5),
  trail_rating INTEGER,
  leader_rating INTEGER,
  overall_feedback TEXT,
  suggestions TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(hike_number) REFERENCES treks(hike_number)
);
```

### 7. `trek_photos`
Acts as the central schema registry for all user-contributed photos.
```sql
CREATE TABLE trek_photos (
  id TEXT PRIMARY KEY,
  trek_id TEXT,
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by TEXT NOT NULL,
  uploader_name TEXT,
  likes_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 8. `photo_comments`
Enables social interactions and nested discussion threads on shared photos.
```sql
CREATE TABLE photo_comments (
  id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(photo_id) REFERENCES trek_photos(id)
);
```

### 9. `hiker_profiles`
Holds unified, aggregate historical accomplishments per hiker.
```sql
CREATE TABLE hiker_profiles (
  email TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT,
  total_hikes INTEGER DEFAULT 0,
  total_distance_km REAL DEFAULT 0,
  total_elevation_gain_m INTEGER DEFAULT 0,
  rank_title TEXT DEFAULT 'Beginner Explorer',
  badges_json TEXT,
  hikes_history_json TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 10. `system_snapshots`
Caches large structural datasets to relieve relational processing overhead.
```sql
CREATE TABLE system_snapshots (
  key TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 11. `admin_activity_logs`
Provides an unalterable history trail for administrative tasks.
```sql
CREATE TABLE admin_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Deployment Operations

Maintain the following deployment flows to safely push updates to the live worker and database schema:

### Pushing Worker Changes
When core `worker.js` is updated, deploy it directly to the edge using:
```bash
npx wrangler deploy --config cloudflare/wrangler.toml
```

When MapMiners `mapminers-worker.js` is updated, deploy it directly to the edge using:
```bash
npx wrangler deploy --config cloudflare/wrangler-mapminers.toml
```

### Running Database Migrations
To introduce a database schema change or provision new structures, execute migrations against the D1 production instance:
```bash
npx wrangler d1 execute walk_nepal_walk_db --file=cloudflare/schema.sql
```
