# Issue Plan

Slotflow follows a Calendar-first, read-only customer MVP.

## Product rule

The store manager operates the real schedule entirely in Google Calendar. Slotflow has two read surfaces: an owner tablet schedule and a customer availability page. Actual reservations are confirmed by phone and entered by the manager in Google Calendar.

## Order

1. **#2 — Audit ContextLab/scheduler before reusing any implementation**  
   Complete. Reference material only.

2. **#5 — Implement Google Calendar read adapter for the owner dashboard**  
   Complete.

3. **#6 — Build instant-access Android Calendar dashboard PWA**  
   Complete.

4. **#4 — Add lightweight CI/tests for Calendar read + availability display**  
   Cover both owner display and customer read-only availability.

5. **#7 — Build customer read-only availability page with phone handoff**  
   Service -> ○/△/× -> startable times -> 電話で確認する. No Calendar writes.

6. **#8 — Add LINE entry point to the read-only availability page**  
   Rich menu/profile link on top of #7.

7. **#10 — Plan zero-friction Google Calendar read onboarding for non-technical store owners**

8. **#11 — Hardening, quota validation and first-store pilot**

9. **#9 — Conversational LINE availability**  
   Deferred until chat automation is proven useful.

## Superseded

**#3 — customer booking write safeguards** is not part of the MVP. It remains closed/not planned. A future online-booking product would require an explicit new product decision.

## Critical path

Owner foundation:

`#5 + #6`

Then safety net and customer availability:

`#4 + #7`

Then distribution/productization:

`#8 -> #10 -> #11`

The MVP does **not** depend on Calendar writes from customers, LockService, idempotent write tokens, a booking ledger or transaction state machine.
