# Test Strategy

Slotflow tests should follow product scope. The first milestone is a Google Calendar read/display companion, not a full booking transaction platform.

## Immediate tests — Calendar read/dashboard

### 1. Calendar event normalization

Cover:

- timed events
- opaque vs transparent events where relevant
- cancelled events
- one-day and multi-day all-day events
- explicit store timezone handling
- device timezone differing from store timezone
- malformed timestamps/provider errors
- overlapping events

### 2. Dashboard derivation

Cover:

- next appointment
- today's ordered schedule
- free-gap calculation inside configured business hours
- adjacent events
- day rollover
- empty day
- Calendar read failure is not shown as an empty/free schedule

### 3. Android/PWA behavior

Cover:

- cached first paint before live refresh
- live refresh replaces cached data
- stale/offline indication
- resume returns directly to the schedule
- no owner-side booking CRUD dependency

### 4. CI

Fast tests and Markdown/link checks should run on every PR/push.

The first dashboard milestone should not wait for a future customer-booking transaction test harness.

## Deferred tests — customer booking writes

Add these only when #7 introduces Calendar writes:

- two concurrent attempts for the same slot
- immediate slot re-check before create
- idempotent retry / double tap
- same idempotency key with different request rejected
- Calendar creation failure does not return success
- lost response after successful Calendar creation does not create a duplicate on retry
- server-side service duration/rules override client input
- customer cancellation/reschedule semantics if those features are added

If Google Sheets or another ledger is later introduced, then add tests for its actual role. Do not pre-build Sheets/LockService/reconciliation tests for a component that is not part of the first product.

## Provider contract checks

A small isolated Google-service test may verify assumptions that mocks cannot prove, such as:

- Calendar event fields used by the read adapter
- all-day event date semantics
- permissions/auth failures vs genuinely empty results
- deployed Apps Script/API response behavior if Apps Script is used

Mocks prove Slotflow logic, not Google's runtime behavior.

## Reference audit

`REFERENCE_AUDIT.md` remains useful as a list of failure patterns to avoid if/when similar booking-write mechanisms are adopted.

It is not a requirement to implement every referenced protection before the Calendar-only dashboard exists.
