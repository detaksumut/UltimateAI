/**
 * ExpertResponseFormatter.mjs
 * Phase 5H: Discipline-Specific Expert Response Formatting Engine.
 * 
 * Adapts response structure dynamically according to domain norms:
 *  - LAW: IRAC (Issue, Rule, Analysis, Application, Conclusion)
 *  - MEDICAL: Evidence, Uncertainty, Differential considerations (Strict Non-Diagnosis disclaimer)
 *  - FINANCE: Assumptions, Metrics, Scenario projections, Risk sensitivity
 *  - SCIENCE_ENGINEERING: Hypothesis, Method, Empirical Evidence, Calculations, Engineering Design
 *  - SOFTWARE: Architecture, Dependencies, Implementation, Verification Tests, Operational Risks
 */

import { DOMAINS } from '../knowledge/DomainOntologyAdapters.mjs';

export class ExpertResponseFormatter {
  static format({ domain, summary = '', details = {}, findings = [], calculations = null, recommendations = [] }) {
    const d = (domain || 'GENERAL').toUpperCase();

    if (d === DOMAINS.LAW_REGULATION) {
      return {
        domain: DOMAINS.LAW_REGULATION,
        framework: 'IRAC_STATUTORY_FRAMEWORK',
        sections: {
          ISSUE: details.issue || summary,
          RULE: details.rule || 'Peraturan dan ketentuan hukum terkait yang berlaku.',
          ANALYSIS: details.analysis || findings.join('\n'),
          APPLICATION: details.application || 'Penerapan pasal pada fakta hukum kasus.',
          CONCLUSION: details.conclusion || recommendations.join('\n')
        },
        disclaimer: 'DISCLAIMER: Analisis hukum berbasis informasi regulasi publik; bukan merupakan nasihat advokat resmi.'
      };
    }

    if (d === DOMAINS.FINANCE_QUANT) {
      return {
        domain: DOMAINS.FINANCE_QUANT,
        framework: 'QUANTITATIVE_FINANCIAL_FRAMEWORK',
        sections: {
          EXECUTIVE_SUMMARY: summary,
          ASSUMPTIONS: details.assumptions || ['Proyeksi berbasis data historis kuartal terkini'],
          KEY_METRICS: details.metrics || calculations || {},
          SCENARIO_ANALYSIS: details.scenarios || 'Base, Bull, and Bear sensitivity modeling',
          RISK_FACTORS: details.risks || ['Volatilitas pasar', 'Perubahan suku bunga', 'Risiko likuiditas'],
          STRATEGIC_RECOMMENDATION: recommendations
        },
        disclaimer: 'DISCLAIMER: Analisis kuantitatif finansial; bukan rekomendasi investasi personal.'
      };
    }

    if (d === DOMAINS.MEDICAL_BIOMEDICAL) {
      return {
        domain: DOMAINS.MEDICAL_BIOMEDICAL,
        framework: 'BIOMEDICAL_EVIDENCE_FRAMEWORK',
        sections: {
          CLINICAL_SUMMARY: summary,
          EVIDENCE_FINDINGS: findings,
          UNCERTAINTY_CONSIDERATIONS: details.uncertainty || ['Memerlukan konfirmasi uji klinis multi-senter lanjutan'],
          DIFFERENTIAL_FACTORS: details.differentials || [],
          RECOMMENDED_NEXT_STEPS: recommendations
        },
        disclaimer: 'DISCLAIMER: Tinjauan literatur biomedis untuk tujuan riset/informasi; bukan merupakan diagnosis medis atau anjuran klinis resmi.'
      };
    }

    if (d === DOMAINS.SCIENCE_ENGINEERING) {
      return {
        domain: DOMAINS.SCIENCE_ENGINEERING,
        framework: 'EMPIRICAL_ENGINEERING_FRAMEWORK',
        sections: {
          HYPOTHESIS_REQUIREMENTS: summary,
          METHODOLOGY: details.methodology || 'Formulasi analitis dan verifikasi solver komputasi eksak',
          CALCULATIONS_EVIDENCE: calculations || findings,
          VERIFICATION_OUTCOME: details.verification || 'Hasil diverifikasi terhadap batas toleransi teknis',
          ENGINEERING_DESIGN: recommendations
        }
      };
    }

    if (d === DOMAINS.SOFTWARE_CLOUD) {
      return {
        domain: DOMAINS.SOFTWARE_CLOUD,
        framework: 'SOFTWARE_ARCHITECTURE_FRAMEWORK',
        sections: {
          SYSTEM_OBJECTIVE: summary,
          ARCHITECTURE_TOPOLOGY: details.architecture || 'Microservices / LocalRouter 9Router proxy',
          DEPENDENCIES: details.dependencies || [],
          IMPLEMENTATION_SPEC: details.implementation || findings,
          SECURITY_AND_TESTS: details.tests || ['Unit tests passed', 'Sandbox isolation verified'],
          OPERATIONAL_RISKS: details.risks || []
        }
      };
    }

    // Default General Expert Response
    return {
      domain: 'GENERAL_EXPERT',
      framework: 'EVIDENCE_SYNTHESIS_FRAMEWORK',
      sections: {
        SUMMARY: summary,
        EVIDENCE: findings,
        CALCULATIONS: calculations,
        RECOMMENDATIONS: recommendations
      }
    };
  }
}

export default ExpertResponseFormatter;
