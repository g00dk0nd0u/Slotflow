# Calendar read adapter operations

Issue #5 adds a read-only, server-side Google Apps Script adapter. Google Calendar remains
the operational source of truth: owner add, move, delete, block and closure operations are
performed in Calendar and appear on the next successful read. There is no booking ledger.

## Setup

Create an Apps Script project from `apps-script/`, enable the manifest file in project
settings, and ensure the manifest-declared **Google Calendar API advanced service** is
enabled. Set these Script Properties (never source-code or frontend configuration):

| Property | Example | Meaning |
| --- | --- | --- |
| `SLOTFLOW_CALENDAR_ID` | `store-calendar@group.calendar.google.com` | Private store Calendar ID |
| `SLOTFLOW_STORE_TIMEZONE` | `Asia/Tokyo` | Store IANA timezone |
| `SLOTFLOW_BUSINESS_HOURS_JSON` | `{"1":[{"start":"09:00","end":"18:00"}]}` | Weekly hours; keys `0`–`6` are Sunday–Saturday |

Missing/invalid configuration and Calendar authorization, quota, service, or response
failures return an explicit `ok: false` result. The implementation does not fall back to
`CalendarApp`, because doing so would lose required Calendar semantics.

## Calling and response

Invoke `getDashboardSchedule()` from trusted server-side Apps Script code. It is a callable
function, **not a public HTTP API**, and no `doGet`/`doPost` endpoint is provided. Issue #6
will choose an authenticated transport without sending OAuth tokens to the dashboard.

Successful results have this shape (timed values are ISO-8601 UTC instants; all-day values
are half-open store-local dates):

```json
{
  "ok": true,
  "generatedAt": "2026-09-23T02:00:00.000Z",
  "timezone": "Asia/Tokyo",
  "storeLocalDate": "2026-09-23",
  "today": {
    "allDayEvents": [{"id":"closure","title":"Closed","start":"2026-09-23","end":"2026-09-24","allDay":true,"busy":true}],
    "timedEvents": [],
    "currentOrNextEvent": null,
    "freeGaps": [{"start":"2026-09-23T00:00:00.000Z","end":"2026-09-23T09:00:00.000Z"}]
  },
  "upcomingEvents": []
}
```

Only `id`, title, interval, `allDay`, and derived `busy` are exposed. Attendees,
organizers, descriptions, credentials, and raw provider objects are not returned or logged.
Cancelled and transparent events are non-busy. Opaque timed events occupy time; opaque
all-day events block `[start.date, end.date)`. Busy overlaps and adjacent intervals merge
before free gaps are calculated inside the configured hours.
