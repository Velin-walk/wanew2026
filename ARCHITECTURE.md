# React Application Architecture — Walk Nepal Walk

This specification document outlines the complete architecture, data synchronization pipelines, dual-worker infrastructure, caching layers, and administration workflows for the Walk Nepal Walk web application.

> **CRITICAL RULE FOR AGENTS & DEVELOPERS:**
> Any structural, API, routing, or state synchronization changes made to this application **MUST be documented in this file immediately** to prevent architectural divergence and regression.

---

## 🏗️ System Overview & Core Stack

The application is structured as a resilient, single-page application (SPA) optimized for client-side rendering, offline trail availability, and zero-downtime persistence.

* **Frontend Framework:** React 18 with TypeScript and Vite.
* **Styling Engine:** Tailwind CSS utility classes with custom brand palette.
* **Global Animations:** `motion/react` for route and modal transitions.
* **Database Layer (Primary):** Cloudflare D1 (Serverless SQLite) via Cloudflare Workers.
* **Database Layer (Real-time/Sync):** Firebase Firestore (`ai-studio-wanewa-6770744b-b8a0-416a-8000-d84fd557a006`).
* **Storage Layer:** Cloudflare R2 object storage for heavy GPX/KML trails and compressed itinerary images.
* **Authentication:** Firebase Auth (Google OAuth & Email provider sign-ins).
* **Network & Edge Workers:** Strict two-worker separation on Cloudflare Workers.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              REACT CLIENT                               │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                          Routing & Views                          │  │
│  │  • Trek List (Home)       • Leaderboard        • Photo Gallery    │  │
│  │  • Itinerary Details      • Booking Portal     • Feedback System  │  │
│  │  • MapMiners Trails Hub   • Admin Dashboard    • Profile Manager  │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    │                                    │
│  ┌─────────────────────────────────▼─────────────────────────────────┐  │
│  │                  State, Sync & Persistence Hub                    │  │
│  │  • Local Cache (wnw_saved_itineraries_cache, wnw_cached_treks)    │  │
│  │  • Dual-Worker Routing Client (src/services/api.ts)               │  │
│  │  • Firebase Auth & Graceful Quota Firestore Synchronizer          │  │
│  │  • PWA Service Worker & Offline Trail Storage                     │  │
│  └──────────────────────┬────────────────────────────┬───────────────┘  │
└─────────────────────────┼────────────────────────────┼──────────────────┘
                          │ (Real-time sync /          │ (Zero-quota REST queries
                          │  Admin dual-write)         │  & GPX/KML R2 files)
                          ▼                            ▼
               ┌─────────────────────┐      ┌─────────────────────┐
               │ Firebase Firestore  │      │ Cloudflare Workers  │
               │ (Lightweight sync)  │      │ (Core & MapMiners)  │
               └─────────────────────┘      └─────────────────────┘
```

---

## ⚡ Cloudflare Workers Separation Architecture

To prevent route pollution and protect service reliability, the backend is split into **two distinct Cloudflare Workers**:

### 1. Core API Worker (`cloudflare/worker.js`)
* **Wrangler Config:** `cloudflare/wrangler.toml`
* **Production Domain:** `https://walk-nepal-walk-api.velinrai-vr.workers.dev`
* **Bindings:**
  * `DB`: Cloudflare D1 database (`walk-nepal-walk-db`)
  * `BUCKET`: Cloudflare R2 bucket (`walk-nepal-walk-storage`)
* **Responsibilities:**
  * `GET /treks`, `GET /treks/:id` — Public trek and itinerary listing
  * `POST /admin/itineraries`, `PUT /admin/itineraries/:id` — Itinerary creation, updates, and publishing
  * `GET /bookings`, `POST /bookings` — Registration and participant booking management
  * `GET /leaderboard`, `GET /reviews` — Community statistics, feedback, and user profiles
* **Deployment Command:**
  ```bash
  npx wrangler deploy --config cloudflare/wrangler.toml
  ```

