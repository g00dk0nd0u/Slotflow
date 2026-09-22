# Test Strategy

Slotflow treats scheduling correctness as the first implementation feature. The test suite must exist before the booking core is considered usable.

## Layers

### 1. Pure time/availability tests

Run without Google services.

- weekly business-hours expansion
- service duration and optional buffers
- busy-interval subtraction
- adjacent vs overlapping intervals
- all-day closure semantics
- cancelled / declined / transparent events
- min-notice including exactly `0`
- max-advance boundaries
- store timezone independent of device timezone
- DST transition cases in at least one DST-observing timezone

### 2. Booking transaction tests

Mock Calendar, Sheets, LockService and provider failures.

- two simultaneous requests for the same slot
- idempotent retry of the same request
- pending -> confirmed success
- ledger pending succeeds / Calendar create fails
- Calendar create succeeds / final ledger write fails
- cancellation Calendar failure
- reschedule partial failure
- stale ledger row
- orphan Slotflow Calendar event
- owner manually moves/deletes a Slotflow event
- owner manually creates a non-Slotflow busy event

### 3. API contract tests

- validation and normalized error responses
- no secret leakage
- customer endpoints expose only required data
- cancellation/reschedule token expiry
- rate limiting never substitutes for booking integrity

### 4. Owner dashboard tests

- cached first paint before live network response
- live refresh updates the schedule
- stale/offline state is obvious
- resume returns directly to schedule
- next appointment and free gaps remain correct across day rollover

### 5. LINE tests

For simple rich-menu/LIFF entry:

- booking page opens in LINE and normal mobile browser
- no LINE secret in frontend assets

If Messaging API is added later:

- valid `x-line-signature` accepted
- missing/invalid signature rejected before event processing
- raw body is not modified before verification
- duplicate/redelivered webhook is idempotent

## CI policy

Every PR that changes booking, time, Calendar, ledger or API logic must run the regression suite. A failing correctness test blocks merge.

Known reference-repository failure patterns from `REFERENCE_AUDIT.md` must be represented as regression tests so they cannot silently return.
