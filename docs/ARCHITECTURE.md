# Slotflow Architecture

## North star

The store manager operates the real schedule in **Google Calendar**. Slotflow is a thin companion layer, not a second booking system.

The MVP has two read-only presentation surfaces:

1. Owner: read Google Calendar and show the schedule clearly on a dedicated Android tablet.
2. Customer: read the same Calendar and show only derived availability on a mobile page.

Actual reservations are confirmed by **phone**. The manager then enters the appointment into Google Calendar, and Slotflow reflects the new occupancy on refresh.

## Source of truth

Google Calendar is the operational source of truth for:

- manager-entered appointments;
- events created through normal Google/Gemini workflows;
- manual blocks;
- closures/all-day events.

Manager add/move/delete actions are authoritative. Slotflow never recreates or reconciles them against a second booking database.

## Owner workflow

Normal store operations stay in Google Calendar:

- create an appointment after a phone reservation;
- move an appointment;
- delete/cancel an appointment;
- block time;
- add an all-day closure.

The owner tablet is a glanceable display only.

## Customer workflow

```text
Google Calendar
      |
      v
server-side read/availability derivation
      |
      v
Customer mobile page
(service -> ○/△/× -> startable times)
      |
      v
電話で確認する
      |
      v
Manager enters confirmed reservation in Google Calendar
```

The customer page does not create appointments.

## Availability semantics

- Business hours are configuration rules, not a second calendar.
- Availability = configured business hours minus current busy Calendar occupancy.
- Service duration must fit fully inside a free interval before a start time is shown.
- Store timezone is explicit, initially `Asia/Tokyo`.
- Timed opaque events occupy time.
- Cancelled or transparent events do not occupy time.
- Opaque all-day events close their covered store-local dates.
- Calendar/provider/config failure is shown as unavailable/error, never as free time.

## Privacy boundaries

### Owner dashboard

The source Calendar remains private. Owner schedule data must not be exposed through an unauthenticated public schedule endpoint.

### Customer availability

Customer-facing responses contain only derived availability needed for display, such as:

- service display metadata;
- date availability status;
- startable times/ranges;
- store timezone.

Never expose appointment titles, names, contacts, descriptions, attendees, raw Calendar objects, Calendar credentials or OAuth tokens.

## Customer UI

The MVP customer page should remain simple and mobile-first:

- store/brand header;
- service selection;
- compact multi-week/month calendar;
- ○ / △ / × date status;
- selected-date startable times/ranges;
- `tel:` CTA labeled **電話で確認する**.

No customer account, name/contact form, online confirmation button, cancellation/reschedule flow or customer-side Calendar mutation.

## LINE

The first LINE integration is only an entry point: a LINE Official Account rich-menu/profile link opens the same read-only availability page. LIFF is optional only if it materially improves viewing UX.

A conversational webhook is deferred and is not required for booking because reservations remain phone-based.

## Deployment stages

### Stage A — owner Calendar companion
Developer-assisted setup is acceptable. Prove that Calendar changes appear clearly and quickly on the owner tablet.

### Stage B — customer read-only availability
Expose only derived availability and phone handoff. Use least-privilege Calendar read access.

### Stage C — productized onboarding
Reduce setup for a non-technical owner to Google sign-in/consent, calendar selection and basic business/service configuration.

## Non-goals for the MVP

- customer online booking / Calendar writes;
- owner-side duplicate booking CRUD;
- mandatory Sheets ledger;
- LockService booking transaction flow;
- booking lifecycle/reconciliation state machine;
- multi-location/franchise;
- multi-staff resource scheduling unless later required;
- payment/POS/inventory/payroll/full CRM;
- conversational LINE bot infrastructure.
