# ADR-010: Scientific Record Immutability

**Status:** Accepted
**Date:** 2026-07-10

## Context
The Journal Platform is the custodian of scientific integrity. In a peer-review system, trust is paramount. If editorial decisions or peer reviews can be altered after the fact, the entire scientific record becomes suspect, leading to loss of credibility and potential indexing delistings.

## Decision
We mandate **Scientific Record Immutability** as a core domain invariant across the Journal Platform.
- A `Review` object, once submitted, can never be modified.
- An `EditorialDecision` object, once finalized, can never be modified.
- If a correction or retraction is needed, a **new** immutable record must be created that explicitly references the previous version (append-only ledger style).

## Consequences
- **Positive:** Guarantees an unbreakable, auditable chain of scientific decisions. Protects against editorial bias or post-publication tampering.
- **Negative:** Increased database storage overhead. UI must be designed to show "correction chains" rather than simple in-place edits.

**Supersedes:** None
**Related ADRs:** ADR-002 (CQRS Adoption)
