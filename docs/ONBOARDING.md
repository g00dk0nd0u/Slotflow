# Google Calendar onboarding

This document defines the onboarding path for Slotflow from the current developer-assisted pilot to a managed service that a non-technical store owner can connect without creating Google Cloud credentials or deploying Apps Script.

## Product constraint

Google Calendar remains the operational source of truth.

Slotflow only needs to read it:

- owner dashboard: show the manager's schedule;
- customer page: derive and expose availability only.

Actual reservations are confirmed by phone and entered by the manager in Google Calendar. The onboarding design must therefore stay read-only.

## Decision

Use two deployment stages.

### Stage 1 — current pilot / OSS

Keep the current per-store Apps Script approach for the first pilot.

Developer-assisted setup is acceptable while validating the workflow:

1. Create the owner/private Apps Script deployment.
2. Create the separate customer availability Apps Script deployment.
3. Enable Calendar advanced service.
4. Set Script Properties for calendar ID, timezone, business hours, services, store name and phone number.
5. Authorize the read-only Calendar scope.
6. Keep the owner dashboard private.
7. If the Google account/deployment policy permits anonymous access, the customer availability web app may execute as the deploying owner and expose only derived availability.

This stage intentionally does **not** solve zero-friction onboarding. It minimizes infrastructure while product behavior is still being validated.

## Stage 2 — managed SaaS target

Replace per-store Apps Script setup with one centrally managed backend and one Google OAuth application.

The store owner flow should be:

```text
Open Slotflow
    ↓
Connect Google Calendar
    ↓
Google consent
    ↓
Choose store calendar
    ↓
Confirm timezone
    ↓
Set business hours
    ↓
Set services + duration
    ↓
Ready
```

The owner must not:

- create a Google Cloud project;
- create OAuth credentials;
- deploy Apps Script;
- copy a Calendar ID manually;
- edit Script Properties;
- understand APIs or tokens.

## OAuth model

Use the Google OAuth 2.0 web-server authorization-code flow.

Request offline access so the backend can refresh access tokens while the owner is not present.

Use a CSRF `state` value and verify the scopes actually granted before enabling Calendar-dependent features.

Recommended scopes:

- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
  - lets Slotflow present a calendar picker;
- `https://www.googleapis.com/auth/calendar.events.readonly`
  - lets Slotflow read event occupancy and owner-dashboard event details.

Do not request Calendar write scopes.

Do not broaden this to `calendar.readonly` unless a concrete feature requires it.

Official references:

- Google OAuth web-server flow: https://developers.google.com/identity/protocols/oauth2/web-server
- Calendar scopes: https://developers.google.com/workspace/calendar/api/auth
- Apps Script web apps: https://developers.google.com/apps-script/guides/web

## Calendar selection

After OAuth consent, list the owner's subscribed calendars and show a simple picker using Calendar List metadata such as:

- display name;
- primary flag;
- timezone;
- effective access role.

For the complete Slotflow experience, require an access role that allows event reads (`reader`, `writer` or `owner`). A `freeBusyReader` calendar is insufficient for the owner dashboard because event details are unavailable.

Store only the selected Calendar ID and the configuration needed by Slotflow.

The selected calendar's timezone can seed the store timezone, but the store timezone remains explicit and editable because business-hours calculations depend on it.

## Token handling

All OAuth credentials remain server-side.

- Never expose refresh tokens, access tokens or the OAuth client secret to the browser.
- Store refresh tokens encrypted at rest using the managed platform's secret/KMS capability.
- Keep tenant/store token records separated by internal store ID.
- Keep access tokens only as long as needed; refresh server-side.
- Do not log tokens or raw Authorization headers.
- Treat revoked/expired authorization as a disconnected state, never as empty/free availability.

## Public vs private data paths

### Owner dashboard

Requires authenticated owner access and may return the schedule details needed by that dashboard.

### Customer availability

May be public, but must return only derived information:

- service display metadata;
- date status (○ / △ / ×);
- startable times/ranges;
- public store metadata needed by the page.

It must never return raw Calendar event objects, titles, descriptions, attendees, customer information or OAuth material.

Both surfaces read from the same selected Google Calendar.

## Disconnect / reconnect

Provide three explicit owner actions:

1. **Change calendar** — keep the Google connection, choose another readable calendar.
2. **Reconnect Google** — redo consent if authorization is missing/invalid.
3. **Disconnect Google** — revoke/delete the stored credential and remove the selected calendar association.

After disconnect or auth failure:

- owner dashboard shows a disconnected/unavailable state;
- customer availability shows unavailable/error;
- neither surface may interpret failure as free time.

## Migration path from the pilot

The pilot configuration maps directly to the managed model:

| Pilot Script Property | Managed store setting |
| --- | --- |
| `SLOTFLOW_CALENDAR_ID` | selected Calendar ID |
| `SLOTFLOW_STORE_NAME` | store name |
| `SLOTFLOW_STORE_PHONE` | phone number |
| `SLOTFLOW_STORE_TIMEZONE` | store timezone |
| `SLOTFLOW_BUSINESS_HOURS_JSON` | business-hours configuration |
| `SLOTFLOW_SERVICES_JSON` | service configuration |

The availability semantics and UI do not need to change when the backend changes. Only authentication, token storage and configuration ownership move from per-store Apps Script to the managed backend.

## Backend recommendation

Do not build the managed backend until the pilot proves the workflow.

When it is needed, use a conventional server-side HTTPS runtime that supports:

- OAuth callback endpoints;
- encrypted secret storage;
- scheduled/on-demand token refresh;
- authenticated owner APIs;
- public availability APIs with strict response shaping.

A Google-hosted serverless runtime such as Cloud Run is a natural first candidate because the product already depends on Google Calendar, but the architecture should not depend on Cloud Run-specific behavior.

No separate appointment database is required. A small store/config/auth database is sufficient; Google Calendar remains the schedule source of truth.

## Acceptance criteria for Issue #10

Issue #10 is complete when:

- the pilot setup path is documented;
- the managed owner journey is documented;
- minimum OAuth scopes are explicit;
- token/security boundaries are explicit;
- disconnect/reconnect/calendar reselection are defined;
- migration from Script Properties to managed configuration is defined;
- no design requires customer Calendar writes or per-store OAuth credential creation.