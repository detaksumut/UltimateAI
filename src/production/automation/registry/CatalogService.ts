/**
 * CatalogService.ts
 *
 * Immutable Service Layer for resolving and querying catalog data.
 * Generator and Runtime must rely solely on this API.
 */

import { ICatalogRepository } from './ICatalogRepository';

export class CatalogService {
  private repo: ICatalogRepository;
  
  constructor(repo: ICatalogRepository) {
    this.repo = repo;
  }
  
  public async resolveEvent(eventName: string): Promise<any> {
    const data = await this.repo.fetchEventCatalog();
    const evt = data.events.find((e: any) => e.event === eventName);
    if (!evt) throw new Error(`Event '${eventName}' not found in global catalog.`);
    return evt;
  }
  
  public async resolveStates(domain: string): Promise<any[]> {
    const data = await this.repo.fetchStateCatalog(domain);
    return data.states || [];
  }
  
  public async resolveActions(category?: string): Promise<any[]> {
    const data = await this.repo.fetchActionCatalog();
    if (category) {
      return data.actions.filter((a: any) => a.category === category);
    }
    return data.actions || [];
  }
  
  public async resolveTransitions(fromState: string): Promise<any[]> {
    const data = await this.repo.fetchTransitionRules();
    return data.rules.filter((r: any) => r.from === fromState);
  }
}
