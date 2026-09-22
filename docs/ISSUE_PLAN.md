# Issue Plan

The implementation order is intentionally front-loaded with architecture and regression work.

1. **#1 — MVP roadmap and release contract**  
   Parent issue / release definition.

2. **#2 — Audit ContextLab/scheduler before reusing any implementation**  
   Reproduce known reference-repository failure patterns and record adopt/adapt/reject decisions.

3. **#3 — Define booking state model and source-of-truth rules**  
   Freeze Calendar occupancy semantics, ledger states, failure recovery, timezone, business hours and all-day behavior.

4. **#4 — Build test harness and CI before calendar implementation**  
   Regression safety net before production logic.

5. **#5 — Implement Google Calendar + Apps Script booking core**  
   Depends on #3 and #4.

6. **#6 — Build instant-access Android owner dashboard PWA**  
   Fixture UI can start early; live integration depends on #5.

7. **#7 — Build generic customer booking web flow**  
   Depends on #5.

8. **#8 — Add LINE entry point without requiring a webhook**  
   Rich menu / LIFF entry on top of #7.

9. **#9 — Design secure LINE Messaging API webhook path**  
   Deferred until conversational automation is required; do not block MVP.

10. **#10 — Plan zero-friction Google onboarding for non-technical store owners**  
    Separates pilot deployment from managed SaaS productization.

11. **#11 — Hardening, quota validation and first-store pilot**  
    Depends on the core, owner dashboard and customer flow.

## Critical path

`#2 + #3 -> #4 -> #5 -> (#6 + #7) -> #8 -> #11`

`#9` and the managed-service portion of `#10` are not required to prove the first-store workflow.
