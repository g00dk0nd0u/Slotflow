# Slotflow Architecture

## Goal

Slotflow is a lightweight appointment scheduling system for small businesses. The first target is **one owner / one location**, while keeping the domain generic enough for salons, studios, clinics, lessons, consulting, repair services, and other appointment-based businesses.

The product is Japan-first: **Google Calendar for the owner's operational schedule, Android tablet for instant visibility, and LINE for the customer entry point.**

## Product principles

1. **Startup is a feature.** The owner should glance at a dedicated Android tablet and immediately see the next booking; opening/navigating an app should not be part of routine operation.
2. **Use familiar tools.** Manual appointments created directly in Google Calendar (including by Google/Gemini voice interaction) must coexist with Slotflow bookings.
3. **Correctness before convenience.** Never confirm two customers into the same slot, and never hide partial failures.
4. **Single owner / single location first.** Do not pay multi-tenant or franchise complexity before the first-store workflow is proven.
5. **Generic scheduling domain.** Service names, durations and buffers are configuration, not salon-specific code.
6. **Near-zero-cost pilot where practical.** GitHub Pages + Google Apps Script + Google Sheets are acceptable for the pilot, but security requirements can override the zero-cost preference.
7. **Reference repositories are patterns, not dependencies.** Every adopted behavior must have a Slotflow regression test.

## Responsibility model

Slotflow deliberately avoids claiming that one store is the source of truth for every concern.

### Google Calendar — operational occupancy authority

Google Calendar determines whether the owner is busy. This includes:

- Slotflow-created appointments
- appointments/events entered manually by the owner
- events created through Google/Gemini voice workflows
- configured conflict calendars
- store-closure/all-day busy events according to Slotflow rules

A manual Calendar event does **not** need a Slotflow ledger row to block a customer slot.

### Slotflow ledger — transaction/lifecycle authority

Google Sheets is the MVP ledger for Slotflow-originated booking metadata:

- booking/idempotency key
- booking state
- Calendar event ID
- service/duration
- customer identity/contact references
- created/updated timestamps
- cancellation/reschedule links/tokens where used
- recovery/error state

The ledger exists to close Calendar read-after-write gaps, make retries idempotent, and recover from partial failures. It is not a replacement calendar.

### Business hours — base availability

Bookable time starts from configured weekly business hours and exceptions. Busy Calendar intervals are subtracted from those hours.

Slotflow does **not** require owners to create specially named "availability events" in Google Calendar.

Availability is the configured bookable window minus required Calendar occupancy and minus
every active or uncertain ledger interval. The latter prevents propagation lag or a partial
mutation from reopening possibly occupied time. Calendar owns occupancy; the ledger owns
Slotflow identity, lifecycle, idempotency and recovery facts.

## Booking transaction model

The authoritative transaction and state-machine contract is
[`BOOKING_STATE_MODEL.md`](BOOKING_STATE_MODEL.md). Its create pattern is:

```text
request
  -> validate input / idempotency key
  -> acquire booking lock
  -> check active/uncertain ledger conflicts
  -> read Calendar occupancy
  -> if free, write pending ledger state
  -> create Calendar event
  -> mark ledger confirmed
  -> release lock
```

Any failure after a mutation must leave an explicit recoverable state. Silent semantic fallback is not acceptable.

Cancellation and rescheduling must follow the same principle: a Calendar failure must not be reported as a clean success simply because the ledger changed.

The lifecycle states are `create_pending`, `confirmed`, `cancel_pending`,
`reschedule_pending`, `cancelled`, `failed` and `recovery_needed`. Reschedule patches the
exact existing tagged event in place and returns to `confirmed`; `rescheduled` is an audit/API
outcome. A single store mutation lock covers idempotency re-check through Calendar mutation
and ledger finalization. Notifications occur outside it.

## Time model

- Store timezone is explicit IANA timezone configuration (`Asia/Tokyo` for the first pilot).
- Internal API timestamps are unambiguous ISO 8601 instants.
- Device timezone must not silently change store scheduling behavior.
- All-day busy events are treated as a product decision, not automatically ignored.
- Tests cover DST-capable zones even if the first store is in Japan.

## Runtime architecture — pilot

```text
Customer
  |
  +-- LINE Official Account rich menu / link
  |          |
  |          +-- optional LIFF context
  |
  +-- normal mobile browser
             |
             v
      GitHub Pages / static web UI
             |
             v
      Google Apps Script API
          |             |
          |             +-- Google Sheets ledger
          |
          +---------------- Google Calendar

Store owner
  |
  +-- dedicated Android tablet PWA (always-ready dashboard)
  |
  +-- Google Calendar / optional Gemini voice entry
```

## LINE integration boundary

The first LINE integration does **not** require a webhook: a LINE rich menu can link directly to the booking page/LIFF entry point.

Conversational Messaging API automation is a later concern. LINE requires validating the raw request body against the `x-line-signature` request header before processing webhook events. Apps Script web-app `doPost(e)` does not expose arbitrary request headers in its documented event object, so GAS must not be treated as the direct trusted terminus for a secure LINE Messaging API webhook. Issue #9 evaluates a minimal header-capable edge endpoint if chat automation becomes necessary.

## Owner dashboard

The Android PWA must optimize for glanceability and resume behavior rather than application navigation.

First view:

- current date/time
- **next appointment**
- today's appointments
- free gaps / next available slot

The last successful schedule should be cached for immediate first paint, then refreshed in the background. Stale/offline state must be obvious.

## Deployment stages

### Stage A — first-store / OSS pilot

Developer-assisted configuration is acceptable to validate the workflow cheaply.

### Stage B — managed service

A non-technical store owner should only need to sign in with their Google account, grant the minimum required Calendar permission, and select a calendar. They should not create OAuth credentials, deploy Apps Script, edit Script Properties, or manage API secrets. This requires a separate productization decision (#10), including Google OAuth verification and secure refresh-token storage.

## MVP scope

1. Reference audit and regression tests.
2. Booking state/consistency model.
3. Google Calendar + ledger core with create/cancel/reschedule.
4. Instant-access Android owner dashboard.
5. Generic customer web booking flow.
6. LINE entry point without a mandatory webhook.
7. First-store hardening/pilot.

## Explicit non-goals for the first release

- telephone integration
- multi-location/franchise management
- multi-staff resource scheduling unless later proven necessary
- POS, payment, inventory, payroll, or broad CRM
- conversational LINE bot infrastructure before it is needed
- Instagram integration before the LINE/customer booking path is proven
