# Slotflow

Lightweight Google Calendar companion for small appointment-based businesses.

## Product north star

The store manager uses **Google Calendar for almost all schedule operations**. Slotflow does not replace Google Calendar and does not ask the manager to maintain the same appointment twice.

Slotflow has two jobs:

1. **Read Google Calendar and present it better** on a dedicated Android tablet.
2. **Later, let customers book from Web/LINE** by writing appointments into Google Calendar.

## First useful milestone

```text
Google Calendar
      |
      v
small read API
      |
      v
Android tablet PWA
```

The tablet shows:

- next appointment
- today's schedule
- free gaps / next available gap
- stale/offline status when live data is unavailable

The manager continues to add, move, delete and edit appointments in Google Calendar. Slotflow simply reflects those changes.

For this first milestone there is **no Google Sheets booking ledger, no owner-side booking CRUD UI, and no booking state machine**.

## Later customer booking

After the Calendar dashboard works, a customer flow can be added:

```text
LINE / Web
    |
    v
Slotflow booking page
    |
    v
Google Calendar
```

Only the minimum safeguards needed for customer writes—slot re-checking, duplicate-write protection and clear Calendar write failure handling—should be added. A second booking database is not a default requirement.

## Current status

- Reference repository audit: complete
- Architecture: being simplified around the Calendar-first product model
- Calendar read adapter: implemented; dashboard transport/UI: not yet implemented

Start here:

- [Architecture](docs/ARCHITECTURE.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Issue plan](docs/ISSUE_PLAN.md)
- [Test strategy](docs/TEST_STRATEGY.md)
- [Calendar read adapter operations](docs/CALENDAR_READ_ADAPTER.md)
- [Reference repository audit](docs/REFERENCE_AUDIT.md)
- [MVP roadmap issue #1](https://github.com/g00dk0nd0u/Slotflow/issues/1)

## Scope

First release:

- single owner / single location
- generic appointment business
- Google Calendar as the operational schedule
- Android tablet display
- customer booking into Calendar later
- LINE entry point later

Explicitly deferred:

- owner-side duplicate calendar/admin system
- mandatory Google Sheets ledger
- large booking lifecycle state machine
- multi-location/franchise
- payment/POS/inventory/payroll/full CRM
- telephone integration
- conversational LINE bot infrastructure unless its value is proven

## License

MIT
