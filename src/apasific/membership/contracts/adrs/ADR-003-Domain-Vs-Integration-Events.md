# ADR-003: Domain Events vs Integration Events

**Status:** Accepted
**Date:** 2026-07-10

## Context
A single event like "MemberActivated" has different meanings. To the Membership Domain, it means the state mutated. To the Journal Domain, it means a new author is available. Tying them together creates tight coupling.

## Decision
Events are split:
- **Domain Events:** Plain TypeScript objects representing state changes within a single Bounded Context. Handled synchronously within the transaction where possible.
- **Integration Events:** Public contracts serialized into JSON envelopes (containing version, aggregate ID, correlation ID) broadcasted over the Event Bus (Kafka/RabbitMQ) for other domains.

## Consequences
- **Positive:** Bounded Contexts can evolve their internal Domain Events without breaking external consumers.
- **Negative:** Requires an explicit mapping/publishing layer in the Infrastructure (e.g., `KafkaEventPublisher`).
