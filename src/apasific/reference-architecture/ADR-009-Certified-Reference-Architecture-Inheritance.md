# ADR-009: Certified Reference Architecture Inheritance

**Status:** Accepted
**Date:** 2026-07-10

## Context
As the APASIFIC ecosystem grows into multiple bounded contexts (Journal, Certification, Conference, Awards), starting from scratch leads to architectural drift, duplicated boilerplate, and inconsistent quality. The Membership Bounded Context has passed the Production Readiness Review (PRR) and was declared the Reference Architecture.

## Decision
All new bounded contexts MUST strictly inherit from the Certified Reference Architecture (`template.manifest.json`). 
The Engineering Cognitive Runtime (ECR) workflow is permanently updated to:
1. Load Certified Reference Architecture
2. Reference Gap Analysis (Identify what is reusable vs what is domain-specific)
3. Generate Change Plan
4. Engineering Judgment Approval
5. Execution

## Consequences
- **Positive:** Guarantees structural consistency (CQRS, DDD, UI Patterns, Observability) across all APASIFIC domains. Accelerates development by focusing strictly on business logic.
- **Negative:** Forces all bounded contexts into the CQRS/DDD pattern, even if a context is extremely simple (CRUD).

**Supersedes:** None
**Related ADRs:** All prior ADRs 001-008 form the baseline of the inheritance.
