# Architecture Decisions

## ADR-001: Single owner / single location first

The MVP optimizes for one owner operating one location. Multi-tenant, franchise, and multi-staff resource scheduling are intentionally deferred.

## ADR-002: Android tablet is the primary owner interface

The owner experience is optimized around an always-ready Android tablet dashboard. Opening the app should not be part of the daily workflow; the schedule should already be visible. Startup/resume speed is therefore a core acceptance criterion.

## ADR-003: Google Calendar owns operational occupancy

Google Calendar determines whether the owner is busy. Slotflow-created appointments and manually created events are both respected. This preserves normal Calendar/Gemini voice workflows instead of forcing all schedule entry through Slotflow.

## ADR-004: Google Sheets is the MVP booking ledger, not the calendar

Sheets stores Slotflow transaction/lifecycle metadata and recovery state. It exists for idempotency, concurrency protection, customer metadata and reconciliation. Calendar remains the operational schedule.

## ADR-005: Base availability comes from business hours, not named availability events

The store configures weekly opening/bookable hours. Calendar busy intervals are subtracted from them. Slotflow does not require specially titled "availability" events.

## ADR-006: Partial failures must remain visible and recoverable

A Calendar mutation and a ledger mutation are not an atomic database transaction. Slotflow must use explicit states such as pending/confirmed/cancelled/recovery-needed, idempotency keys, locking and reconciliation. It must not report success after only half of a cross-system operation succeeds.

## ADR-007: LINE is customer-facing, not the booking authority

LINE Official Account / LIFF provides customer entry and identity context where useful. Booking correctness remains in the core booking layer.

## ADR-008: LINE MVP does not require a Messaging API webhook

A rich-menu/profile link can open the booking page or LIFF entry directly. This is the first integration because it minimizes infrastructure and attack surface.

## ADR-009: Secure LINE webhooks require a header-capable endpoint

LINE requires verification of the raw body against the `x-line-signature` header. Apps Script web-app `doPost(e)` does not expose arbitrary request headers in its documented event object. Therefore a future Messaging API bot must terminate at a service capable of reading/verifying that header before processing the request.

## ADR-010: Reference repositories are patterns, not dependencies

Existing OSS is audited and selectively adapted. Slotflow does not initially fork a complete appointment system. Every adopted reference behavior receives its own regression test.

## ADR-011: Pilot deployment and SaaS onboarding are separate problems

The first-store pilot may use developer-assisted GAS/Google configuration. A managed service must later reduce owner onboarding to Google sign-in/consent + calendar selection; owners must not create OAuth credentials or deploy scripts themselves.

## ADR-012: Gemini/Google voice interaction is optional compatibility, not a dependency

Slotflow benefits from events entered through normal Google Calendar voice workflows, but the product must remain fully usable without Gemini or a voice assistant.

## ADR-013: Telephone integration is out of scope

The earlier telephone integration idea is intentionally dropped. Slotflow focuses on schedule visibility, web booking, Calendar, and LINE.
