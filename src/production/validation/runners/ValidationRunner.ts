/**
 * ValidationRunner.ts
 *
 * The Orchestrator for the Validation Program.
 * Generates the standardized Validation Report.
 */

import { PipelineRunner } from './PipelineRunner';
import { ArtifactRunner } from './ArtifactRunner';
import { AssertionRunner, ValidationCriteria } from './AssertionRunner';

export class ValidationRunner {
  private matrix: any[] = [];
  
  constructor(
    private pipeline: PipelineRunner,
    private artifactRunner: ArtifactRunner,
    private assertion: AssertionRunner
  ) {}
  
  public async executeScenario(domain: string, phases: { name: string, payload: any, expectedStatus: string }[]): Promise<void> {
    const startTime = Date.now();
    let allCriteriaMet = true;
    let finalCriteria: ValidationCriteria | null = null;
    
    for (const phase of phases) {
      const snapshot = await this.pipeline.runPhase(domain, phase.name, phase.payload);
      const criteria = this.assertion.verify(snapshot, phase.expectedStatus);
      finalCriteria = criteria;
      
      if (!criteria.domain || !criteria.engineering.analysisPassed) {
        allCriteriaMet = false;
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Generate Report
    const report = `# Validation Report: ${domain}

## Summary
- **Domain:** ${domain}
- **Duration:** ${duration}ms
- **Status:** ${allCriteriaMet ? '✅ PASS' : '❌ FAIL'}

## Acceptance Criteria
- **Engineering:** ${finalCriteria?.engineering.noHardcodedDomain ? '✅' : '❌'} No Hardcoded Domain
- **Engineering:** ${finalCriteria?.engineering.noCompilerBypass ? '✅' : '❌'} No Compiler Bypass
- **Domain Logic:** ${finalCriteria?.domain ? '✅' : '❌'} Expected State Achieved

## Conclusion
${allCriteriaMet ? 'The EAEP architecture successfully executed this domain purely generically.' : 'Validation failed.'}
`;
    
    this.artifactRunner.saveAsset(domain, 'validation-report.md', report);
    
    // Add to matrix
    this.matrix.push({
      domain,
      engineering: finalCriteria?.engineering.analysisPassed ? '✅' : '❌',
      runtime: finalCriteria?.engineering.compilationPassed ? '✅' : '❌',
      platform: finalCriteria?.engineering.noEventsLost ? '✅' : '❌',
      domainResult: finalCriteria?.domain ? '✅' : '❌'
    });
  }
  
  public generateValidationMatrix(): void {
    let report = `# EAEP Validation Matrix\n\n`;
    report += `| Validation | Engineering | Runtime | Platform | Domain |\n`;
    report += `|---|---|---|---|---|\n`;
    
    for (const m of this.matrix) {
      report += `| ${m.domain} | ${m.engineering} | ${m.runtime} | ${m.platform} | ${m.domainResult} |\n`;
    }
    
    this.artifactRunner.saveAsset('summary', 'validation_matrix.md', report);
    console.log(report);
  }
}
