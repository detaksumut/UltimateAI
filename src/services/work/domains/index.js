/**
 * domains/index.js
 * ═══════════════════════════════════════════════════════════════════════
 * JIN Professional Work System — Domain Services Registry
 *
 * Exports all domain services for registration with DomainRouter.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { ResearchService } from './ResearchService.js';
import { DocumentService } from './DocumentService.js';
import { ContentService } from './ContentService.js';
import { PPTService } from './PPTService.js';
import { DataService } from './DataService.js';
import { AutomationService } from './AutomationService.js';
import { VoiceService } from './VoiceService.js';

export { ResearchService, DocumentService, ContentService, PPTService, DataService, AutomationService, VoiceService };

/**
 * Create a fully-configured ResearchService
 */
export function createResearchService(options = {}) {
  return new ResearchService(options);
}

/**
 * Create a fully-configured DocumentService
 */
export function createDocumentService(options = {}) {
  return new DocumentService(options);
}

/**
 * Create a fully-configured ContentService
 */
export function createContentService(options = {}) {
  return new ContentService(options);
}

/**
 * Create a fully-configured PPTService
 */
export function createPPTService(options = {}) {
  return new PPTService(options);
}

/**
 * Create a fully-configured DataService
 */
export function createDataService(options = {}) {
  return new DataService(options);
}

/**
 * Create a fully-configured AutomationService
 */
export function createAutomationService(options = {}) {
  return new AutomationService(options);
}

/**
 * Create a fully-configured VoiceService
 */
export function createVoiceService(options = {}) {
  return new VoiceService(options);
}

/**
 * Register all domain services on a DomainRouter
 */
export function registerAllDomains(domainRouter, options = {}) {
  const researchService = createResearchService(options);
  const documentService = createDocumentService(options);
  const contentService = createContentService(options);
  const pptService = createPPTService(options);
  const dataService = createDataService(options);
  const automationService = createAutomationService(options);
  const voiceService = createVoiceService(options);

  domainRouter.register('RESEARCH', researchService);
  domainRouter.register('DOCUMENT', documentService);
  domainRouter.register('CONTENT', contentService);
  domainRouter.register('CREATIVE', pptService);
  domainRouter.register('DATA', dataService);
  domainRouter.register('AUTOMATION', automationService);
  domainRouter.register('VOICE', voiceService);

  return { researchService, documentService, contentService, pptService, dataService, automationService, voiceService };
}
