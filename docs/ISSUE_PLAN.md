# Issue Plan

Slotflow now follows a Calendar-first implementation order.

## Product rule

The store manager operates almost entirely in Google Calendar. Slotflow should first become a clear, always-ready display of that Calendar, then later add customer booking into it.

## Order

1. **#2 — Audit ContextLab/scheduler before reusing any implementation**  
   Complete. Keep as reference material only.

2. **#5 — Implement Google Calendar read adapter for the owner dashboard**  
   Small read path only. No Sheets/state machine. Protect the private Calendar behind an authenticated/minimally exposed dashboard API.

3. **#6 — Build instant-access Android Calendar dashboard PWA**  
   Can prototype with fixtures immediately; connects to #5.

4. **#4 — Add lightweight CI/tests for Calendar read + dashboard**  
   Runs alongside #5/#6; do not block the read-only milestone on future booking-write architecture.

5. **#3 — Define minimal safeguards for customer booking writes**  
   Deferred until customer booking is about to be implemented.

6. **#7 — Add minimal customer booking flow that writes to Google Calendar**  
   Re-check availability, write Calendar event, protect against duplicate writes.

7. **#8 — Add LINE entry point without requiring a webhook**  
   Rich menu / LIFF entry on top of #7.

8. **#10 — Plan zero-friction Google onboarding for non-technical store owners**

9. **#11 — Hardening, quota validation and first-store pilot**

10. **#9 — Secure conversational LINE webhook**  
    Deferred until chat automation is actually required and depends on the customer booking path, not the read-only Calendar adapter.

## Critical path

First useful product:

`#5 + #6 + lightweight #4`

Then customer booking:

`#3 -> #7 -> #8`

Then productization/pilot:

`#10 -> #11`

The first useful product does **not** depend on a booking ledger, transaction state machine or LINE integration.
