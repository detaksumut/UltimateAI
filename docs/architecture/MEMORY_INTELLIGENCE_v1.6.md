# UltimateAI Memory Intelligence (v1.6)

## 1. Overview
Memory Intelligence transforms passive data storage into a **Knowledge Retrieval Engine**. It selects and ranks relevant contexts using deterministic strategies, actively feeding the `Execution Loop` to complete the `Learning Loop`.

## 2. Principle 53
**Memory Is Context Selection:** Memory MUST retrieve context through explicit retrieval strategies and deterministic ranking. Storage alone is not memory; memory is the process of selecting the most relevant context for the current execution.

## 3. The Retrieval Pipeline
To ensure clarity of responsibility, retrieval operates as a strict pipeline:
1. **Candidate Generator**: Queries the `Knowledge Graph` to find a pool of potential `KnowledgeNode`s based on `RetrievalStrategy` (Lineage, Capability, Workflow, Recent). SEMANTIC remains a stub for future embedding models.
2. **Ranking Engine**: Evaluates the candidates, assigning a `Score`, `Reason`, and `Confidence`.
3. **Memory Policy Filter**: Filters candidates based on constraints (`maxDepth`, `minimumScore`, `allowCrossWorkflow`).
4. **Artifact Hydration**: Fetches the actual data payloads for the surviving candidates from the `Artifact Repository`.

## 4. Retrieved Context
The final output to the Planner (`RetrievedContext`) contains:
- The actual `IArtifact` payload.
- The `ContextRanking` (explaining why it was chosen).
- The `KnowledgePath` (trace of the graph traversal).

## 5. Observability Integration
Retrieval is fully observable. Every retrieval request emits telemetric trace events (`RetrievalStarted`, `CandidateGenerated`, `RankingCompleted`, `ContextReturned`) so that reasoning decisions remain completely transparent.
