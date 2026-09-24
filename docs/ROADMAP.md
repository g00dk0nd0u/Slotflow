# Slotflow Roadmap

## Phase 0 — foundation audit
Issue: #2

Status: **complete**.

## Phase 1 — owner Calendar companion
Issues: #5, #6, #4

- read the manager's Google Calendar;
- normalize schedule data;
- show next appointment, today's schedule and free gaps;
- cache last successful data and refresh in the background;
- add lightweight regression tests/CI.

Exit condition: the manager can keep operating entirely in Google Calendar and use Slotflow as a clearer always-ready display.

## Phase 2 — customer read-only availability
Issue: #7

- calculate availability from business hours minus Calendar occupancy;
- respect selected service duration;
- show compact calendar status such as ○ / △ / ×;
- show selected-date startable times/ranges;
- provide a clear **電話で確認する** `tel:` action;
- expose no private appointment/customer data;
- do not create Calendar events from the customer UI.

Exit condition: a customer can check availability, call the store, and the manager can enter the confirmed reservation in Google Calendar; that Calendar change removes the occupied time from availability on refresh.

## Phase 3 — LINE entry
Issue: #8

- LINE Official Account rich menu/profile link;
- open the same read-only availability page in one tap;
- no booking webhook required.

Issue #9 remains deferred unless conversational availability is genuinely useful.

## Phase 4 — onboarding/productization
Issue: #10

- keep developer-assisted pilot setup separate from managed SaaS onboarding;
- target owner experience: Google sign-in/consent, calendar selection and basic store configuration;
- prefer least-privilege Calendar read access for the MVP.

## Phase 5 — hardening and first-store pilot
Issue: #11

- Calendar/API quota checks;
- offline/stale owner-dashboard behavior;
- customer availability privacy review;
- phone-handoff validation;
- first real single-store pilot.

## Deferred until an explicit product decision requires it

- customer online booking / Calendar writes;
- LockService/idempotent write flow;
- mandatory Google Sheets booking ledger;
- booking lifecycle/reconciliation;
- owner-side duplicate booking CRUD;
- conversational LINE booking bot;
- multi-location/franchise;
- multi-staff resource scheduling;
- payment/POS/inventory/payroll/full CRM.
