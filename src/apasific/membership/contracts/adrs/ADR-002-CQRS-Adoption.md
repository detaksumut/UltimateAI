# ADR-002: CQRS Adoption

**Status:** Accepted
**Date:** 2026-07-10

## Context
The Membership platform handles complex business rules for state mutations (role granting, verifications) but also requires high-performance reads for the public directory and dashboards.

## Decision
We adopt Command Query Responsibility Segregation (CQRS) at the Application Layer.
- **Commands:** Mutate state. Always load the full Aggregate Root to enforce invariants.
- **Queries:** Read state. Bypass the Aggregate Root and query the database (or a Read Model/Projection) directly for performance.

## Consequences
- **Positive:** Read and write workloads can scale independently. Domain models remain pure and untainted by UI data requirements.
- **Negative:** Increased initial boilerplate (Commands, Queries, separate Handlers).
