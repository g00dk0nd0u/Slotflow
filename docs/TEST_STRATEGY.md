# Test Strategy

Slotflow treats scheduling correctness as the first implementation feature. The test suite must exist before the booking core is considered usable.

## Layers

### 1. Pure time/availability tests

Run without Google services.

- weekly business-hours expansion
- arbitrary service duration and independent pre/post buffers, including non-slot-multiple values
- busy-interval subtraction
- adjacent, nested, duplicate and partially overlapping intervals
- overlapping base windows are normalized and cannot emit duplicate/overlapping slots
- opaque one-day/multi-day all-day closures use `[start.date, end.date)` in store time
- opaque, transparent, cancelled, self-declined and ambiguously declined event matrix
- multiple calendars: union busy time; one mandatory-calendar read failure fails closed
- min-notice including exactly `0`, negative/invalid/missing configuration, and the exact boundary defined by Issue #3
- max-advance exact boundary and invalid configuration, following the Issue #3 contract
- pre/post-buffer cases at both boundaries, with expected outcomes determined by Issue #3 rather than assumed here
- store timezone independent of device timezone
- malformed or offset-free API timestamps rejected
- DST spring gap and autumn fold in at least one DST-observing timezone
- backend configuration remains authoritative when frontend values/defaults disagree

### 2. Booking transaction tests

Mock Calendar, Sheets, LockService and provider failures.

- two simultaneous requests for the same slot
- overlapping requests with different starts/durations/buffers
- lock timeout returns retryable busy and never continues unlocked
- idempotent retry before response, after Calendar create, and after ledger finalization
- same idempotency key with a different canonical payload is rejected
- pending -> confirmed success
- ledger pending succeeds / Calendar create fails
- Calendar create succeeds / final ledger write fails
- `SpreadsheetApp.flush()` failure and stale/read-after-write Sheet view
- delayed Calendar visibility after a successful create
- cancellation event absent vs transient delete failure vs confirmed deletion
- cancellation raced with cancellation and with reschedule
- reschedule failure before/after old delete, new create, and each ledger transition
- reschedule to a partially overlapping later interval and partially overlapping earlier interval does not conflict with its exact old event
- reschedule to the same interval has defined idempotent/no-op behavior; an adjacent interval does not self-conflict
- an unrelated third-party Calendar event remains blocking when the old booking is excluded
- new reschedule event succeeds / final ledger update fails
- notification failure after otherwise successful create/cancel/reschedule
- transient Calendar and Sheets failures preserve a non-success/recoverable state
- fresh vs grace-expired stale ledger row; Calendar lookup error is not absence
- orphan Slotflow Calendar event and arbitrary manual event are distinguished
- owner manually moves/deletes a Slotflow event; event-ID and time drift are detected
- owner manually creates a non-Slotflow busy event
- reconciliation is idempotent, bidirectional for tagged events, bounded/checkpointed, and
  mutually exclusive with conflicting mutations

### 3. API contract tests

- validation and normalized error responses
- no secret leakage
- no maintenance or management credential in query strings, redirects, logs or static assets
- GET/query-string maintenance credentials and reconcile/cleanup mutations are rejected
- direct requests without a browser/CORS context obey the same authorization policy
- direct create rejects arbitrary start/end duration, unknown or mismatched service identity/name, and client-controlled buffers/notice/horizon
- direct create derives or validates format/location according to the server-side service policy
- direct reschedule cannot change service duration by supplying arbitrary `newStart`/`newEnd`
- customer endpoints expose only required data
- non-enumerating booking/token errors and spreadsheet-formula input escaping
- cancellation/reschedule token entropy, hash-at-rest, purpose binding, expiry, revocation and replay
- CacheService eviction/non-atomic increments/client-ID rotation cannot bypass integrity
- rate limiting never substitutes for authentication, idempotency or booking integrity

### 4. Google-service contract tests

Run a small, isolated suite against a dedicated Apps Script test deployment and disposable
Calendar/Sheet. Mocks remain the default fast suite, but cannot certify provider semantics.

- Advanced Calendar service is declared; unavailable service fails closed rather than falling back
- opaque/transparent/cancelled/all-day and attendee-response fields match fixture assumptions
- separate concurrent executions establish actual `LockService` exclusion and timeout behavior
- Calendar creation visibility and Sheets append/flush/read visibility are observed
- a required conflict-calendar authorization/quota/transient error is distinguishable from empty
- deployed `doGet`/`doPost` exposure, response headers and authorization match the API contract
- scheduled reconciliation resumes from a checkpoint without duplicate destructive action

### 5. Owner dashboard tests

- cached first paint before live network response
- live refresh updates the schedule
- stale/offline state is obvious
- resume returns directly to schedule
- next appointment and free gaps remain correct across day rollover

### 6. LINE tests

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

Fast pure/mock tests and Markdown/link checks run on every pull request. Provider contract
tests run on a protected scheduled/manual environment because they require Google
credentials and quota; their last successful revision and timestamp must be visible. A mock
test must never be described as proving actual Apps Script, Calendar, Sheets, LockService or
CacheService semantics. Branch protection and required-check configuration must be verified
in GitHub settings, not inferred from workflow files alone.
