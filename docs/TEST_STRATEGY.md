# Test Strategy

Slotflow tests follow the actual MVP: Google Calendar read/display plus customer read-only availability. There is no customer booking transaction flow.

## 1. Calendar event normalization

Cover:

- timed events;
- opaque vs transparent events;
- cancelled events;
- one-day and multi-day all-day events;
- explicit store timezone handling;
- device timezone differing from store timezone;
- malformed timestamps/provider errors;
- overlapping events.

## 2. Owner dashboard derivation

Cover:

- next appointment;
- today's ordered schedule;
- free-gap calculation inside configured business hours;
- adjacent events;
- day rollover;
- empty day;
- Calendar read failure is not shown as an empty/free schedule.

## 3. Customer availability derivation

Cover:

- availability = business hours minus Calendar occupancy;
- service duration must fit before a start time is exposed;
- date-level ○ / △ / × status;
- selected-date startable times/ranges;
- all-day closures;
- transparent/cancelled events do not block;
- store timezone is authoritative;
- provider/config failure never appears as free availability.

## 4. Privacy/access

Cover:

- customer output contains no appointment titles, descriptions, attendees, names, contacts or raw Calendar objects;
- OAuth access/refresh tokens and client secrets are never exposed client-side;
- owner schedule endpoint remains appropriately restricted;
- customer UI exposes only derived availability.

## 5. Client behavior

Cover:

- stale availability responses cannot overwrite the latest selection;
- changing service/date clears stale selected times;
- phone CTA uses the configured `tel:` destination;
- no customer name/contact or online-confirmation form exists;
- no customer code path can insert/update/delete Calendar events.

## 6. CI

Fast tests and Markdown/link checks should run on every PR/push.

## Explicitly unnecessary for the MVP

Do not build tests for components that are intentionally absent:

- concurrent customer booking writes;
- idempotent write retry / request IDs;
- `LockService` booking transactions;
- Calendar insert/update/delete from customer UI;
- Sheets booking ledger or reconciliation;
- online cancellation/reschedule.

## Provider contract checks

A small isolated Google-service test may verify runtime assumptions mocks cannot prove, such as Calendar event fields, all-day date semantics, permissions/auth failures and deployed Apps Script behavior.
