# Slotflow Roadmap

## Phase 0 — freeze the foundation

Issues: #2, #3, #4

- Audit `ContextLab/scheduler` and capture adopt/adapt/reject decisions.
- Freeze Calendar/ledger responsibilities and booking state transitions.
- Define business-hours, timezone, all-day-event and manual-Calendar semantics.
- Build regression tests and CI **before** adapting booking logic.

Exit condition: expected behavior is testable and no core design question is hidden inside implementation.

## Phase 1 — calendar booking core

Issue: #5

- Google Apps Script API for the first-store pilot.
- Configurable weekly business hours.
- Calendar occupancy read.
- Appointment create / cancel / reschedule.
- Lock + idempotency + pending/confirmed ledger state.
- Recovery/reconciliation for cross-system failures.

Exit condition: concurrency and partial-failure tests pass.

## Phase 2 — owner tablet

Issue: #6

- Android-first installable PWA.
- Immediate cached view of next appointment / today / free gaps.
- Background live refresh and clear stale/offline state.
- Direct resume to schedule with no landing/menu step.
- Optional keep-screen-awake operation.

Exit condition: the owner can use the tablet by glancing at it rather than opening an application.

## Phase 3 — customer booking

Issue: #7

- Generic service/duration configuration.
- Available-slot selection.
- Minimal customer details.
- Atomic confirmation with idempotent retry.
- Cancellation and rescheduling.

Exit condition: mobile customer flow works independently of LINE.

## Phase 4 — Japan customer entry

Issue: #8

- LINE Official Account rich menu/profile link.
- Booking page/LIFF launch in one tap.
- No webhook required for the first release.

Issue #9 is deliberately separate: conversational Messaging API automation is added only when its value justifies a header-capable webhook endpoint.

## Phase 5 — onboarding/productization

Issue: #10

- Separate developer-assisted first-store deployment from managed SaaS architecture.
- Target owner UX: Google sign-in/consent + calendar selection only.
- Plan OAuth verification, secure refresh-token storage and disconnect/revoke path.

## Phase 6 — hardening and pilot

Issue: #11

- Apps Script/Calendar/Sheets quota checks.
- Security review and secret handling.
- Failure injection/recovery drills.
- First real single-store pilot.
- Measure dashboard startup/resume experience and operational friction.

## Deferred until evidence requires it

- telephone integration (explicitly dropped)
- multi-location / franchise
- multi-staff resource scheduling
- payment/POS/inventory/payroll/full CRM
- Instagram integration
- conversational LINE bot infrastructure
