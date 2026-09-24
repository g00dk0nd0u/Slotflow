# Customer booking Apps Script

`apps-script-customer/` is a separate Apps Script project from the owner dashboard. It serves a small Japanese mobile booking page through HTML Service and calls server functions with `google.script.run`.

## Configuration

Set these Script Properties on the customer project:

- `SLOTFLOW_CALENDAR_ID`: the private operational Calendar ID.
- `SLOTFLOW_STORE_TIMEZONE`: an explicit IANA timezone, initially `Asia/Tokyo`.
- `SLOTFLOW_BUSINESS_HOURS_JSON`: weekday (`0` Sunday through `6` Saturday) to local-time ranges, for example `{"1":[{"start":"09:00","end":"18:00"}]}`.

The server-owned service catalog currently contains one 60-minute `standard` service. Availability is generated every 30 minutes, at most 60 days ahead. Change these rules in `Config.gs`, not in the browser.

## Request flow

1. `getAvailability` validates the service and date, expands configured business hours in the store timezone, reads Calendar occupancy, and returns only normalized start/end instants.
2. `createBooking` validates the name, optional contact, service, start instant, and request ID.
3. It acquires the script lock, looks for an existing event with the same private `requestId`, re-reads availability, and rejects a stale/conflicting slot.
4. It inserts the Calendar event with `slotflowRequestId` and `slotflowServiceId` in `extendedProperties.private`, then returns a small confirmation. The browser keeps that request ID across an ambiguous transport failure. The lock is released on every path. No Sheet or secondary ledger is used.

## Deployment boundary

Deploy this directory independently from `apps-script/`. Apps Script web-app deployment can run as the deploying user or the accessing user, and access can be restricted to different audiences. **This change does not choose or broaden those settings.** Select and review the pilot authentication/access policy explicitly before a live deployment; production anonymous-access hardening remains a later decision.

The Calendar must stay private. Only the booking server receives its ID and Calendar authorization. Availability never includes event titles, descriptions, attendees, customer details, or raw Calendar objects.
