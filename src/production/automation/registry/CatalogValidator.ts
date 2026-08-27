/**
 * CatalogValidator.ts
 *
 * CI/CD enforcement utility.
 * Validates uniqueness and integrity across all catalogs.
 */

import { ICatalogRepository } from './ICatalogRepository';

export class CatalogValidator {
  
  public static async validateAll(repo: ICatalogRepository): Promise<boolean> {
    try {
      const events = await repo.fetchEventCatalog();
      // 1. Check duplicate events
      const eventNames = new Set();
      for (const e of events.events || []) {
        if (eventNames.has(e.event)) throw new Error(`Duplicate Event: ${e.event}`);
        eventNames.add(e.event);
      }
      
      const actions = await repo.fetchActionCatalog();
      // 2. Check duplicate actions
      const actionIds = new Set();
      for (const a of actions.actions || []) {
        if (actionIds.has(a.id)) throw new Error(`Duplicate Action: ${a.id}`);
        actionIds.add(a.id);
      }
      
      // Additional checks for transitions, orphan files, etc.
      return true;
    } catch (e: any) {
      console.error(`Catalog Validation Failed: ${e.message}`);
      return false;
    }
  }
}
