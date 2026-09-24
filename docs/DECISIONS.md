# Architecture Decisions

## ADR-001: Single owner / single location first
The MVP optimizes for one owner operating one location. Multi-tenant, franchise and multi-staff resource scheduling are deferred.

## ADR-002: Google Calendar is the only operational schedule
The manager creates, moves and deletes actual appointments in Google Calendar. Slotflow reflects those changes and does not maintain a second owner-side schedule.

## ADR-003: Owner tablet is a display, not an editing tool
The dedicated Android tablet is optimized for instant schedule visibility. Routine schedule editing stays in Google Calendar.

## ADR-004: Customer MVP is read-only availability
The customer page displays availability derived from Calendar occupancy. It does not create, update or delete appointments.

## ADR-005: Reservations are confirmed by phone
The customer checks availability and calls the store. After verbal confirmation, the manager enters the appointment into Google Calendar. Slotflow then reflects the newly occupied time.

## ADR-006: Business hours are calculation rules
Configured business hours plus service duration determine candidate start times. Calendar occupancy remains authoritative.

## ADR-007: No customer personal-data form in the MVP
The read-only customer page does not collect customer name/contact information because the web app itself does not book.

## ADR-008: No booking transaction machinery in the MVP
Customer Calendar writes, `LockService`, request-id idempotency, booking lifecycle state, Sheets ledgers and reconciliation are unnecessary while the customer surface is read-only.

## ADR-009: Customer output is privacy-minimized
Customer-facing output contains only service/date availability, startable times/ranges and store timezone. It never includes appointment titles, customer details, descriptions, attendees, raw Calendar objects or credentials.

## ADR-010: LINE is only an entry point initially
A LINE Official Account rich-menu/profile link may open the read-only availability page. LIFF is optional. A Messaging API webhook is not required for the MVP.

## ADR-011: Secure LINE webhooks require a header-capable endpoint
If conversational LINE automation is later justified, signature verification must validate the raw request body against `x-line-signature`. Apps Script `doPost(e)` must not be assumed to provide that trust boundary.

## ADR-012: Reference repositories are patterns, not dependencies
Existing OSS is audited and selectively adapted. Slotflow does not inherit a full online-booking architecture merely because one exists.

## ADR-013: Pilot setup and productized onboarding are separate
The first-store pilot may use developer-assisted Google configuration. A managed product should later reduce owner setup to sign-in/consent, calendar selection and basic store configuration.

## ADR-014: Gemini/Google voice interaction is ordinary Calendar input
Events created through normal Google/Gemini workflows are treated exactly like other Calendar events.

## ADR-015: Opaque all-day events close covered store-local dates
On configured occupancy calendars, an opaque all-day event blocks the half-open date range `[start.date, end.date)` in the store timezone. Cancelled or transparent events do not block.

## ADR-016: Required Calendar reads fail visibly
If required Calendar data cannot be read, Slotflow distinguishes that failure from an actually empty/free schedule. Missing provider data must never appear as free time.

## ADR-017: Store timezone and server rules are authoritative
Service duration, business hours and store timezone are enforced server-side when deriving availability. Client/device timezone is not authoritative.
