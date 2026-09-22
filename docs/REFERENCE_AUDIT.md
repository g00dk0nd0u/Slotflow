# Reference Repository Audit

Primary reference: `ContextLab/scheduler`

Audit baseline: `c92dec793039fa5a365162029041bdbd26088901` (2026-08-16).

## Conclusion

The repository is valuable as a compact example of **GitHub Pages + Google Apps Script + Google Calendar + Google Sheets**, but it should not be forked wholesale for Slotflow. Its recent history and current code expose several correctness/security behaviors that are acceptable for its own use case but unsafe to inherit without explicit decisions and regression tests.

Use the labels below:

- **ADOPT** — pattern is suitable with independent Slotflow tests.
- **ADAPT** — useful idea, but Slotflow needs different semantics.
- **REJECT** — do not carry the behavior forward.

## Findings

### 1. Advanced Calendar Service silently degraded before the latest fix — ADAPT

Latest commit `c92dec7` fixed a missing Advanced Calendar Service declaration. Before that, `Calendar.Events.list` raised `Calendar is not defined`; the implementation caught the error and silently fell back to `CalendarApp`.

The fallback cannot provide the same transparency information, so behavior changed rather than simply becoming slower.

**Slotflow rule:** do not silently fall back to a semantically different availability engine. Fail visibly or use an explicitly tested equivalent path.

### 2. Maintenance secret was previously sent in a URL — ADOPT the lesson, not the mechanism

Commit `883880e` moved the cleanup/reconcile secret from a GET query parameter into the POST body because URLs can appear in logs and redirects.

**Slotflow rule:** secrets never appear in URLs, static client code, or logs. Public maintenance endpoints should be minimized.

### 3. Claimed CORS validation is not actually enforcement — REJECT

`backend/Code.gs` declares `origin` and `allowedOrigin` at the top of `doPost`, but the variables are not used to reject requests. The `origin` value is also read from request parameters rather than an HTTP request header.

**Slotflow rule:** CORS is not authentication. Do not describe a client-supplied parameter as origin validation, and do not use origin checks as booking authorization.

### 4. `MIN_NOTICE_HOURS = 0` does not work as configured — REJECT

`Calendar.gs` uses:

```js
parseInt(Config.get('MIN_NOTICE_HOURS'), 10) || 12
```

Therefore numeric `0` becomes the default `12`. The test harness itself supplies `MIN_NOTICE_HOURS: '0'`, but its test windows are far enough in the future that this regression is not detected.

**Slotflow rule:** zero is a valid value where the configuration permits it; distinguish `NaN`/missing from `0`.

### 5. All-day busy events are intentionally ignored — ADAPT

Both implementation and tests explicitly ignore all-day events as neither availability nor busy time.

For an appointment business, an all-day event such as `休業`, `出張`, or `休暇` may need to block the entire day.

**Slotflow rule:** define all-day semantics explicitly. On configured occupancy calendars, opaque all-day closures should be testable as blocking events.

### 6. Positive "availability events" are the base model — REJECT for Slotflow

The reference requires specially named calendar events to open bookable windows.

**Slotflow rule:** use configured weekly business hours as the base window, then subtract Calendar occupancy. This better matches small-business operation and avoids filling the owner's calendar with synthetic availability events.

### 7. Double-booking protection via Sheet + LockService is a useful pattern — ADAPT

The reference correctly recognizes Calendar read-after-write lag and checks a Sheet ledger under `LockService` before creating a booking.

**Slotflow rule:** keep the idea, but formalize a `pending -> confirmed` transaction state and idempotency key instead of relying only on a final confirmed row.

### 8. Create flow can leave an orphan Calendar event — REJECT as final behavior

The create path creates the Calendar event before appending the booking row. If the Sheet write fails after Calendar creation, the Calendar event can remain without a corresponding ledger record.

The current reconciliation primarily finds confirmed ledger rows whose Calendar event disappeared; it does not inherently reconstruct a missing ledger row from an orphan event.

**Slotflow rule:** every cross-system mutation must leave a detectable recovery state and reconciliation must consider both drift directions.

### 9. Cancellation can report success after Calendar deletion failure — REJECT

`handleCancelBooking` catches/logs Calendar deletion errors, then still marks the Sheet row `cancelled`, sends cancellation email, and returns success.

That can tell the customer a booking is cancelled while the Calendar event remains and still blocks time.

**Slotflow rule:** do not convert a failed Calendar mutation into a clean success. Use recovery-needed state/retry or return a controlled failure.

### 10. Reschedule deletes the old event before the new event is safely committed — REJECT

The reschedule flow deletes the old Calendar event, then creates the new event and writes the new ledger row. If new-event creation or a later write fails, the original appointment has already been removed.

**Slotflow rule:** design reschedule as an explicit recoverable transaction; never destroy the only valid booking before the replacement is safely established or recoverable.

### 11. Reconciliation is conservative but mainly one-directional — ADAPT

`Reconcile.gs` safely avoids cancelling fresh/unverifiable rows and reconciles future confirmed rows whose event is provably gone. This fail-closed approach is useful.

However Slotflow must also address:

- orphan Slotflow Calendar event with no ledger row
- moved event whose metadata association is lost
- cancellation where Calendar delete failed
- reschedule partial failure

### 12. Rate limiting is best-effort and client-controlled — ADAPT

The code acknowledges that CacheService read/modify/write counters are non-atomic. Per-client limiting uses a client-provided `clientId`; a determined caller can rotate identifiers and email addresses.

**Slotflow rule:** use this only as abuse friction, never as an authentication or integrity boundary. Idempotency and booking locks protect correctness independently.

### 13. Tests exist, but normal regression CI is not enforced — REJECT as project process

The repository has useful backend/frontend/E2E test files, but its checked-in GitHub Actions workflows are maintenance cleanup and secret scanning rather than a normal test workflow for every change.

**Slotflow rule:** test CI must exist before calendar booking implementation (#4).

### 14. Hard-coded quota assumptions can become stale — REJECT

The health response hard-codes `daily_email_limit: 50`, while Google service quotas vary by account type and can change.

**Slotflow rule:** do not encode mutable provider quotas as authoritative product constants. Detect/monitor actual errors and document provider limits as external constraints.

## Patterns worth reusing conceptually

- `LockService` around the critical booking section — **ADAPT**
- ledger overlap guard to bridge Calendar propagation lag — **ADAPT**
- fail-closed ghost detection — **ADAPT**
- expiring cancellation/reschedule tokens — **ADAPT**
- reconciliation job — **ADAPT**
- secret scanning — **ADOPT**
- static frontend + low-cost Google backend for a first-store pilot — **ADAPT**

## Regression checklist before borrowing any code

- concurrent same-slot booking
- same request retried twice
- `MIN_NOTICE_HOURS = 0`
- all-day closure
- transparent vs opaque event
- cancelled/declined events
- device timezone differs from store timezone
- DST transition in a non-Japan test zone
- Calendar create succeeds / ledger write fails
- ledger pending succeeds / Calendar create fails
- Calendar cancel/delete fails
- reschedule fails after the old booking exists
- owner manually creates/moves/deletes an event
- orphan calendar event and stale ledger row

## Decision rule

No reference implementation code should enter Slotflow production logic unless its behavior is understood, independently tested, and compatible with Slotflow's simpler single-owner/single-location product model. Track this work in issue #2.
