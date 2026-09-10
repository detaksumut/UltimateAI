/**
 * index.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Public API
 *
 * FASE 0 — Core Execution:
 *   WorkSession, WorkExecutor, ArtifactStream, ConversationCanvas
 *
 * FASE 1 — Intelligence:
 *   IntelligenceOrchestrator, DomainRouter, TaskPlanner
 * ═══════════════════════════════════════════════════════════════════════
 */

// FASE 0 — Core Execution
import { WorkSession, TASK_STATUS, SESSION_STATUS, INVARIANTS } from './WorkSession.js';
import { WorkExecutor } from './WorkExecutor.js';
import { ArtifactStream } from './ArtifactStream.js';
import { ConversationCanvas, ARTIFACT_STATE } from './ConversationCanvas.js';

// FASE 1 — Intelligence
import { IntelligenceOrchestrator } from './IntelligenceOrchestrator.js';
import { DomainRouter, DOMAIN_KEYWORDS } from './DomainRouter.js';
import { TaskPlanner, DOMAIN_TASK_TEMPLATES } from './TaskPlanner.js';

// FASE 2 — Domains
import { ResearchService, DocumentService, ContentService, PPTService, DataService, AutomationService, VoiceService, createResearchService, createDocumentService, createContentService, createPPTService, createDataService, createAutomationService, createVoiceService, registerAllDomains } from './domains/index.js';

// Re-export FASE 0
export { WorkSession, TASK_STATUS, SESSION_STATUS, INVARIANTS };
export { WorkExecutor };
export { ArtifactStream };
export { ConversationCanvas, ARTIFACT_STATE };

// Re-export FASE 1
export { IntelligenceOrchestrator };
export { DomainRouter, DOMAIN_KEYWORDS };
export { TaskPlanner, DOMAIN_TASK_TEMPLATES };

// Re-export FASE 2
export { ResearchService, DocumentService, ContentService, PPTService, DataService, AutomationService, VoiceService, createResearchService, createDocumentService, createContentService, createPPTService, createDataService, createAutomationService, createVoiceService, registerAllDomains };

/**
 * Convenience factory to create a fully-wired work session
 */
export function createWorkSession(orchestration, options = {}) {
  const session = WorkSession.create(orchestration);
  const artifactStream = new ArtifactStream(session.id);
  const canvas = new ConversationCanvas(session.id);
  const executor = new WorkExecutor(session, { artifactStream, canvas, ...options });

  return { session, executor, artifactStream, canvas };
}

/**
 * Convenience factory to create a fully-wired orchestrator
 */
export function createOrchestrator(options = {}) {
  const domainRouter = options.domainRouter || new DomainRouter();
  const taskPlanner = options.taskPlanner || new TaskPlanner(options);

  return new IntelligenceOrchestrator({
    domainRouter,
    taskPlanner,
    ...options,
  });
}
