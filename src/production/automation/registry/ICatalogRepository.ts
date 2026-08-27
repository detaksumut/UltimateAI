/**
 * ICatalogRepository.ts
 *
 * Abstracts the physical storage mechanism of the Catalogs (YAML, DB, Cache).
 * Ensures that CatalogService is decoupled from the file system.
 */

export interface ICatalogRepository {
  fetchEventCatalog(): Promise<any>;
  fetchStateCatalog(domain: string): Promise<any>;
  fetchActionCatalog(): Promise<any>;
  fetchTransitionRules(): Promise<any>;
}
