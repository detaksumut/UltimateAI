# UltimateAI Knowledge Graph Architecture (v1.5)

## 1. Overview
The Knowledge Graph bridges the Data Layer (Artifact Repository) and the Intelligence Layer (Memory/Agents). It transforms isolated Artifacts into a highly connected semantic network, empowering UltimateAI to "understand" its own execution history and relationships without duplicating heavy data payloads.

## 2. Principle 52
**Knowledge Emerges from Relationships:** Artifacts become knowledge only when their relationships are explicitly represented. The Knowledge Graph MUST model relationships without duplicating artifact payloads, preserving the Artifact Repository as the single source of truth.

## 3. The Contract
The Graph consists strictly of `KnowledgeNode` and `KnowledgeEdge`.
- **KnowledgeNode**: Acts as a lightweight pointer to an Artifact. It stores the `artifactId` and `contentHash` for rapid deduplication and caching, but NEVER stores the payload.
- **KnowledgeEdge**: A first-class entity linking two nodes with a specific `KnowledgeRelationType`. Edges include a `confidence` score (e.g., deterministic lineage = 1.0, LLM semantic inference = 0.95).

## 4. Structural vs Semantic Relations
- **Structural**: Deterministic links generated automatically by the system (`DERIVED_FROM`, `GENERATED_BY`, `BELONGS_TO`).
- **Semantic**: Intelligently inferred links (`REFERENCES`, `SIMILAR_TO`, `CONTRADICTS`).

## 5. Idempotent Event-Driven Ingestion
The `KnowledgeIngestionEngine` passively listens to `ArtifactStored` events. Upon receiving an event, it queries the Artifact Repository, extracts lineage and provenance, and seamlessly projects them into nodes and edges. It guarantees idempotency through content hashes and deterministic IDs.

## 6. Query API for Memory Intelligence
The Graph exposes a strong Query API (`findChildren`, `findParents`, `findByTrace`, `findConnected`). This serves as the critical query backend for Sprint 7 (Memory Intelligence).
