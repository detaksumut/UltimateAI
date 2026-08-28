/**
 * DomainOntologyAdapters.mjs
 * Phase 5A: Extensible Domain-Specific Ontology Adapters.
 * 
 * Domains Supported:
 *  1. LAW_REGULATION (regulation, jurisdiction, article, case, agency, effectiveDate)
 *  2. MEDICAL_BIOMEDICAL (condition, drug, trial, study, biomarker, outcome)
 *  3. FINANCE_QUANT (asset, market, metric, financialStatement, indicator, period)
 *  4. SCIENCE_ENGINEERING (concept, formula, measurement, experiment, unit, relationship)
 *  5. SOFTWARE_CLOUD (API, service, version, dependency, configuration, protocol)
 */

export const DOMAINS = {
  LAW_REGULATION: 'LAW_REGULATION',
  MEDICAL_BIOMEDICAL: 'MEDICAL_BIOMEDICAL',
  FINANCE_QUANT: 'FINANCE_QUANT',
  SCIENCE_ENGINEERING: 'SCIENCE_ENGINEERING',
  SOFTWARE_CLOUD: 'SOFTWARE_CLOUD'
};

export class DomainOntologyAdapters {
  /**
   * Adapts raw domain facts into typed ontology entities and relations
   */
  static adapt(domain, data = {}) {
    const d = (domain || '').toUpperCase();

    switch (d) {
      case DOMAINS.LAW_REGULATION:
        return {
          domain: DOMAINS.LAW_REGULATION,
          entityType: 'RegulationEntity',
          name: data.regulationName || data.title || data.name || 'Statute/Regulation',
          attributes: {
            regulation: data.regulation || null,
            jurisdiction: data.jurisdiction || 'GLOBAL',
            article: data.article || null,
            caseName: data.caseName || null,
            agency: data.agency || null,
            effectiveDate: data.effectiveDate || null,
            penalties: data.penalties || null
          }
        };

      case DOMAINS.MEDICAL_BIOMEDICAL:
        return {
          domain: DOMAINS.MEDICAL_BIOMEDICAL,
          entityType: 'BiomedicalEntity',
          name: data.condition || data.drug || data.name || 'Biomedical Entity',
          attributes: {
            condition: data.condition || null,
            drug: data.drug || null,
            trial: data.trial || null,
            study: data.study || null,
            biomarker: data.biomarker || null,
            outcome: data.outcome || null,
            contraindications: data.contraindications || null
          }
        };

      case DOMAINS.FINANCE_QUANT:
        return {
          domain: DOMAINS.FINANCE_QUANT,
          entityType: 'FinancialEntity',
          name: data.asset || data.market || data.name || 'Financial Entity',
          attributes: {
            asset: data.asset || null,
            market: data.market || null,
            metric: data.metric || null,
            financialStatement: data.financialStatement || null,
            indicator: data.indicator || null,
            period: data.period || null,
            value: data.value ?? null
          }
        };

      case DOMAINS.SCIENCE_ENGINEERING:
        return {
          domain: DOMAINS.SCIENCE_ENGINEERING,
          entityType: 'EngineeringEntity',
          name: data.concept || data.formula || data.name || 'Scientific Concept',
          attributes: {
            concept: data.concept || null,
            formula: data.formula || null,
            measurement: data.measurement || null,
            experiment: data.experiment || null,
            unit: data.unit || null,
            relationship: data.relationship || null
          }
        };

      case DOMAINS.SOFTWARE_CLOUD:
        return {
          domain: DOMAINS.SOFTWARE_CLOUD,
          entityType: 'SoftwareEntity',
          name: data.service || data.API || data.name || 'Software Entity',
          attributes: {
            API: data.API || null,
            service: data.service || null,
            version: data.version || null,
            dependency: data.dependency || null,
            configuration: data.configuration || null,
            protocol: data.protocol || null
          }
        };

      default:
        return {
          domain: 'GENERAL_KNOWLEDGE',
          entityType: 'GeneralEntity',
          name: data.name || 'Generic Fact',
          attributes: { ...data }
        };
    }
  }
}

export default DomainOntologyAdapters;
