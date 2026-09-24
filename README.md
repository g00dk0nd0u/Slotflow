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

## Current status

- Reference repository audit: complete
- Calendar read adapter: implemented
- Authenticated owner Apps Script dashboard: implemented
- Customer read-only availability and phone handoff: implemented

Start here:

- [Architecture](docs/ARCHITECTURE.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Issue plan](docs/ISSUE_PLAN.md)
- [Test strategy](docs/TEST_STRATEGY.md)
- [Calendar read adapter operations](docs/CALENDAR_READ_ADAPTER.md)
- [Android dashboard pilot](docs/DASHBOARD.md)
- [Customer availability](docs/CUSTOMER_AVAILABILITY.md)
- [Reference repository audit](docs/REFERENCE_AUDIT.md)
- [MVP roadmap issue #1](https://github.com/g00dk0nd0u/Slotflow/issues/1)

## Scope

First release:

- single owner / single location
- Google Calendar as the operational schedule
- owner Android tablet display
- customer read-only availability display
- phone reservation handoff
- LINE entry point to the same availability page later

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
