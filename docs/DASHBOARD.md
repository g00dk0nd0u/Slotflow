# Android dashboard pilot

The owner dashboard is a single read-only screen in the same Apps Script project as the
Calendar adapter. `doGet()` serves HTML only. After the shell loads, the page calls
`getDashboardSchedule()` asynchronously with `google.script.run`; there is no JSON HTTP
endpoint and Calendar/OAuth access remains on the server.

## Deploy securely

1. Configure the Calendar adapter as described in [CALENDAR_READ_ADAPTER.md](CALENDAR_READ_ADAPTER.md).
2. Deploy the Apps Script project as a **Web app** whose executing account can read the
   configured Calendar.
3. Restrict **Who has access** to the intended signed-in store-owner account(s). Never use
   anonymous/public access for a private schedule dashboard.
4. Open the deployment URL while signed in on the dedicated Android tablet.

Do not put OAuth access/refresh tokens, Calendar credentials, or secrets in browser code,
query strings, or localStorage. The only localStorage entry is the last successful,
normalized dashboard response under `slotflow.dashboard.schedule.v1`; it contains only the
display fields returned by the adapter.

## Runtime behavior

On startup, a structurally valid cached response is painted immediately and labeled as
saved/stale data. A live request starts in the background. Success replaces the display and
cache and marks it `最新`; failure preserves the previous view and marks it offline/stale.
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
