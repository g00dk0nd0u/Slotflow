# Slotflow Architecture

## Goal

Slotflow is a lightweight appointment scheduling system for small businesses. The first target is a single owner / single location setup, while keeping the domain generic enough for salons, studios, clinics, lessons, consulting, and other appointment-based businesses.

## Product principles

- Fastest possible daily operation on an Android tablet.
- Google Calendar is the primary operational calendar.
- LINE is the primary customer-facing channel in Japan.
- Avoid paid infrastructure where practical.
- Prefer a simple static frontend + Google Apps Script backend before introducing servers or databases.
- Do not copy a reference repository wholesale; audit and selectively reuse ideas.

## Initial architecture

```text
Customer
  |
  +-- LINE Official Account / LIFF
  |
  +-- Web booking page
          |
          v
GitHub Pages / static frontend
          |
          v
Google Apps Script API
     |          |
     |          +-- Google Sheets (booking metadata / audit trail)
     |
     +------------- Google Calendar (availability / appointments)

Store owner
  |
  +-- Android tablet dashboard (PWA / always-on view)
  |
  +-- Google / Gemini voice interaction where useful
```

## MVP scope

1. Android tablet dashboard: today, next appointment, upcoming appointments, free time.
2. Google Calendar availability read/write.
3. Customer booking flow.
4. Double-booking protection and concurrent booking safety.
5. Cancellation and rescheduling.
6. LINE Messaging API / LIFF integration after the calendar core is proven.

## Non-goals for the first release

- Telephone integration.
- Multi-location / franchise management.
- POS, payment, inventory, payroll, or CRM suites.
- Heavy server infrastructure.

## Reference implementation policy

`ContextLab/scheduler` is a useful reference for GitHub Pages + Google Apps Script + Google Calendar, but it must be audited before borrowing implementation details. In particular, availability logic, concurrency, reconciliation, authentication, rate limiting, Apps Script quotas, timezone handling, and data consistency must be independently tested in Slotflow.