### 2. MapMiners Worker (`cloudflare/mapminers-worker.js`)
* **Wrangler Config:** `cloudflare/wrangler-mapminers.toml`
* **Production Domain:** `https://walk-nepal-walk-mapminers.velinrai-vr.workers.dev`
* **Bindings:**
  * `DB`: Cloudflare D1 database (`walk-nepal-walk-db`)
  * `TRAILS_BUCKET`: Cloudflare R2 bucket (`walk-nepal-walk-trails`)
* **Responsibilities:**
  * `GET /mapminers/tracks`, `POST /mapminers/tracks` — GPS routes, GPX/KML upload and indexing
  * `GET /community_trails` — Crowdsourced trail directory
  * `GET /images/*` — Serving trail media and R2 public images
* **Deployment Command:**
  ```bash
  npx wrangler deploy --config cloudflare/wrangler-mapminers.toml
  ```

> **STRICT ARCHITECTURAL RULE:**
> Never deploy `mapminers-worker.js` to the Core API domain or merge the two worker files. The client proxy (`src/services/api.ts`) automatically routes requests based on URL prefix: paths starting with `mapminers`, `community_trails`, or `images` target the MapMiners Worker, while all other endpoints target the Core API Worker.

---

## 🔄 Multi-Tier Data Synchronization Flow (Trek Cards & Homepage)

To guarantee that published treks from the Admin Panel appear instantly on the homepage without flickering or missing data—even during network outages, Cloudflare redeployments, or Firebase free-quota limits—the application executes a 5-tier fallback cascade:

```
                  ┌─────────────────────────────────────────┐
                  │ 1. Local Admin Cache                    │
                  │ (wnw_saved_itineraries_cache)           │
                  │ Immediately captures freshly published  │
                  │ treks from Admin Panel on this device   │
                  └────────────────────┬────────────────────┘
                                       │
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │ 2. Cloudflare Core Worker (/treks)      │
                  │ D1 cached API payload (0 quota used)    │
                  └────────────────────┬────────────────────┘
                                       │ (if offline, 404, or 0 records)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │ 3. Live Firestore Read (treks)          │
                  │ Overwrites Cloudflare data if present;  │
                  │ catches 'resource-exhausted' gracefully │
                  └────────────────────┬────────────────────┘
                                       │ (if quota exhausted or empty)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │ 4. Cached Cloudflare Payload            │
                  │ (wnw_cached_cloudflare_treks)           │
                  └────────────────────┬────────────────────┘
                                       │ (if storage empty)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │ 5. Static Fallback Treks                │
                  │ (src/data/fallbackTreks.ts)             │
                  │ Future-dated sample events              │
                  └─────────────────────────────────────────┘
```

1. **Tier 1 (Admin Local Cache):** On boot and on refresh, `App.tsx` reads `wnw_saved_itineraries_cache` from `localStorage`. Any trek saved or published by the administrator is pre-loaded into the active memory map.
2. **Tier 2 (Cloudflare D1 Worker):** Sends a high-speed fetch to `GET /treks`. When valid records arrive, they are normalized and cached in `wnw_cached_cloudflare_treks`.
3. **Tier 3 (Firestore Live Sync):** If the administrator has toggled "Firebase Mode" in the Admin Panel or if Cloudflare returns zero records, Firestore's `treks` collection is queried. Any Firestore records take precedence. Quota errors (`resource-exhausted`) are handled gracefully without breaking the UI.
4. **Tier 4 (LocalStorage Cache):** If remote queries fail, previously cached Cloudflare results are retrieved.
5. **Tier 5 (Static Fallbacks):** `src/data/fallbackTreks.ts` provides safety defaults with upcoming dates so the homepage is never rendered blank.

---

## 📅 Date Parsing & Trek Categorization Engine

The homepage categorizes treks into **Upcoming Treks** and **Past Events Archive**:

* **Date Parsing (`parseTrekDate` in `src/screens/TrekListScreen.tsx`):**
  * Parses standard formats: `DD/MM/YYYY` (e.g. `24/10/2026`).
  * Parses ISO dates: `YYYY-MM-DD` (e.g. `2026-10-14`).
  * Parses English date strings: `Saturday 25 Oct 2026`.
  * Parses multi-day ranges: Extracts the start date from strings like `Wed 14 Oct – Sun 18 Oct 2026 (5 Days)`.
