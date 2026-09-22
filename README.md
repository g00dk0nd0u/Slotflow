# Slotflow

Lightweight appointment scheduling for small businesses with Google Calendar and LINE integration.

Slotflow starts with a **single owner / single location** and is intentionally domain-generic. The first-store experience is optimized around an **always-ready Android tablet**, not a complex admin application.

## Product direction

- **Google Calendar** is the owner's operational schedule and occupancy surface.
- **Android tablet PWA** shows the next appointment, today's schedule and free gaps immediately.
- **Google Apps Script + Google Sheets** are the low-cost pilot backend/booking ledger where appropriate.
- **LINE Official Account** is the primary Japan customer entry point; the MVP can open the booking page/LIFF directly without a Messaging API webhook.
- Manual Calendar events, including events created through normal Google/Gemini workflows, must block customer availability correctly.
- Telephone integration is explicitly out of scope.

## Non-negotiable engineering rules

- No double booking under concurrent requests.
- Cross-system partial failures must be visible and recoverable.
- Store timezone and all-day closure behavior are explicit and tested.
- Reference OSS is audited before any implementation is reused.
- Regression CI is established before calendar booking logic is implemented.

## Current status

Architecture / reference-audit phase. No production booking core yet.

Start here:

- [Architecture](docs/ARCHITECTURE.md)
- [Architecture decisions](docs/DECISIONS.md)
- [Reference repository audit](docs/REFERENCE_AUDIT.md)
- [Test strategy](docs/TEST_STRATEGY.md)
- [Roadmap](docs/ROADMAP.md)
- [Issue plan](docs/ISSUE_PLAN.md)
- [MVP roadmap issue #1](https://github.com/g00dk0nd0u/Slotflow/issues/1)

## Why not simply fork an existing scheduler?

The closest reference implementation already contains valuable fixes for Calendar propagation, double-booking and reconciliation, but its current behavior also exposes assumptions that do not fit Slotflow (for example named availability events, ignored all-day events, non-atomic cancellation/rescheduling paths, and a zero-value configuration edge case). Slotflow therefore reuses **ideas only after independent tests**, rather than inheriting an entire codebase.

## License

MIT
