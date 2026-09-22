# Slotflow Architecture

## North star

The store manager operates the schedule primarily in **Google Calendar**. Slotflow is a thin companion layer, not a replacement calendar or a second owner-side booking system.

The core product idea is intentionally simple:

1. Read Google Calendar.
2. Present the schedule clearly on a dedicated Android tablet.
3. Later, allow customers to create appointments from Web/LINE by writing them into Google Calendar.

## Owner workflow

Normal store operations stay in Google Calendar:

- create an appointment
- move an appointment
- delete/cancel an appointment
- block time
- add an all-day closure
- use ordinary Google/Gemini voice workflows

Slotflow does not require the manager to repeat those actions elsewhere.

When a Calendar event changes, Slotflow should reflect the new Calendar state on the next refresh.

## Source of truth

### Google Calendar — operational schedule

Google Calendar is the operational source of truth for the store schedule.

This includes:

- appointments entered by the manager
- events created through Google/Gemini
- future customer bookings created by Slotflow
- manual blocks
- closures/all-day events

A moved or deleted event in Google Calendar is not treated as drift that Slotflow should undo. It is the manager's real schedule.

### Slotflow — presentation and customer entry

Slotflow owns presentation logic and, later, the customer booking entry path.

It does not need a parallel owner-side booking database for the first milestone.

### Business hours

Configured business hours are useful for calculating free gaps and, later, customer-bookable times. They do not replace Calendar occupancy.

## First useful milestone — read-only Calendar companion

```text
Google Calendar
      |
      v
Calendar read adapter / small API
      |
      v
Android tablet PWA
```

The first working product needs only:

- Calendar event retrieval
- event normalization
- next appointment
- today's schedule
- free gaps / next available gap
- immediate cached first paint
- background refresh
- clear stale/offline indication

### Explicitly not required yet

- Google Sheets booking ledger
- pending/confirmed/recovery lifecycle states
- LockService booking transactions
- owner-side create/edit/delete UI
- Calendar/ledger reconciliation
- LINE webhook infrastructure

## Android tablet

The tablet is a **glanceable display surface**.

It is not the manager's primary schedule-editing interface.

First view:

- current date/time
- next appointment emphasized
- today's appointments
- free gaps / next available gap

UX rules:

- no landing page
- no dashboard menu before the schedule
- resume directly to the schedule
- cached view appears immediately
- live Calendar data refreshes in the background
- stale/offline state is visible
- optional keep-screen-awake mode for a dedicated tablet

## Calendar semantics

- Store timezone is explicit, initially `Asia/Tokyo`.
- API timestamps are unambiguous ISO 8601 instants.
- Timed opaque events occupy time.
- Cancelled events do not occupy time.
- Opaque all-day events close their covered store-local dates.
- Required Calendar-read failure is not interpreted as an empty/free schedule.

Detailed edge cases remain covered by the reference audit and test strategy, but they must not inflate the first product into a second scheduling system.

## Later customer booking

After the Calendar read/dashboard path is useful, add the customer flow:

```text
LINE / Web
    |
    v
Slotflow booking UI
    |
    v
minimal booking endpoint
    |
    v
Google Calendar
```

Customer booking should:

1. derive bookable time from business hours minus current Calendar occupancy;
2. re-check the slot immediately before confirmation;
3. create the appointment in Google Calendar;
4. return a clear success/failure result.

After creation, ordinary manager edits continue to happen in Google Calendar and Slotflow reflects them.

### Minimum write safeguards

Only when customer writes are introduced, add the minimum mechanisms required for:

- concurrent double-booking prevention
- idempotent retry/double tap
- server-authoritative service duration/rules
- no false success when Calendar creation fails

Google Sheets may be added later if a concrete requirement for idempotency/customer metadata cannot be met more simply. It is not an architectural prerequisite for the read-only owner dashboard.

## LINE

The first LINE integration should remain simple: a LINE Official Account rich-menu/profile link opens the booking page or LIFF entry.

A conversational Messaging API bot is a separate later decision and must not block the Calendar-first product.

## Deployment stages

### Stage A — Calendar companion

Developer-assisted setup is acceptable. Prove that Calendar changes appear clearly and quickly on the Android tablet.

### Stage B — customer booking

Add the minimal safe write path into Google Calendar.

### Stage C — productized onboarding

Reduce setup for a non-technical owner to Google sign-in/consent + calendar selection. The owner should not create OAuth credentials, deploy scripts or manage secrets.

## Non-goals for the first milestone

- replacing Google Calendar
- owner-side duplicate booking CRUD
- mandatory Sheets ledger
- distributed booking state machine
- multi-location/franchise
- multi-staff resource scheduling unless later required
- payment/POS/inventory/payroll/full CRM
- telephone integration
- conversational LINE bot infrastructure
