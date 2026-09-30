# Current issue map

This is a concise map of the issues that define or refine the customer MVP. “Implemented” means the repository behavior has been merged; it does not by itself mean that deployment-specific or smartphone acceptance has completed.

| Issue | Current role | Repository status | Live verification |
| --- | --- | --- | --- |
| #7 | Customer read-only availability and phone handoff | Implemented and merged | Deployment configuration and target-device checks remain store-specific |
| #8 | LINE Official Account entry to the availability page | Normal HTTPS-link approach and setup guidance are merged; no LINE runtime integration is required | Smartphone LINE rich-menu, in-app browser and phone-handoff acceptance remain pending for the pilot |
| #11 | Hardening and first-store pilot | Repository safeguards and test coverage are present; this issue remains the umbrella for operational validation | Quota, permissions, privacy, device behavior and first-store operation require live verification |
| #29 | Configurable service × option duration and availability model | Implemented, merged and deployed with test configuration | Compare short/medium/long options within the same service, then replace the test values with the real pilot duration matrix |
| #32 | Cross-month calendar heading and expanded-layout correction | Implemented and merged | Expanded-calendar visual verification in the target browser remains pending |
| #34 | Preserve a valid selected date during availability reloads | Implemented and merged | Covered by automated client tests |
| #36 | Automatic customer availability refresh, including visibility return and day rollover | Implemented and merged | Covered by automated client tests; deployed timing/provider behavior remains part of pilot observation |
| #38 | Consolidate repository documentation after customer MVP stabilization | Documentation cleanup is in progress in PR #39 | Documentation review is the remaining acceptance step |
| #40 | Narrow the owner deployment's current `calendar.readonly` OAuth scope | Not part of PR #39; the owner runtime remains unchanged | Reauthorization and owner-dashboard verification belong to #40 |

## Reading the map

- Current product and operational guidance lives in [Architecture](ARCHITECTURE.md), [Current scope and next steps](ROADMAP.md), and the deployment-specific guides.
- Issue status never substitutes for the smartphone and store-environment checks in [LINE entry](LINE_ENTRY.md) and [Android owner dashboard](DASHBOARD.md).
- Historical issue assignments in [Reference repository audit](REFERENCE_AUDIT.md) are research context, not this map's current plan.
