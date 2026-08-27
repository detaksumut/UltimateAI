# ADR-012: Minimal Transaction Boundary

**Status:** Accepted
**Date:** 2026-07-10

## Context
In monolithic or poorly bounded applications, it is common to place external side effects (like sending emails, calling third-party REST APIs, or publishing to Kafka) directly inside the database transaction that saves the core domain aggregate. This breaks the transaction if the external service fails, creating tight coupling and poor reliability.

## Decision
We mandate the **Minimal Transaction Boundary** pattern for all CQRS Command Handlers in APASIFIC.
A database transaction MUST ONLY encompass:
1. Loading the Aggregate.
2. Saving the mutated Aggregate to its repository.
3. Inserting Domain Events into a Transactional Outbox table.

**Prohibited inside Transactions:**
- Publishing directly to Kafka/EventBus.
- Calling external APIs (e.g., DOI provider, Notification Service).
- Performing File/Storage I/O.

## Consequences
- **Positive:** Maximum transaction reliability. If the DB commits, the business state and its resulting events are definitively saved. Asynchronous workers will handle the Outbox processing and eventual consistency.
- **Negative:** Requires robust Infrastructure layer implementation (Transactional Outbox Poller/CDC) to guarantee events are eventually dispatched.

**Supersedes:** None
**Related ADRs:** ADR-002 (CQRS Adoption)
