# APASIFIC Engineering Blueprint

This Blueprint dictates the structural laws of software engineering within the APASIFIC Ecosystem.

## 1. Dependency Rule
Code dependencies can only point **inward**.
`UI` -> `API` -> `Application` -> `Domain`
`Infrastructure` -> `Application`

## 2. CQRS (Command Query Responsibility Segregation)
- **Commands:** Mutate state. Always load the full Aggregate Root to enforce invariants. Execute exactly one transaction.
- **Queries:** Read state. Bypass Aggregates entirely; read directly from views or projections for raw speed.

## 3. Domain-Driven Design (DDD)
- **Aggregates:** Must not become "God Objects". Business rules belong here, not in Handlers.
- **Value Objects:** Primitives with rules (Email, Token, IDs) must be Value Objects.
- **Domain Services:** Hold logic spanning multiple Aggregates.

## 4. Eventing Strategy
- **Domain Events:** In-memory, handled within the same transaction to orchestrate side-effects within the bounded context.
- **Integration Events:** Published externally via Outbox Pattern. Wraps payloads in an Enterprise Envelope (TraceID, CorrelationID, Version).

## 5. API-First Development
No Frontend code is written until the OpenAPI contract is approved. The Backend generates the OpenAPI spec from the API Layer.

## 6. Strict UI Presentation Pattern
Raw JSON from APIs is forbidden in React components.
Flow: `OpenAPI DTO` -> `ViewModel Mapper` -> `React Hook` -> `React Component`.
