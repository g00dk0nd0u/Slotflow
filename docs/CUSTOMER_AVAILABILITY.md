# Customer availability Apps Script

`apps-script-customer/` is the customer-facing read-only availability surface. It is separate from the private owner dashboard and must not create or modify appointments.

## Operating flow

1. The manager maintains the real schedule in Google Calendar.
2. Slotflow reads Calendar occupancy server-side.
3. The customer selects a service, any configured option, and a date, then sees only derived availability.
4. The customer taps **電話で確認する**.
5. The manager confirms the reservation by phone and enters it into Google Calendar.
6. Availability reflects the new Calendar occupancy on refresh.

## Configuration

The customer service needs server-side configuration for at least:

- private operational Calendar ID;
- explicit store timezone;
- business hours;
- service name/duration, optionally split into service-specific options;
- store phone number.

Script Properties are authoritative and use these keys:

- `SLOTFLOW_CALENDAR_ID`: private operational Calendar ID;
- `SLOTFLOW_STORE_NAME`: customer-visible store/brand name;
- `SLOTFLOW_STORE_PHONE`: customer-visible phone number used by the `tel:` action;
- `SLOTFLOW_STORE_TIMEZONE`: IANA timezone such as `Asia/Tokyo`;
- `SLOTFLOW_BUSINESS_HOURS_JSON`: weekday (`0` = Sunday through `6` = Saturday) to opening-range arrays;
- `SLOTFLOW_SERVICES_JSON`: array of services. Each service must use exactly one of these shapes:
  - legacy `{ "id": "cut", "name": "カット", "durationMinutes": 60 }`;
  - option-bearing `{ "id": "cut-color", "name": "カット＋カラー", "options": [{ "id": "short", "name": "ショート", "durationMinutes": 90 }] }`.

An option-bearing service must have at least one option. Service IDs must be unique globally, and option IDs must be unique within their service. Durations remain server-side configuration: the browser sends only `serviceId` and, when required, `optionId`. Unknown, missing, or mismatched selections are rejected rather than treated as available time.

Existing legacy service configuration needs no migration. To add options, replace that service's `durationMinutes` with a non-empty `options` array; do not keep both fields. The sample names and durations above illustrate the schema only—set production values in Script Properties for the actual business.

Use the least-privilege Calendar Events **read-only** OAuth scope,
`https://www.googleapis.com/auth/calendar.events.readonly`.

## Availability contract

Customer-visible data may include:

- service and option display metadata (not configured durations);
- date-level availability status such as ○ / △ / ×;
- startable times/ranges for the selected service duration;
- store timezone.

It must never include appointment titles, names, contacts, descriptions, attendees, raw Calendar objects, Calendar credentials or OAuth tokens.

Provider/config failure must be shown as unavailable/error, never as free time.

## UI

The target mobile UI is intentionally small:

- brand/store header;
- service selection and a dynamically populated option selector;
- Sunday-first calendar covering six full weeks (42 days) from the current store-local week, with later weeks collapsed by default;
- past dates remain visible but disabled and are never requested from the server;
- dynamic month headings when the six-week window crosses month boundaries;
- ○ / △ / × availability;
- selected-date startable times/ranges;
- `tel:` CTA labeled **電話で確認する**;
- background refresh every 60 seconds while visible, plus refresh when the page becomes visible again;
- preservation of the selected date and scroll position during background refresh when still valid.

There is no customer account, name/contact form, online confirmation button, cancellation/reschedule flow or customer-side Calendar mutation.
