# ADR-007: API-First Development

**Status:** Accepted
**Date:** 2026-07-10

## Context
Decoupling Frontend and Backend development requires a strict, shared contract. If the Backend implements endpoints without a contract, the Frontend breaks silently. 

## Decision
We enforce API-First Development using OpenAPI as the single source of truth.
- The workflow is strictly: API Contract -> OpenAPI Generation -> Contract Validation -> REST Controller & Frontend UI.
- The Frontend must only consume Data Transfer Objects (DTOs) and map them to ViewModels. Raw Domain Entities are strictly forbidden from leaking to the UI.

## Consequences
- **Positive:** Zero integration friction. Both teams can mock and work in parallel once the contract is frozen.
- **Negative:** Requires strict discipline. Developers cannot just "add a field" to an endpoint without updating the OpenAPI spec first.

**Supersedes:** None
**Related ADRs:** ADR-004 (Anti-God Aggregate)
