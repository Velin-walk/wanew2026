# Walk Nepal Walk — Admin Panel "How-To" Comprehensive Guide

Welcome to the official Administrator Guide for the **Walk Nepal Walk** platform. This guide outlines step-by-step instructions on how to use every feature within the Admin Panel to manage treks, bookings, rosters, media, reviews, notices, and guides.

---

## 1. Accessing the Admin Panel & Authentication

1. **Sign In**: Navigate to the platform and log in using an authorized administrator account (configured with admin privileges or super admin role in Firebase / Admin Access Manager).
2. **Accessing the Dashboard**: Once authenticated with admin permissions, click on the **Admin** tab or navigation link in the top/bottom menu to enter the **Admin Dashboard / Coordinator Hub**.

---

## 2. Managing Treks & Itineraries (Hike Library)

The **Hike Library** (`/components/admin/HikeLibraryList.tsx` & `ItineraryBuilder.tsx`) allows you to create, edit, duplicate, and publish treks.

### Creating a New Trek / Itinerary:
1. Go to **Admin Dashboard** -> **Hikes & Treks** -> Click **[ + Create New Hike ]**.
2. **Basic Identity**: Enter the Hike Title, Hike Number (e.g. `Hike #202`), Trail Category (e.g., Ridge Walk, Waterfall Trail, Himalayan Panorama), and upload/select a cover image.
3. **Schedule & Duration**: Set the trek date, meeting time, meeting location, and duration format (e.g., `3D 2N` or `1 Day`). Select difficulty level (Easy, Moderate, Challenging, Strenuous).
4. **Day-by-Day Itinerary & Elevation**: Add key highlights, elevation gain, and detailed daily milestones.
5. **Inclusions & Checklist**: Specify what is included (e.g., guide, transport, lunch) vs. excluded, and list recommended gear/clothing.
6. **Pricing & Capacity**: Set participant pricing (NPR), group discounts, and maximum participant capacity.
7. **Status**: Save as **Draft** (private), publish **Live** (visible on public feed), or mark as **Cancelled**.

---

## 3. Managing Bookings & Participant Rosters

The **Bookings Manager** (`/components/admin/BookingsManager.tsx`) handles all hiker registrations and event execution.

1. **Viewing Bookings**: Filter bookings by trek, status (Confirmed, Pending Payment, Waitlisted, Cancelled), or search by hiker name/phone.
2. **Verifying Payments**: Review payment screenshots or transaction records submitted by hikers. Update status from `Pending` to `Confirmed`.
3. **Emergency Contacts & Medical Notes**: Access emergency contact details, dietary requirements, and medical notes for safety compliance.
4. **On-Site Check-In & Roster Export**: On hike day, use the live attendance checklist to mark hikers present and export final rosters.

---

## 4. Homepage Hero Banner & Media Management

The **Homepage Hero Manager** (`/components/admin/HomepageHeroManager.tsx`) controls the high-impact visual banners on the landing page.

1. **Hero Slides**: Add, reorder, or remove 4K trail background banners.
2. **Rotation Settings**: Configure auto-rotation intervals (e.g., every 15 minutes).
3. **Engagement Metrics**: Monitor aggregate ratings, like counts, and visitor impressions directly from the manager.

---

## 5. Community Gallery & Photo Uploads

1. **Bulk Upload**: Upload official trek photographs tagged by Hike Number.
2. **Moderation**: Review hiker-submitted uploads in the community gallery, approve highlights, or delete inappropriate content.

---

## 6. Review & Feedback Hub

1. **Moderate Feedback**: Review star ratings and written feedback submitted by participants upon hike completion.
2. **Publishing**: Approve reviews to appear on public trek detail pages and aggregate rating badges.

---

## 7. Notice Board & Announcements

1. **Broadcasting Notices**: Use the **Notice Board Manager** to post urgent weather updates, trail advisories, or gear reminders that appear instantly across hiker dashboards.

---

## 8. Offers & Vouchers Management

1. **Promotions**: Create promotional discount codes, seasonal offers, and citizen pricing rules using the Offers Manager.

---

## 9. Coordinator Hub & Guides Management

1. **Team Assignment**: Assign certified mountain guides and coordinators to specific treks using the Guides Manager and Coordinator Hub.
2. **Internal Chat**: Coordinate logistics with team members through the internal coordinator messaging panel.

---

*Walk Nepal Walk Admin Operations Guide.*
