# Architecture Decisions

## ADR-001: Single owner / single location first

The MVP optimizes for one owner operating one location. Multi-tenant, franchise and multi-staff resource scheduling are intentionally deferred.

## ADR-002: Android tablet is Slotflow's primary owner surface, but not the primary editing tool

The dedicated Android tablet is optimized for instant schedule visibility. The manager continues to edit the schedule in Google Calendar; Slotflow does not duplicate Calendar CRUD for the owner in the first milestone.

## ADR-003: Google Calendar is the operational source of truth

Google Calendar represents the real store schedule. Manager-created, Gemini-created and future Slotflow-created appointments are all ordinary Calendar events. Manager add/move/delete actions in Calendar are accepted as the real schedule and reflected by Slotflow rather than reconciled back to another owner-side database.

## ADR-004: No mandatory parallel booking ledger for the first milestone

The Calendar-read/dashboard milestone does not require Google Sheets or another booking ledger. A ledger may be introduced later only if customer-booking requirements such as idempotency or metadata storage demonstrably need it.

## ADR-005: Business hours are a calculation rule, not a second calendar

Configured weekly hours are used to calculate free gaps and future customer-bookable time. Google Calendar occupancy remains authoritative.

## ADR-006: Complex booking transaction state is deferred until customer writes exist

Pending/confirmed/recovery state machines, LockService transactions and Calendar/ledger reconciliation are not prerequisites for the read-only dashboard. When customer booking writes are introduced, implement only the minimum safeguards required to prevent duplicate writes and false confirmation.

## ADR-007: LINE is customer-facing, not the schedule authority

LINE Official Account / LIFF provides customer entry where useful. Google Calendar remains the operational schedule.

## ADR-008: LINE MVP does not require a Messaging API webhook

A rich-menu/profile link can open the booking page or LIFF entry directly. This minimizes infrastructure and attack surface.

## ADR-009: Secure LINE webhooks require a header-capable endpoint

If conversational Messaging API automation is later added, LINE signature verification requires access to the raw body and `x-line-signature` header. Apps Script web-app `doPost(e)` must not be assumed to provide this secure webhook boundary.

## ADR-010: Reference repositories are patterns, not dependencies

Existing OSS is audited and selectively adapted. Slotflow does not fork a complete scheduling product merely because it already exists.

## ADR-011: Pilot setup and productized onboarding are separate problems

The first-store pilot may use developer-assisted Google configuration. A managed product should later reduce owner setup to Google sign-in/consent + calendar selection.

## ADR-012: Gemini/Google voice interaction is ordinary Calendar input

Events created through normal Google/Gemini workflows are treated exactly like other Calendar events. Slotflow does not depend on Gemini but naturally reflects its Calendar output.

## ADR-013: Telephone integration is out of scope

Slotflow focuses on Calendar visibility, customer web booking and LINE entry.

## ADR-014: Opaque all-day events close their covered store-local dates

On configured occupancy calendars, an opaque all-day event blocks the half-open date range `[start.date, end.date)` in the store timezone. Cancelled or explicitly transparent events do not block.

## ADR-015: Required Calendar reads fail visibly

If required Calendar data cannot be read, Slotflow must distinguish that failure from an actually empty/free schedule. It must not silently show free time based on missing provider data.

## ADR-016: Server rules and explicit time representation are authoritative for customer booking

When customer booking is introduced, service identity, duration, buffers, notice/horizon rules and timezone are enforced server-side. API timestamps use explicit ISO 8601 instants; store civil-time expansion uses an explicit IANA timezone. Frontend values are not authorization.
