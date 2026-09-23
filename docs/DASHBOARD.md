# Android dashboard pilot

The owner dashboard is a single read-only screen in the same Apps Script project as the
Calendar adapter. `doGet()` serves HTML only. After the shell loads, the page calls
`getDashboardSchedule()` asynchronously with `google.script.run`; there is no JSON HTTP
endpoint and Calendar/OAuth access remains on the server.

## Deploy securely

1. Configure the Calendar adapter as described in [CALENDAR_READ_ADAPTER.md](CALENDAR_READ_ADAPTER.md).
2. For the preferred pilot model, deploy the Apps Script project as a **Web app** with
   **Execute as: User accessing the web app**. Require a signed-in Google user and restrict
   **Who has access** to the intended store-owner account(s).
3. The accessing store-owner account must have permission to the configured private
   Calendar. Calendar OAuth remains server-side, and another signed-in user without that
   Calendar permission must not be able to read its schedule.
4. As a single-owner alternative, the actual store owner may deploy the script from their
   own Google account with owner-only access. Never combine **Execute as: deploying user**
   with broad or anonymous access: Calendar reads could then run with the deployer's
   authority. Never use anonymous/public access for this private dashboard.
5. Open the deployment URL while signed in on the dedicated Android tablet.

Do not put OAuth access/refresh tokens, Calendar credentials, or secrets in browser code,
query strings, or localStorage. The only localStorage entry is the last successful,
normalized dashboard response under `slotflow.dashboard.schedule.v1`; it contains only the
display fields returned by the adapter.

## Runtime behavior

On startup, a structurally valid same-store-day cached response is painted immediately and
labeled as saved/stale data. A prior-day cache is retained but is never displayed as today's
schedule. A live request starts in the background. Success replaces the display and cache
and marks it `最新`; failure preserves usable same-day data and marks the refresh failed.
Provider failure is never rendered as an empty schedule. The dashboard refreshes every 30
seconds and whenever it becomes visible, while preventing overlapping requests. The clock
updates locally, but every displayed date/time explicitly uses the store IANA timezone from
the successful response rather than the tablet timezone.

Calendar event titles are inserted with `textContent`. The dashboard displays normalized
titles and intervals only—never descriptions, attendees, organizers, provider objects, or
credentials. It provides no create, edit, or delete controls; operations remain in Calendar.

## Android and PWA limitation

Use Chrome's **Add to Home screen** shortcut where available and open the authenticated web
app directly. This pilot intentionally does not register a service worker or claim
standards-complete PWA installation: Apps Script HTML Service runs the page in a sandboxed,
Google-hosted frame/deployment environment where a stable app-owned service-worker scope and
manifest lifecycle are not reliable. A true installable/offline shell requires a later
hosting/transport decision and must not be achieved by making schedule data public.
