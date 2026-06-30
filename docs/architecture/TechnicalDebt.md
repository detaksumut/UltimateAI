# Technical Debt Register

This register tracks all architectural exceptions, orphan interfaces, untested contracts, and legacy code identified during Milestone 3 Phase 2.

| ID | Area | Severity | Deferred To | Description | Naming / Nominator |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **TD-001** | domain | Low | Phase 4 | Duplicate domain clock interface `Clock` exists at `src/production/knowledge/domain/Clock.ts`. `IClock` is the canonical clock. | Orphan Interface |
| **TD-002** | navigation | Medium | Post API Freeze | `ISemanticNavigator` and `IStructuralNavigator` are declared but have no implementations. | Orphan Interface |
| **TD-003** | reconstruction | Medium | Post API Freeze | `IKnowledgeReconstructor` has no concrete implementations. | Orphan Interface |
| **TD-004** | projection | Low | Phase 3 | `IKnowledgeProjector` has no concrete implementations in the workspace. | Unimplemented Contract |
| **TD-005** | tests | Low | Phase 4 | `KnowledgeProjectionLayer` and `ProjectorResolver` are untested in the current certification suite. | Testing Gap |
