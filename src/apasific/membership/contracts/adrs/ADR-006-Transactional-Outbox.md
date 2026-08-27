# ADR-006: Transactional Outbox Pattern

**Status:** Accepted
**Date:** 2026-07-10

## Context
When a Bounded Context mutates state (e.g., Member is registered) and needs to publish an Integration Event (e.g., to Kafka), doing both sequentially is prone to dual-write failures (e.g., DB commits but Kafka is down).

## Decision
We adopt the Transactional Outbox Pattern.
- The `Command Handler` opens a single database transaction.
- It saves the mutated `Domain Aggregate`.
- It serializes the `Integration Event` and saves it to an `Outbox` table within the same transaction.
- The transaction commits.
- A separate background publisher (or CDC tool) reads the Outbox table and pushes events to Kafka.

## Consequences
- **Positive:** Guarantees exactly-once (or at-least-once) delivery. Prevents phantom events from failed DB commits.
- **Negative:** Increased DB schema complexity and background worker orchestration.

**Supersedes:** None
**Related ADRs:** ADR-003 (Domain vs Integration Events)
