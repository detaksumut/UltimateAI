# ADR-008: Strict UI Presentation Pattern

**Status:** Accepted
**Date:** 2026-07-10

## Context
Directly binding React Components to API JSON responses creates severe technical debt. If the Backend renames a field, the entire UI breaks unpredictably. It also leaks backend data shapes into presentation logic.

## Decision
We enforce a strict 5-stage UI mapping architecture:
`OpenAPI DTO` -> `Application DTO (Frontend Domain)` -> `ViewModel` -> `React Hook` -> `React Component (Page)`

1. **OpenAPI DTO:** Raw JSON response from the API.
2. **ViewModel:** A class or interface strictly containing only what the view needs (e.g., formatting dates, concatenating names).
3. **React Hook:** Manages state and maps the OpenAPI DTO into the ViewModel.
4. **React Component:** A dumb, pure function that only accepts the ViewModel.

## Consequences
- **Positive:** Decouples React from the API Contract. Allows Frontend Developers to mock ViewModels and build the entire UI before the Backend is ready.
- **Negative:** Increased boilerplate (Mappers, ViewModels) on the frontend.

**Supersedes:** None
**Related ADRs:** ADR-007 (API-First Development)
