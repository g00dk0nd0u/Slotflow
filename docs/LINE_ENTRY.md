# LINE entry point

## Decision

For the MVP, LINE is only an entry point to the existing read-only Slotflow availability page.

Use a normal HTTPS URL from the store's LINE Official Account rich menu. Do not add LIFF, a Messaging API webhook, a booking bot, or any customer Calendar-write path.

## Customer flow

```text
LINE Official Account
  -> tap 「空き状況を見る」
  -> Slotflow availability page
  -> service
  -> ○ / △ / × calendar
  -> startable times
  -> 「電話で確認する」
  -> manager confirms by phone
  -> manager enters appointment in Google Calendar
```

Google Calendar remains the schedule source of truth.

## Pilot setup

Use **LINE Official Account Manager** rather than the Messaging API for the pilot rich menu.

Recommended setup:

1. Create or edit the store's default rich menu in LINE Official Account Manager.
2. Add one clearly labeled tap area: `空き状況を見る`.
3. Set its action to open the deployed Slotflow customer availability HTTPS URL.
4. Keep the destination as the ordinary availability URL; do not add LINE-specific authentication or customer identifiers.
5. Publish the rich menu after the availability deployment is ready.

This path requires no webhook endpoint, channel access token, channel secret, LIFF app, or bot-server code in Slotflow.

## Browser behavior

A rich-menu URI action opens the configured URL in a browser from LINE. The normal pilot path should use the ordinary HTTPS URL and allow LINE's normal in-app browsing behavior.

Do not force an external browser unless testing later finds a concrete incompatibility. LINE supports URI options for external-browser behavior, but adding them without a need creates unnecessary platform-specific behavior.

Rich menus are a smartphone LINE feature; they are not displayed in LINE for desktop. Desktop LINE therefore is not an acceptance-test target for the rich-menu entry point.

## Phone handoff

The Slotflow page keeps the current server-configured `tel:` CTA labeled `電話で確認する`.

The LINE integration does not receive, relay, or store the customer's phone number. The web page simply hands the user to the device's phone handling through the existing link.

Actual booking remains verbal by phone, followed by manager entry in Google Calendar.

## Security boundary

The LINE entry point must not add secrets to the customer page.

For the MVP:

- no LINE channel access token in client code;
- no LINE channel secret in client code;
- no webhook;
- no LIFF ID requirement;
- no user ID collection;
- no customer form;
- no Calendar write permission;
- no appointment/customer details exposed through the availability response.

The linked page is the same read-only availability surface used by normal mobile browsers.

## Manual verification still required

Repository work alone cannot prove real LINE-client behavior. Before closing Issue #8, verify on a smartphone with the pilot LINE Official Account:

- the rich menu is visible;
- one tap on `空き状況を見る` opens the deployed Slotflow availability page;
- service/date/○△×/startable-time UI works in LINE's in-app browser;
- the page does not expose private Calendar details;
- `電話で確認する` hands off correctly to phone handling;
- returning from the phone flow leaves the availability page usable;
- the same availability URL still works in a normal mobile browser.

If an in-app-browser problem is found, fix that concrete compatibility issue first. Add LIFF only if a demonstrated requirement cannot be solved by the normal web page.

## Not part of this issue

- online reservation confirmation;
- customer Calendar writes;
- LINE Messaging API webhook;
- conversational bot;
- LIFF login/profile access;
- per-user rich menus;
- push messages;
- cancellation/reschedule;
- payments.
