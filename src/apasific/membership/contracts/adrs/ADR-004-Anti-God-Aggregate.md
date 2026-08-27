# ADR-004: Anti-God Aggregate Rule

**Status:** Accepted
**Date:** 2026-07-10

## Context
The `Member` entity naturally attracts dependencies from all over the system (e.g., Journal Submissions, Payment History, Conference Tickets). If added to the `Member` aggregate, it will become a "God Aggregate," leading to massive performance bottlenecks and transaction conflicts.

## Decision
The `Member` aggregate in the Membership Domain is strictly limited to Identity, Authentication Status, and Roles. Any external domain data must reside in its own Bounded Context and reference the `MemberID` as a foreign key.

## Consequences
- **Positive:** Keeps the Membership database small, extremely fast, and highly concurrent.
- **Negative:** UI dashboards requiring a full "User History" must query multiple APIs/Read Models and stitch the data together (API Gateway/BFF pattern).
