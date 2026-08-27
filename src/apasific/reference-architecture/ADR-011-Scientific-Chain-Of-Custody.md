# ADR-011: Scientific Chain of Custody

**Status:** Accepted
**Date:** 2026-07-10

## Context
Scientific publication requires absolute traceability. If a manuscript's status jumps from `SUBMITTED` directly to `ACCEPTED` without a documented peer review or desk review process, the integrity of the journal is compromised. 

## Decision
We mandate the **Scientific Chain of Custody** as a strict cross-aggregate invariant.
Every manuscript MUST maintain a complete, auditable chain of custody from initial submission to publication (or retraction). 
- State transitions on a `Manuscript` must be explicitly triggered by an authenticated action (e.g., Desk Review, Review Completion, Editorial Decision).
- No "skip" transitions are allowed in the state machine (e.g., cannot skip Peer Review unless explicitly documented as an `EditorialDecision` of type `DESK_ACCEPT` by the Chief Editor).
- Every event in the chain must carry the `EditorReference`, `ReviewerReference`, or `AuthorReference` of the actor.

## Consequences
- **Positive:** Provides forensic-level auditability for every published article. Essential for maintaining indexing in Scopus/WoS.
- **Negative:** Forces the Workflow/Application layer to implement strict state machine validations. Development of edge cases (like transferring editors mid-review) becomes complex.

**Supersedes:** None
**Related ADRs:** ADR-010 (Scientific Record Immutability)
