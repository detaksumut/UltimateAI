/**
 * YamlCatalogRepository.ts
 *
 * Implementation of ICatalogRepository that reads from local YAML files.
 * This is strictly isolated; no other class reads YAML directly.
 */

import { ICatalogRepository } from './ICatalogRepository';
// Note: In Node.js, we would import fs and a yaml parser (e.g., js-yaml).
// For architectural enforcement, this mock represents the concrete boundary.

export class YamlCatalogRepository implements ICatalogRepository {
  
  public async fetchEventCatalog(): Promise<any> {
    // Reads catalog/index.yaml and merges all domain-event.yamls
    return { events: [] }; 
  }
  
  public async fetchStateCatalog(domain: string): Promise<any> {
    // Reads catalog/state-catalog/${domain}.yaml
    return { states: [] };
  }
  
  public async fetchActionCatalog(): Promise<any> {
    // Reads catalog/action-catalog.yaml
    return { actions: [] };
  }
  
  public async fetchTransitionRules(): Promise<any> {
    // Reads catalog/transition-rules.yaml
    return { rules: [] };
  }
}