* **Zero-Blank-Screen Protection:**
  * Treks whose parsed date is today or in the future are placed in **Upcoming Treks**.
  * Treks with past dates are placed in **Past Events Archive**.
  * **Auto-Expand Safeguard:** If there are 0 upcoming treks, the past events archive automatically expands and displays as *"Recent & Completed Events"*, ensuring newly published treks with past or immediate dates are never hidden behind a collapsed accordion.

---

## 🛠️ Admin Panel Itinerary Publishing Pipeline

When an administrator edits, clones, or publishes an itinerary in `src/components/admin/ItineraryBuilder.tsx`:

1. **Dual-Write Execution:**
   * Sends `POST /admin/itineraries` or `PUT /admin/itineraries/:id` to Cloudflare Core Worker (persisted to D1).
   * Writes the document to Firestore: `setDoc(doc(db, 'treks', recordId), trekData)`.
2. **Local Cache Synchronization:**
   * Immediately updates `wnw_saved_itineraries_cache` with the latest record and deduplicates by `id` and `hike_number`.
3. **Reactive Broadcast:**
   * Dispatches the custom browser event `wnw-treks-updated`.
   * `App.tsx` listens for this event and triggers an immediate refresh (`refreshData({ force: true })`), rendering changes on the homepage without requiring a page reload.

---

## 🧭 File and Directory Layout

```
/
├── cloudflare/
│   ├── worker.js                     # Core API Worker (treks, admin itineraries, bookings, D1/R2)
│   ├── wrangler.toml                 # Core Worker configuration & bindings
│   ├── mapminers-worker.js           # MapMiners Worker (GPX/KML routes, R2 trails)
│   ├── wrangler-mapminers.toml       # MapMiners Worker configuration & bindings
│   ├── schema.sql                    # Cloudflare D1 SQL table definitions
│   └── MAPMINERS_ARCHITECTURE.md     # MapMiners GPS/R2 subsystem documentation
├── public/                           # Static assets, icons, and PWA manifest
├── src/
│   ├── App.tsx                       # Main router, dual-source data pipeline & state hub
│   ├── adminUtils.ts                 # Admin role and email permission checkers
│   ├── components/
│   │   ├── admin/                    # Admin dashboard, ItineraryBuilder, registration managers
│   │   ├── mapminers/                # MapMiners interactive map, GPX parser, trail cards
│   │   └── [common]/                 # Navbar, TrekCard, modals, registration forms
│   ├── data/
│   │   ├── defaultItineraryTemplate.ts # Template definitions and date range formatters
│   │   └── fallbackTreks.ts          # Static sample treks with future dates
│   ├── screens/
│   │   ├── TrekListScreen.tsx        # Homepage trek card grid and past events archive
│   │   ├── ItineraryDetailScreen.tsx # Full public itinerary view
│   │   └── MapMinersScreen.tsx       # MapMiners trail discovery view
│   ├── services/
│   │   └── api.ts                    # Intelligent API client routing to Core vs MapMiners workers
│   └── types/                        # Core TypeScript domain models (Trek, Booking, User)
```

---

## 🔒 Authentication & Role-Based Access Control (RBAC)

* **Identity Provider:** Firebase Auth manages email/password registrations and Google OAuth.
* **Admin Verification:** `src/adminUtils.ts` validates administrator status against configured emails (including `walknepalwalk@gmail.com`).
* **Route Protection:** Administrative screens and dangerous actions (such as deleting treks or overriding data sources) are restricted to authenticated admins.

---

## 📶 Offline Resilience & PWA Service

* **Service Worker Caching:** Static application assets are cached for offline trail usage.
* **Storage Persistence:** Offline registrations and trail favoriting operate on `localStorage` queues that sync when network connectivity is restored.
* **Graceful Degradation:** When offline, the app transparently serves cached Cloudflare payloads and local itinerary templates.
