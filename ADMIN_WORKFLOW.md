# Walk Nepal Walk — Admin Panel Complete Workflow & Flowchart Guide

This document provides a single-file, end-to-end reference for administrators managing treks, itineraries, bookings, rosters, photo galleries, and reviews on the Walk Nepal Walk platform.

---

## 1. High-Level System Architecture & Flowchart

```
                          ┌──────────────────────────┐
                          │    ADMIN AUTHENTICATION  │
                          │  (Google / Email Login)  │
                          └─────────────┬────────────┘
                                        │
                                        ▼
                          ┌──────────────────────────┐
                          │    ROLE & ACCESS CHECK   │
                          │   (Super Admin / Admin)  │
                          └─────────────┬────────────┘
                                        │
                                        ▼
    ┌────────────────────────────────────────────────────────────────────────────────────────┐
    │                                  ADMIN DASHBOARD                                       │
    └────┬─────────────────┬──────────────────┬─────────────────┬─────────────────┬──────────┘
         │                 │                  │                 │                 │
         ▼                 ▼                  ▼                 ▼                 ▼
   ┌───────────┐     ┌───────────┐      ┌───────────┐     ┌───────────┐     ┌───────────┐
   │ 1. HIKES  │     │ 2. BUILDER│      │ 3. ROSTER │     │ 4. PHOTOS │     │ 5. REVIEWS│
   │  & TREKS  │     │ ITINERARY │      │ & BOOKINGS│     │ & HERO    │     │ & FEEDBACK│
   └───────────┘     └───────────┘      └───────────┘     └───────────┘     └───────────┘
```

---

## 2. Core Workflows & Detailed Flowcharts

### A. Hike Creation & Publishing Workflow (Itinerary Studio)

```
[ + Create New Hike ]
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Section 1: Basic Identity                                       │
│ • Title, Hike Number (e.g. Hike #202), Trail Category, Cover    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Section 2: Date, Duration & Difficulty                          │
│ • Date, Expected Trail Duration, Days (e.g., 3D 2N / 1 Day)     │
│ • Difficulty level (Easy, Moderate, Challenging, Strenuous)     │
│ • Meeting point & meeting time                                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Section 3: Route Description & Day-by-Day Schedule              │
│ • Key highlights & elevation profile                            │
│ • Hour-by-hour or Day-by-day milestone itinerary                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Section 4: Inclusions, Gear & Protocols                         │
│ • What is included vs. excluded (Meals, Guide, Transport)       │
│ • Recommended packing checklist & clothing gear                 │
│ • Safety protocols & trail rules / code of conduct              │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Section 5: Pricing, Capacity & Leader Assignment                │
│ • Price tiers (e.g. NPR 1500) & group discount rules            │
│ • Maximum participant capacity                                  │
│ • Assigned Team Leaders & Guides                                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Section 6: Status & Publishing Decision                         │
└───────┬────────────────────────┬────────────────────────┬───────┘
        │                        │                        │
        ▼                        ▼                        ▼
 ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
 │ SAVE DRAFT   │         │ PUBLISH LIVE │         │ MARK CANCEL  │
 │ • Private    │         │ • Public feed│         │ • Banner tag │
 │ • In-progress│         │ • Open seats │         │ • Pax alerts │
 └──────────────┘         └──────────────┘         └──────────────┘
```

---

### B. Participant Bookings & Attendance Lifecycle

```
[ Hiker Submits Booking on Trek Detail Page ]
                    │
                    ▼
[ Stored in Bookings & Rosters Database ]
                    │
                    ▼
        [ Admin Reviews Booking Entry ]
        ├── Contact phone & emergency contact
        ├── Medical notes / dietary preferences
        ├── Payment receipt verification
        └── Waiver signature status
                    │
                    ▼
     [ Set Booking Status in Dashboard ]
     ├── Confirmed (Seat allocated)
     ├── Pending Payment Verification
     ├── Waitlisted (When capacity reached)
     └── Cancelled / Refunded
                    │
                    ▼ (Hike Day)
     [ On-Site Attendance Check-in ]
     ├── Mark Present / Checked-in
     ├── Real-time Pax headcount
     └── Export Final Roster to CSV / PDF
```

---

### C. Homepage Hero Banner & Gallery Photo Management

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN MEDIA CENTER                       │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
  [ Homepage Hero Manager ]        [ Community Gallery Moderation ]
  • Upload 4K trail banners        • Browse albums grouped by Hike #
  • Auto-rotates every 15 mins     • View hiker-submitted uploads
  • Integrated heart like counter  • Delete / moderate inappropriate
  • Live aggregate rating badge    • Bulk upload official photos
```

---

### D. Community Reviews & Feedback Moderation

```
[ Hikers Complete Hike ] ──► [ Submit Star Rating & Review ]
                                         │
                                         ▼
                         [ Admin Feedback Moderation Tab ]
                                         │
                           ┌─────────────┴─────────────┐
                           ▼                           ▼
                    [ Approve Review ]          [ Flag / Hide ]
                    • Published on Trek page    • Hidden from public
                    • Updates average rating    • Kept for internal review
                    • Displayed on Hero banner
```

---

## 3. Quick Reference: Admin Capabilities Matrix

| Area | Admin Capabilities |
| :--- | :--- |
| **Treks Hub** | Create, duplicate, edit, archive, filter by status (Upcoming, Completed, Draft, Cancelled). |
| **Itinerary Builder** | Custom trail builder with **Days format (e.g. 3D 2N)**, gear lists, safety rules, FAQs. |
| **Bookings & Rosters** | Live capacity tracker, payment confirmation, on-site check-in attendance, CSV export. |
| **Hero Banner** | Set hero slides, manage 15-minute rotation intervals, view live like counts. |
| **Photo Gallery** | Organize photos by hike number, bulk upload with Cloudinary compression, moderate hiker uploads. |
| **Review Hub** | Moderate ratings, calculate automated averages, highlight verified hiker feedbacks. |

---
*Created for Walk Nepal Walk Administrators.*
