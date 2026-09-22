# Slotflow Roadmap

## Phase 0 — Validate the foundation

- Audit `ContextLab/scheduler` and other relevant open-source schedulers.
- Define Slotflow's source of truth and consistency model.
- Define timezone handling, booking state model, and failure recovery.
- Establish automated tests before adapting reference logic.

## Phase 1 — Calendar core

- Google Apps Script API skeleton.
- Google Calendar availability read.
- Appointment create / cancel / reschedule.
- Concurrency-safe double-booking protection.
- Minimal booking metadata store and reconciliation.

## Phase 2 — Owner tablet dashboard

- Android-first responsive PWA.
- Immediate view: current time, next appointment, today's appointments, free gaps.
- Fast refresh and resilient read-only fallback.
- Home-screen install and always-on operation.

## Phase 3 — Customer booking web flow

- Service / duration selection.
- Available slot selection.
- Customer details.
- Confirmation, cancellation, and rescheduling.

## Phase 4 — LINE

- LINE Official Account webhook integration.
- Messaging API responses.
- LIFF booking entry point where it improves UX.
- Signature verification and account/store mapping.

## Phase 5 — Hardening

- Quota and load testing.
- Security review.
- Failure injection and recovery tests.
- Operational documentation and simple setup flow for non-technical store owners.
