# ADR-001: Canonical Identity (MemberID vs AcademicID)

**Status:** Accepted
**Date:** 2026-07-10

## Context
APASIFIC requires a unified identity system across multiple bounded contexts (Journal, Certification, etc.). Using a single ID for both internal database references and public-facing profiles poses security and coupling risks.

## Decision
We split identity into two layers:
1. `MemberID` (e.g., APA-2026-00001234): The internal, immutable, canonical system identifier used as primary/foreign keys across all databases. Never exposed externally.
2. `AcademicID` (e.g., APA-ID-001248): The public-facing identifier used on certificates, public profiles, and digital cards.

## Consequences
- **Positive:** Improved security (internal keys are hidden). Flexibility to regenerate or migrate public IDs without breaking internal foreign key constraints.
- **Negative:** Requires mapping layers and slightly more complex queries when searching by public ID.
