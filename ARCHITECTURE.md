# React Application Architecture

This specification document outlines the frontend application structure, database synchronization pipelines, authentication flows, and general routing layout for the Walk Nepal Walk web application.

---

## 🏗️ System Overview & Core Stack

The application is structured as a robust, single-page application (SPA) optimized for client-side rendering and offline resiliency.

* **Frontend Framework:** React 18 with TypeScript and Vite.
* **Styling Engine:** Tailwind CSS utility classes.
* **Global Animations:** `motion/react` for elegant visual transitions.
* **Real-time Persistence:** Firebase Firestore.
* **Authentication:** Firebase Auth (Google & Email provider sign-ins).
* **Network & Cache Cache Layer:** Cloudflare Workers (separated into a Core Worker and a MapMiners Worker).

```
 ┌────────────────────────────────────────────────────────┐
 │                      REACT CLIENT                      │
 │                                                        │
 │  ┌──────────────────────────────────────────────────┐  │
 │  │                 Routing & Views                  │  │
 │  │  • Trek List (Home)  • Leaderboard   • Gallery   │  │
 │  │  • Booking Portal    • Admin Panel   • MapMiners │  │
 │  └────────────────────────┬─────────────────────────┘  │
 │                           │                            │
 │  ┌────────────────────────▼─────────────────────────┐  │
 │  │               State & Data Managers              │  │
 │  │  • Firebase Auth     • PWA & Offline Service     │  │
 │  │  • Firestore Syncs   • Cloudflare API Fetchers   │  │
 │  └──────────────────────────────────────────────────┘  │
 └──────────────┬───────────────────────────┬─────────────┘
                │                           │
                │ (Real-time Operations)    │ (Cache / Heavy Relational queries)
                ▼                           ▼
 ┌──────────────────────────┐   ┌──────────────────────────┐
 │    Firebase Firestore    │   │    Cloudflare Workers    │
 └──────────────────────────┘   └──────────────────────────┘
```

---

## 🧭 File and Directory Directory Layout

```
/
├── public/                 # Static asset definitions, icons, and PWA manifest
├── src/
│   ├── App.tsx             # Main entry router, firebase setup, and state orchestrator
│   ├── index.css           # Tailwind CSS imports and custom global utilities
│   ├── adminUtils.ts       # Unified hooks and permission helpers for administrator operations
│   ├── components/         # Highly modularized reusable UI components
│   │   ├── admin/          # Admin-only panels (analytics, itineraries, coordinator hub)
│   │   ├── mapminers/      # Interactive GPX trace creators, file parser widgets
│   │   └── [common]/       # Common dialogs, modals, registration forms, profile hubs
│   ├── context/            # Shared Context containers for application-wide modules
│   ├── data/               # Local default trek templates and offline fallbacks
│   ├── hooks/              # Custom hooks (e.g. offline detection, PWA installation state)
│   ├── lib/                # Static libraries and third-party wrappers
│   ├── screens/            # Main navigation-level components and dashboard views
│   ├── services/           # Data fetch service clients (Firestore queries & API proxies)
│   └── types/              # Domain-specific TypeScript declarations
```

---

## 🔄 Dual-Source Data Synchronization Flow

To ensure high performance and high availability, the app implements a **dual-source strategy** when pulling and rendering itineraries/treks:

1. **Phase 1: Cloudflare Worker Fetch (CDN Cached):** On initialization, the app sends a high-speed fetch to Cloudflare Worker edge routes to pre-populate treks and avoid direct database connections for anonymous users.
2. **Phase 2: Live Firestore Overwrites:** The app concurrently queries your **Firebase Firestore** collection.
3. **Phase 3: Deduplication & Merge:** When a duplicate key exists, **Firestore data always takes precedence** and overwrites the Cloudflare-cached version. This ensures that any edit or status publish in the Admin Panel is visible instantly on the homepage.

---

## 🔒 Authentication & Role-Based Access Control (RBAC)

* **Identity Provider:** Firebase Auth manages email/password registrations and secure OAuth integrations.
* **Role Check Routine:** The React router utilizes helper routines in `src/adminUtils.ts` to inspect user email properties.
* **Restricted Navigation:** High-privilege routes (like the Admin Panel) are structurally blocked if the user is not an authenticated administrator, preserving app security.

---

## 📶 Offline Resilience & PWA Service

The React client implements progressive offline-support mechanisms:
* **Service Worker Caching:** Asset caching stores static layout layers to load the interface in zero-network scenarios.
* **Storage Fallbacks:** When off-grid on trails, the application gracefully degrades by using local storage fallbacks, keeping cached itineraries interactive.
* **Network Indicator:** Displays an subtle header notification banner when the network drops to inform the user that live features are temporarily paused.
