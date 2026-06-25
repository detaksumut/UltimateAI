# Architecture Decision Records (ADR)

## Overview

This directory contains the **Architecture Decision Records (ADR)** for UltimateAI.

An Architecture Decision Record captures the reasoning behind significant architectural decisions made during the development of the platform.

Unlike source code, which explains **how** something is implemented, an ADR explains **why** a particular architectural approach was chosen.

The ADRs collectively serve as the architectural history of UltimateAI.

---

# Purpose

The objectives of this directory are:

* Preserve architectural decisions.
* Record the reasoning behind each decision.
* Help future contributors understand the architecture.
* Reduce repeated architectural discussions.
* Maintain long-term consistency across the project.

---

# ADR Structure

Each ADR should contain the following sections:

* Title
* Status
* Date
* Context
* Problem
* Decision
* Alternatives Considered
* Consequences
* Future Considerations

---

# Naming Convention

ADR files must follow the format:

```text
ADR-0001-Interface-First.md
ADR-0002-Memory-Runtime.md
ADR-0003-Planner-Runtime.md
```

The numeric identifier must never be reused.

---

# Status Values

Every ADR must include one of the following statuses:

* Proposed
* Accepted
* Superseded
* Deprecated

Example:

```text
Status: Accepted
```

---

# Rules

* One architectural decision per ADR.
* Do not combine multiple unrelated decisions.
* ADRs document decisions, not implementations.
* Avoid code unless necessary to clarify the decision.
* Keep ADRs concise and focused.

If an architectural decision changes, create a new ADR instead of rewriting the original.

---

# Current ADR Index

| ADR      | Title                        | Status   |
| -------- | ---------------------------- | -------- |
| ADR-0001 | Interface-First Architecture | Accepted |

---

# Future ADRs

Planned architectural decisions include:

* Memory Runtime Architecture
* Planner Runtime Architecture
* Dependency Injection
* Core Runtime
* Execution Runtime
* Tool Runtime
* Agent Runtime
* Workspace Runtime
* Knowledge Runtime
* Workflow Runtime

---

# Relationship to Other Documentation

This directory complements the other documentation folders.

* `docs/architecture/` describes **how the system is organized**.
* `docs/product/` describes **what UltimateAI aims to achieve**.
* `docs/chronicle/` records **the history of the project**.
* `docs/decisions/` records **why architectural decisions were made**.

Together, these documents form the long-term knowledge base of UltimateAI.
