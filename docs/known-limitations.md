# Known Limitations — NizamKitchen Beta

This document records known limitations, placeholders, and intentional design trade-offs in the current beta release. These are not bugs; they are deliberate decisions or deferred features.

---

## Mapping & restaurant discovery

### MapTiler does not provide Google Maps-style data

NizamKitchen uses **MapTiler** for restaurant geo-search in the "Order Instead" section.
MapTiler is a tile provider and geocoder — it does **not** supply:

- Business ratings or review scores
- Opening hours
- Phone numbers or websites
- Photos

The `RestaurantFallbackSearch` results show restaurant names, addresses, and map positions.
Ratings and hours must be added manually via the "saved restaurants" feature if needed.

**Workaround:** Households can bookmark restaurants and add notes manually. Google Maps
integration is not planned (cost and privacy reasons).

---

## YouTube video discovery

### Requires a YouTube Data API v3 key

The admin YouTube Discovery tool (`/admin/youtube-discovery`) calls the YouTube Data API.
Without a valid `YOUTUBE_API_KEY` environment variable, the discovery search is disabled.

Existing video references on recipes continue to work (they are stored in the database and
embed the YouTube player directly — no API key needed for playback).

**Quota:** The free YouTube API tier allows 10,000 units/day. A single search costs ~100 units.

---

## Payments and billing

### Stripe integration is a placeholder

Billing plan pages (`/billing`, `/billing/plans`) are fully built but Stripe payment
processing is not wired up. The `BillingSubscription` model tracks plan assignments
manually via the admin panel.

**What works:**
- Plan creation and management in the admin panel
- Subscription assignment to organisations (manual, by admins)
- Plan limits enforcement in code
- Usage record creation

**What does not work:**
- Stripe checkout or payment processing
- Automatic subscription upgrades/downgrades
- Webhook handling for payment events
- Invoicing

**Timeline:** Stripe integration is planned post-beta based on actual payment demand.

---

## Grocery partner checkout

### Grocery export is placeholder

The `GroceryPartner` model and grocery partner pages exist in the admin panel, but the
actual checkout integration with external grocery retailers is not implemented.

**What works:**
- CSV export of grocery lists
- Shareable public grocery list links
- Manual shopping preference notes

**What does not work:**
- One-click cart population at a partner grocery website
- Real-time stock or price data from partners

---

## Chef verification

### Manual review process only

The chef verification workflow (`/admin/chef-verifications`) accepts document uploads
and status updates, but there is no automated identity verification integration.

All chef verifications must be reviewed and approved manually by a platform admin.

**Verification statuses:** `pending` → `in_review` → `verified` / `rejected`

---

## AI video analysis

**AI video analysis has been intentionally removed and will not be re-added.**

An earlier version of the platform included AI-powered video content analysis.
This feature was removed due to:
- Cost unpredictability at scale
- Accuracy concerns with culinary content
- Privacy implications of automated media analysis

YouTube video references on recipes are managed manually by platform admins via
the YouTube Discovery tool.

---

## Restaurant workspace

The restaurant partner workspace (`/restaurant`) is a placeholder.
Restaurant organisations can log in, but full order management and menu tools
are not implemented in this beta.

---

## Email delivery

### SMTP is optional; no fallback queue

Transactional email (notifications, account events) requires an SMTP server.
If `SMTP_HOST` is not set, emails are silently dropped — they are not queued for
later delivery.

All notification events are still stored in the database and visible in the
in-app notification inbox (`/notifications`).

---

## Multi-tenancy edge cases

- An organisation can only be assigned to one country at registration. Country changes
  require a platform admin to update records directly.
- Household members must be invited — there is no self-service invitation link yet.
- Organisation deletion is not supported in the UI; contact a platform admin.
