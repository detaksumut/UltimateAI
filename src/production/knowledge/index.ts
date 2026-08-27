// src/production/knowledge/index.ts

// ==========================================
// 1. Enums
// ==========================================
export { KnowledgeNodeType } from "./contracts/KnowledgeNodeType";
export { KnowledgeProjectionType } from "./projection/KnowledgeProjectionType";
export { KnowledgeRelationType } from "./contracts/KnowledgeRelationType";
export { NavigationMode } from "./navigation/NavigationMode";
export { ReconstructionMode } from "./reconstruction/ReconstructionMode";

// ==========================================
// 2. Types
// ==========================================
// None at present.

// ==========================================
// 3. Interfaces
// ==========================================
export { IKnowledgeProjector } from "./projection/IKnowledgeProjector";
export { IKnowledgeReconstructor } from "./reconstruction/IKnowledgeReconstructor";
export { IKnowledgeStore } from "./store/IKnowledgeStore";
export { IPendingReferenceRegistry } from "./contracts/IPendingReferenceRegistry";
export { ISemanticNavigator } from "./navigation/ISemanticNavigator";
export { IStructuralNavigator } from "./navigation/IStructuralNavigator";
export { KnowledgeAnchor } from "./navigation/KnowledgeAnchor";
export { KnowledgeEdge } from "./contracts/KnowledgeEdge";
export { KnowledgeEvent } from "./reconstruction/KnowledgeEvent";
export { KnowledgeGraph } from "./contracts/KnowledgeGraph";
export { KnowledgeIdentity } from "./contracts/KnowledgeIdentity";
export { KnowledgeMetadata } from "./contracts/KnowledgeMetadata";
export { KnowledgeNode } from "./contracts/KnowledgeNode";
export { KnowledgePath } from "./contracts/KnowledgePath";
export { KnowledgeProjection } from "./projection/KnowledgeProjection";
export { KnowledgeProjectionResult } from "./projection/KnowledgeProjectionResult";
export { KnowledgeSnapshot } from "./reconstruction/KnowledgeSnapshot";
export { KnowledgeTimeline } from "./reconstruction/KnowledgeTimeline";
export { NavigationContext } from "./navigation/NavigationContext";
export { NavigationMetrics } from "./navigation/NavigationMetrics";
export { NavigationResult } from "./navigation/NavigationResult";
export { NavigationWarning } from "./navigation/NavigationWarning";
export { ProjectionContext } from "./projection/ProjectionContext";
export { ProjectionDescriptor } from "./projection/ProjectionDescriptor";
export { ProjectorMetadata } from "./projection/ProjectorMetadata";
export { ReconstructionMetrics } from "./reconstruction/ReconstructionMetrics";
export { ReconstructionPolicy } from "./reconstruction/ReconstructionPolicy";
export { ReconstructionRequest } from "./reconstruction/ReconstructionRequest";
export { ReconstructionResult } from "./reconstruction/ReconstructionResult";
export { ReconstructionWarning } from "./reconstruction/ReconstructionWarning";
export { TraversalStrategy } from "./navigation/TraversalStrategy";

// ==========================================
// 4. Classes (Services)
// ==========================================
export { InMemoryKnowledgeStore } from "./store/InMemoryKnowledgeStore";
export { KnowledgeIngestionEngine } from "./ingestion/KnowledgeIngestionEngine";
export { KnowledgeProjectionLayer } from "./projection/KnowledgeProjectionLayer";
export { LocalFileKnowledgeStore } from "./store/LocalFileKnowledgeStore";
export { PendingReferenceRegistry } from "./ingestion/PendingReferenceRegistry";
export { ProjectorResolver } from "./projection/ProjectorResolver";

// ==========================================
// 5. Utilities
// ==========================================
// None at present.
