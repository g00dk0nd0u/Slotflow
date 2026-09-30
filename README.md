# Slotflow

Lightweight Google Calendar companion for small appointment-based businesses.

## Product north star

The store manager uses **Google Calendar for all actual appointment entry and schedule operations**. Slotflow does not replace Google Calendar and does not ask the manager to maintain the same appointment twice.

Slotflow has two jobs:

1. **Owner display:** read Google Calendar and present the schedule clearly on a dedicated Android tablet.
2. **Customer availability:** read the same Calendar and show only derived availability on a mobile page.

Actual reservations are confirmed **by phone**. After the call, the store manager enters the appointment into Google Calendar. Slotflow then reflects the new Calendar state and removes the occupied time from customer availability.

## MVP flow

```text
Customer availability page
(service -> ○/△/× -> startable times)
            |
            v
     Phone the store
            |
            v
Manager confirms verbally
            |
            v
Manager enters appointment in Google Calendar
            |
            +--------------------+
            |                    |
            v                    v
Owner tablet display     Customer availability refresh
```

Google Calendar remains the operational source of truth.

## Customer UI

The MVP customer page is read-only:

- service selection
- compact calendar / multi-week availability
- ○ / △ / × date status
- startable times or ranges for the selected service duration
- clear **電話で確認する** `tel:` action

It does **not** collect customer name/contact and does **not** create, update or delete Calendar events.

## Implemented MVP

- authenticated, read-only owner dashboard with 30-second refresh and same-day cache;
- customer availability page with service/options, a six-week window, automatic refresh and phone handoff;
- separate owner and customer Apps Script deployments with least-privilege Calendar reads;
- normal HTTPS-link setup for opening the customer page from a LINE Official Account; smartphone acceptance remains a pilot check.

Start here:

- [Architecture](docs/ARCHITECTURE.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Current scope and next steps](docs/ROADMAP.md)
- [Current issue map](docs/ISSUE_PLAN.md)
- [Test strategy](docs/TEST_STRATEGY.md)
- [Calendar read adapter operations](docs/CALENDAR_READ_ADAPTER.md)
- [Android owner dashboard](docs/DASHBOARD.md)
- [Customer availability](docs/CUSTOMER_AVAILABILITY.md)
- [LINE entry setup](docs/LINE_ENTRY.md)
- [Pilot and future managed onboarding](docs/ONBOARDING.md)
- [Reference repository audit](docs/REFERENCE_AUDIT.md)

## Scope

First release:

- single owner / single location
- Google Calendar as the operational schedule
- owner Android tablet display
- customer read-only availability display
- phone reservation handoff
- LINE HTTPS-link entry setup, pending smartphone pilot verification

Explicitly deferred:

- customer online booking / Calendar writes
- owner-side duplicate calendar/admin system
- mandatory Google Sheets ledger
- booking transaction state machine / LockService flow
- multi-location/franchise
- payment/POS/inventory/payroll/full CRM
- conversational LINE bot infrastructure unless its value is proven

## License

MIT
