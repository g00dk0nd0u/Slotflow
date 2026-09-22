# Reference Repository Audit

Primary reference: `ContextLab/scheduler`

## Why audit first

The reference project is architecturally close to Slotflow, but recent history shows important fixes around Google Calendar Advanced Service activation, calendar/sheet consistency, double-booking prevention, reconciliation, and maintenance-key handling. Slotflow should therefore treat it as a source of patterns, not as trusted production code.

## Audit checklist

### Calendar correctness
- Availability window detection
- Busy/free transparency handling
- Cancelled and declined events
- All-day events
- Timezone and daylight-saving behavior
- Read-after-write consistency
- Manual calendar edits

### Booking integrity
- Two simultaneous requests for the same slot
- Reschedule collision
- Cancellation followed by immediate rebooking
- Calendar event created but metadata write fails
- Metadata written but calendar event fails
- Ghost/stale bookings

### Security
- Secrets never placed in URLs
- Public endpoints expose only necessary data
- Booking tokens are unguessable and expire appropriately
- Input validation and sanitization
- Abuse/rate limiting
- LINE webhook signature verification when added

### GAS / Google limits
- Execution time
- Calendar API quotas
- Mail quotas
- CacheService behavior
- LockService contention
- Sheets growth/performance

### Testing
- Unit tests for pure availability logic
- Integration tests for request handlers
- Race-condition tests
- Timezone edge cases
- Regression tests for every imported reference pattern

## Decision rule

No reference implementation code should be copied into Slotflow unless its behavior is understood, independently tested, and compatible with Slotflow's simpler single-owner/single-location model.
