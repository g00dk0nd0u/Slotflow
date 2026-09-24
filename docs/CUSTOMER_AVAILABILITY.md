# Customer availability Apps Script

`apps-script-customer/` is the customer-facing read-only availability surface. It is separate from the private owner dashboard and must not create or modify appointments.

## Operating flow

1. The manager maintains the real schedule in Google Calendar.
2. Slotflow reads Calendar occupancy server-side.
3. The customer selects a service/date and sees only derived availability.
4. The customer taps **電話で確認する**.
5. The manager confirms the reservation by phone and enters it into Google Calendar.
6. Availability reflects the new Calendar occupancy on refresh.

## Configuration

The customer service needs server-side configuration for at least:

- private operational Calendar ID;
- explicit store timezone;
- business hours;
- service name/duration;
- store phone number.

Use least-privilege Calendar **read** access.

## Availability contract

Customer-visible data may include:

- service display metadata;
- date-level availability status such as ○ / △ / ×;
- startable times/ranges for the selected service duration;
- store timezone.

It must never include appointment titles, names, contacts, descriptions, attendees, raw Calendar objects, Calendar credentials or OAuth tokens.

Provider/config failure must be shown as unavailable/error, never as free time.

## UI

The target mobile UI is intentionally small:

- brand/store header;
- service selection;
- compact calendar;
- ○ / △ / × availability;
- selected-date startable times/ranges;
- `tel:` CTA labeled **電話で確認する**.

There is no customer account, name/contact form, online confirmation button, cancellation/reschedule flow or customer-side Calendar mutation.

## PR #19 cleanup

PR #19 introduced an online Calendar-write experiment based on a superseded product assumption. Issue #7 owns the corrective change: retain useful read-only availability logic and remove write scope, `createBooking`, customer forms, LockService/idempotency/fingerprint logic and Calendar insert behavior.
