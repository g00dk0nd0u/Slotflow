# Slotflow Roadmap

## Phase 0 — foundation audit

Issue: #2

- Audit the closest reference implementation.
- Record useful and dangerous patterns.

Status: **complete**.

The audit remains reference material. It must not force Slotflow to inherit complexity that the product does not need yet.

## Phase 1 — Calendar companion

Issues: #5, #6, #4

Build the first actually useful product:

- read the manager's Google Calendar;
- normalize today's/upcoming events;
- show next appointment, today's schedule and free gaps;
- run as an instant-access Android PWA;
- cache the last successful schedule for immediate first paint;
- refresh in the background;
- add lightweight regression tests/CI for this read/display path.

No Sheets ledger or booking lifecycle state machine is required.

Exit condition: the manager can continue operating in Google Calendar and use Slotflow only as a clearer always-ready display.

## Phase 2 — customer booking into Calendar

Issues: #3, #7

Only after Phase 1 is useful:

- define the minimum write safeguards;
- calculate customer-bookable time from business hours minus Calendar occupancy;
- re-check before confirmation;
- create the appointment directly in Google Calendar;
- protect against duplicate writes/retries;
- return clear success/failure.

Do not add a second booking database unless a concrete requirement proves necessary.

Exit condition: a customer can book from mobile and the resulting event appears in Google Calendar, after which normal manager operation continues there.

## Phase 3 — LINE entry

Issue: #8

- LINE Official Account rich menu/profile link.
- Open the booking page/LIFF in one tap.
- No webhook required for the first release.

Issue #9 remains deferred until conversational automation is genuinely required.

## Phase 4 — onboarding/productization

Issue: #10

- Keep developer-assisted pilot setup separate from managed SaaS onboarding.
- Target owner experience: Google sign-in/consent + calendar selection only.

## Phase 5 — hardening and first-store pilot

Issue: #11

- Calendar/API quota checks.
- Offline/stale dashboard behavior.
- Security review for any customer write endpoint.
- First real single-store pilot.
- Measure whether the manager ever needs to maintain anything outside Google Calendar for routine schedule operation.

## Deferred until evidence requires it

- mandatory Google Sheets booking ledger
- large distributed booking state machine
- owner-side duplicate booking CRUD
- conversational LINE bot infrastructure
- telephone integration
- multi-location/franchise
- multi-staff resource scheduling
- payment/POS/inventory/payroll/full CRM
- Instagram integration
