# Architecture Decisions

## ADR-001: Single owner / single location first

The MVP optimizes for one owner operating one location. Multi-tenant and franchise concerns are intentionally deferred.

## ADR-002: Android tablet is the primary owner interface

The owner experience is optimized around an always-ready Android tablet dashboard. Opening the app should not be part of the daily workflow; the schedule should already be visible.

## ADR-003: Google Calendar is the operational calendar

Availability and appointments are represented in Google Calendar. Additional metadata may be kept separately for integrity, audit, cancellation, and reconciliation.

## ADR-004: LINE is customer-facing, not the source of truth

LINE Official Account / Messaging API / LIFF provides customer interaction. Booking correctness remains in the calendar/core booking layer.

## ADR-005: Reference repositories are patterns, not dependencies

Existing OSS is audited and selectively adapted. Slotflow does not initially fork a complete appointment system.
