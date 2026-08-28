/**
 * CrossDomainUnseenTaskDemo.mjs
 * Live End-to-End Demonstration of Cross-Domain Multi-Disciplinary Expert Intelligence.
 * 
 * Pipeline:
 *  LAW (Regulation) ➔ FINANCE (Cost Projection) ➔ SOLVER (formal.solve exact calculation)
 *  ➔ ENGINEERING (System design) ➔ SYNTHESIS (Expert Formatter).
 */

import { domainKnowledgeGraphInstance } from '../../server/knowledge/DomainKnowledgeGraph.mjs';
import { formalSolveToolInstance } from '../../server/tools/FormalSolveTool.mjs';
import { ExpertResponseFormatter } from '../../server/agent/ExpertResponseFormatter.mjs';
import { DOMAINS } from '../../server/knowledge/DomainOntologyAdapters.mjs';
import assert from 'assert';

console.log('\n════════════════════════════════════════════════════════════════════════════════');
console.log('  LIVE UNSEEN DEMO: Phase 5 Cross-Domain Expert Intelligence Pipeline');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

async function runCrossDomainDemo() {
  let passed = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Cross-Domain Task (Law -> Finance -> Exact Solver -> Cloud Architecture)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('─── [SCENARIO 1] Multi-Disciplinary Cross-Domain Analysis ───');
  try {
    // 1. Law Phase: Query regulation from knowledge graph
    const lawClaims = domainKnowledgeGraphInstance.queryDomainKnowledge({
      queryText: 'UU PDP perlindungan data lokal',
      domain: DOMAINS.LAW_REGULATION
    });
    assert.ok(lawClaims.length > 0, 'Must retrieve Law claim');
    console.log(`  1. [LAW] Retrieved Grounded Regulation: "${lawClaims[0].claim.slice(0, 60)}..."`);

    // 2. Finance & Solver Phase: Exact calculation of compliance cost projection
    const solveRes = await formalSolveToolInstance.execute({
      mode: 'EXACT_ARITHMETIC',
      expression: 'base_capex * (1 + inflation_rate) ** years + annual_opex * years',
      variables: { base_capex: 250000000, inflation_rate: 0.05, years: 3, annual_opex: 45000000 }
    });

    assert.strictEqual(solveRes.status, 'SUCCESS');
    assert.strictEqual(solveRes.isVerified, true);
    console.log(`  2. [SOLVER] Exact 3-Year Projected Cost: Rp ${solveRes.exactResult.toLocaleString()} (${solveRes.durationMs}ms)`);

    // 3. Engineering & Expert Response Framing
    const response = ExpertResponseFormatter.format({
      domain: DOMAINS.FINANCE_QUANT,
      summary: 'Analisis kepatuhan UU PDP dan proyeksi biaya implementasi node lokal Drive F:.',
      details: {
        metrics: { totalCostRp: solveRes.exactResult, capexBase: 250000000, years: 3 },
        assumptions: ['Inflasi tahunan 5%', 'Maintenance berkala'],
        risks: ['Perubahan regulasi turunan', 'Depresiasi hardware']
      },
      recommendations: [
        'Aktifkan penyimpanan Drive F: air-gapped secara penuh.',
        'Jadwalkan audit berkala setiap 6 bulan.'
      ]
    });

    assert.strictEqual(response.domain, DOMAINS.FINANCE_QUANT);
    assert.strictEqual(response.framework, 'QUANTITATIVE_FINANCIAL_FRAMEWORK');
    console.log(`  3. [SYNTHESIS] Synthesized via ${response.framework}`);
    console.log(`  ✓ [SCENARIO 1 PASS] Full Cross-Domain Pipeline Succeeded.`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [SCENARIO 1 FAIL]: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Medical Evidence Claim & Non-Diagnostic Formatting
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n─── [SCENARIO 2] Medical Evidence & Non-Diagnostic Framing ───');
  try {
    const medResponse = ExpertResponseFormatter.format({
      domain: DOMAINS.MEDICAL_BIOMEDICAL,
      summary: 'Tinjauan literatur efikasi terapi kombinasi.',
      findings: ['Uji klinis menunjukkan penurunan biomarker inflamasi sebesar 42%'],
      recommendations: ['Konsultasikan dengan dokter spesialis terkait sebelum tindakan klinis']
    });

    assert.ok(medResponse.disclaimer.includes('DISCLAIMER'));
    console.log(`  ✓ [SCENARIO 2 PASS] Medical framing formatted with mandatory safety disclaimer`);
    passed++;
  } catch (err) {
    console.log(`  ✗ [SCENARIO 2 FAIL]: ${err.message}`);
  }

  console.log(`\n════════════════════════════════════════════════════════════════════════════════`);
  console.log(`  CROSS-DOMAIN DEMO SUMMARY: ${passed}/2 Scenarios Succeeded.`);
  console.log(`════════════════════════════════════════════════════════════════════════════════\n`);
  if (passed < 2) process.exit(1);
}

runCrossDomainDemo();
