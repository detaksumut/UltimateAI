# ADR-0001 — Interface-First Architecture

**Status:** Accepted

**Date:** 2026-06-25

**Author:** UltimateAI Architecture Team

---

# Context

UltimateAI is designed as a long-term AI Runtime Platform rather than a single-purpose AI application.

The system will eventually contain multiple runtime modules, including:

* Memory Runtime
* Planner Runtime
* Execution Runtime
* Tool Runtime
* Agent Runtime
* Workspace Runtime
* Knowledge Runtime
* Workflow Runtime

These modules must evolve independently while remaining interoperable.

Without a stable architectural contract, implementations would become tightly coupled, making future expansion difficult and increasing maintenance costs.

---

# Decision

UltimateAI adopts an **Interface-First Architecture**.

Every subsystem must expose its behavior through interfaces before introducing concrete implementations.

The dependency direction is:

```text
Interface

↓

Implementation
```

Never:

```text
Implementation

↓

Implementation
```

---

# Principles

Every runtime module must:

* Depend on abstractions.
* Hide implementation details.
* Support dependency injection.
* Avoid direct coupling to concrete implementations.
* Be independently testable.
* Be replaceable without affecting consumers.

---

# Examples

Memory

```text
IMemoryProvider

↓

SqlMemoryProvider

↓

RedisMemoryProvider

↓

InMemoryProvider
```

Planner

```text
IPlanningStrategy

↓

DefaultPlanningStrategy

↓

FuturePlanningStrategy
```

Execution

```text
IExecutor

↓

LocalExecutor

↓

DistributedExecutor
```

---

# Benefits

The Interface-First approach provides:

* Loose coupling.
* Better maintainability.
* Easier unit testing.
* Multiple interchangeable implementations.
* Long-term scalability.
* Cleaner dependency graphs.

---

# Consequences

All new runtime modules must define their public interfaces before implementation begins.

Concrete implementations must never be used as dependencies between runtime modules.

Dependency Injection is the default composition mechanism.

Public interfaces are considered stable contracts and should change only through architectural review.

---

# Alternatives Considered

## Direct concrete implementations

Rejected.

Reason:

Creates tight coupling and makes future replacement of implementations expensive.

## Service Locator

Rejected as the primary dependency mechanism.

Reason:

Hides dependencies and complicates testing.

---

# Decision Outcome

Accepted.

This decision becomes the architectural standard for all current and future UltimateAI runtime modules.
