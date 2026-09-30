# Current scope and next steps

This page distinguishes the implemented customer MVP from optional future work. Google Calendar remains the operational schedule; Slotflow only reads it.

## Implemented customer MVP

- A private owner Apps Script deployment reads Calendar and renders an Android-friendly schedule dashboard.
- A separate customer Apps Script deployment derives privacy-minimized availability from business hours, service duration and Calendar occupancy.
- Services may use one duration or a list of options with their own durations.
- The customer calendar covers six Sunday-first weeks: three are initially visible and three can be revealed or collapsed. It refreshes while visible and on visibility return, rolls its store-local window across midnight, and preserves valid selection/scroll state during background refresh.
- Reservations are confirmed by phone and entered into Google Calendar by the manager.
- A LINE Official Account rich-menu or profile link may open the same customer page; LINE setup is external to this repository.
- Regression tests and CI cover schedule derivation, availability, configuration, privacy-sensitive response shaping and client refresh behavior.

## Pilot operations

- Keep the owner deployment authenticated and restricted to intended owner accounts.
- Expose only the separate customer deployment, whose responses contain derived availability rather than event details.
- Validate the configured store timezone, business hours, services, phone number and Calendar permissions.
- Verify the deployed pages on the target Android tablet, mobile browser and LINE in-app browser.
- Monitor Calendar API quotas and treat provider/configuration failures as unavailable, never as free time.

## Future product decisions

These are not implemented commitments:

- managed onboarding with central OAuth, calendar selection and store configuration;
- a separately hosted installable/offline owner application;
- conversational LINE automation;
- customer online booking or Calendar writes;
- multi-location or multi-staff resource scheduling;
- payments, POS, inventory, payroll or CRM features.

Any customer write path would require a new product and security design, including concurrency, idempotency, lifecycle and reconciliation decisions. It must not be inferred from the current read-only MVP.
