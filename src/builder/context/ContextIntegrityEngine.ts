// src/builder/context/ContextIntegrityEngine.ts

import { ProjectIntelligenceModel } from '../requirement/ProjectIntelligenceEngine';

export class ContextIntegrityEngine {
  private SIGNATURES: Record<string, string[]> = {
    'Publishing': ['submission', 'reviewer', 'editor', 'publication', 'issue', 'volume', 'doi', 'manuscript', 'article'],
    'Environmental Research': ['temperature', 'ndvi', 'satellite', 'gis', 'humidity', 'heatmap', 'weather', 'emission', 'coordinates'],
    'Healthcare': ['patient', 'intake', 'physician', 'prescription', 'ward', 'clinical', 'medical', 'hospital', 'reagent'],
    'Food Service': ['order', 'kitchen', 'inventory', 'cashier', 'payment', 'menu', 'pos', 'tables', 'bill'],
    'Scientific Research': ['observation', 'variables', 'measurement', 'subject', 'data']
  };

  /**
   * Identifies the correct signature map for the model domain.
   */
  public getDomainSignature(domainName: string): string[] {
    // Exact or partial matching
    for (const key of Object.keys(this.SIGNATURES)) {
      if (domainName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(domainName.toLowerCase())) {
        return this.SIGNATURES[key];
      }
    }
    return this.SIGNATURES['Scientific Research'];
  }

  /**
   * Audits model to verify if any cross-domain variables or labels contaminate the prototype.
   */
  public checkIntegrity(model: ProjectIntelligenceModel): { isContaminated: boolean; violations: string[]; signature: string[] } {
    const activeDomain = model.domain?.name || 'Scientific Research';
    const activeSignature = this.getDomainSignature(activeDomain);
    const violations: string[] = [];

    // Find other domain signatures that are NOT the active signature
    const otherSignatures: Record<string, string[]> = {};
    for (const key of Object.keys(this.SIGNATURES)) {
      const signature = this.SIGNATURES[key];
      if (signature !== activeSignature) {
        otherSignatures[key] = signature;
      }
    }

    // Scan screens, parameters, variables, title, and components for other domain keywords
    const textToScan: string[] = [];
    if (model.researchTitle) textToScan.push(model.researchTitle.toLowerCase());
    if (model.parameters) {
      model.parameters.forEach(p => {
        textToScan.push(p.name.toLowerCase());
        if (p.options) p.options.forEach(o => textToScan.push(o.toLowerCase()));
      });
    }
    if (model.screens) {
      model.screens.forEach(s => {
        textToScan.push(s.title.toLowerCase());
        s.components.forEach(c => textToScan.push(c.toLowerCase()));
      });
    }
    if (model.variables) {
      if (model.variables.independent) model.variables.independent.forEach(v => textToScan.push(v.toLowerCase()));
      if (model.variables.dependent) model.variables.dependent.forEach(v => textToScan.push(v.toLowerCase()));
    }

    // Identify violations
    for (const domainName of Object.keys(otherSignatures)) {
      const keywords = otherSignatures[domainName];
      for (const keyword of keywords) {
        for (const text of textToScan) {
          if (text.includes(keyword)) {
            const violationMsg = `Cross-domain leakage detected: keyword "${keyword}" from "${domainName}" found in active context "${activeDomain}".`;
            if (!violations.includes(violationMsg)) {
              violations.push(violationMsg);
            }
          }
        }
      }
    }

    return {
      isContaminated: violations.length > 0,
      violations,
      signature: activeSignature
    };
  }

  /**
   * Automatically scrubs out-of-domain properties and re-routes components to maintain context integrity.
   */
  public sanitize(model: ProjectIntelligenceModel): ProjectIntelligenceModel {
    const integrity = this.checkIntegrity(model);
    if (!integrity.isContaminated) {
      model.contextIntegrity = { isContaminated: false, violations: [] };
      return model;
    }

    // Auto-sanitizer / Repair: Wipes out-of-domain keywords from screens, components, and parameter configurations.
    const activeDomain = model.domain?.name || 'Scientific Research';
    const activeSignature = this.getDomainSignature(activeDomain);
    const fallbackWord = activeSignature[0] || 'record';

    // Find other domain signatures keywords
    const badKeywords: string[] = [];
    for (const key of Object.keys(this.SIGNATURES)) {
      if (this.getDomainSignature(key) !== activeSignature) {
        badKeywords.push(...this.SIGNATURES[key]);
      }
    }

    // Helper function to sanitize a string by replacing bad keywords with domain fallback
    const sanitizeText = (txt: string): string => {
      let result = txt;
      for (const kw of badKeywords) {
        const regex = new RegExp(kw, 'gi');
        if (regex.test(result)) {
          // Replace with fallback capitalized appropriately
          result = result.replace(regex, (match) => {
            const firstLetterCap = match.charAt(0) === match.charAt(0).toUpperCase();
            return firstLetterCap 
              ? fallbackWord.charAt(0).toUpperCase() + fallbackWord.slice(1)
              : fallbackWord;
          });
        }
      }
      return result;
    };

    // Sanitize parameters
    if (model.parameters) {
      model.parameters = model.parameters.map(p => ({
        ...p,
        name: sanitizeText(p.name)
      }));
    }

    // Sanitize screens and component tags
    if (model.screens) {
      model.screens = model.screens.map(s => {
        if (s.id === 'gis-map' && activeDomain !== 'Environmental Research') {
          // Change screen type and title to general list if mapping is out of domain
          return {
            ...s,
            id: 'general-grid',
            title: 'Data Collection Grid',
            type: 'list',
            components: s.components.map(c => sanitizeText(c).replace(/map/gi, 'List'))
          };
        }

        return {
          ...s,
          title: sanitizeText(s.title),
          components: s.components.map(c => sanitizeText(c))
        };
      });
    }

    // Sanitize variables
    if (model.variables) {
      if (model.variables.independent) {
        model.variables.independent = model.variables.independent.map(v => sanitizeText(v));
      }
      if (model.variables.dependent) {
        model.variables.dependent = model.variables.dependent.map(v => sanitizeText(v));
      }
    }

    // Re-check and update integrity values
    const finalCheck = this.checkIntegrity(model);
    model.contextSignature = activeSignature;
    model.contextIntegrity = {
      isContaminated: finalCheck.isContaminated,
      violations: finalCheck.violations
    };

    return model;
  }
}
