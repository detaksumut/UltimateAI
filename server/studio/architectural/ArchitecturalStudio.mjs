/**
 * server/studio/architectural/ArchitecturalStudio.mjs
 * Master Architectural Studio Facade for Autonomous House & Building Design.
 * 
 * WORKFLOW:
 * 1. Simple User Input ("desain rumah 20x30m") -> Site Analysis & Design Program.
 * 2. Generate Master Design Draft (Sections A-E with Assumptions) -> Await Approval.
 * 3. On Approval -> Sequential Production of 8 Independent Artifacts.
 * 4. Revision Propagation Engine for localized adjustments.
 */

import { SiteAnalyzer } from './SiteAnalyzer.mjs';
import { DesignProgrammer } from './DesignProgrammer.mjs';
import { MasterDesignDraft } from './MasterDesignDraft.mjs';
import { MasterDesignState, masterDesignStateInstance } from './MasterDesignState.mjs';
import { ArchitecturalRenderer, architecturalRendererInstance } from './ArchitecturalRenderer.mjs';
import { ArchitecturalConsistencyQA, architecturalConsistencyQAInstance } from './ArchitecturalConsistencyQA.mjs';
import { ArchitecturalRevisionEngine, architecturalRevisionEngineInstance } from './ArchitecturalRevisionEngine.mjs';

export class ArchitecturalStudio {
  constructor(options = {}) {
    this.siteAnalyzer = new SiteAnalyzer();
    this.designProgrammer = new DesignProgrammer();
    this.masterDraft = new MasterDesignDraft();
    this.stateManager = options.stateManager || masterDesignStateInstance;
    this.renderer = options.renderer || architecturalRendererInstance;
    this.qa = options.qa || architecturalConsistencyQAInstance;
    this.revisionEngine = options.revisionEngine || architecturalRevisionEngineInstance;
    this.artifacts = {};
  }

  /**
   * Step 1 & 2: Analyzes the site, creates the program, and produces the Master Design Draft.
   */
  initiateDesignProject(userInput, options = {}) {
    console.log(`[ARCHITECTURAL_STUDIO] Initiating project with input: "${userInput}"`);
    
    // 1. Site Analysis
    const siteAnalysis = this.siteAnalyzer.analyzeSite(userInput, options);

    // 2. Spatial Program
    const designProgram = this.designProgrammer.generateProgram(siteAnalysis, options);

    // 3. Initialize Master State
    const projectId = options.projectId || `ARCH-${Date.now().toString().slice(-6)}`;
    const state = this.stateManager.createProject(projectId, siteAnalysis, designProgram);

    // 4. Generate Master Draft
    const draftMarkdown = this.masterDraft.generateDraft(siteAnalysis, designProgram, state);

    return {
      status: 'AWAITING_APPROVAL',
      projectId: state.projectId,
      siteAnalysis,
      designProgram,
      masterDraft: draftMarkdown,
      state
    };
  }

  /**
   * Step 3: Approve Master Design Draft.
   */
  approveProject(projectId) {
    const state = this.stateManager.approveMasterDraft();
    return {
      status: 'APPROVED',
      projectId: state.projectId,
      currentStep: state.currentStep,
      state
    };
  }

  /**
   * Sequential Step Production: Generates the visual artifact for a specific step.
   */
  async produceStep(stepId) {
    const state = this.stateManager.getState();
    if (!state) throw new Error('No active project found in MasterDesignState.');

    let artifact = null;

    switch (stepId) {
      case 'STEP_01_DENAH':
        artifact = await this.renderer.renderFloorPlan(state);
        this.artifacts['STEP_01_DENAH'] = artifact;
        this.stateManager.lockFloorPlan(artifact);
        break;

      case 'STEP_02_STRUKTUR':
        artifact = await this.renderer.renderStructuralFrame(state);
        this.artifacts['STEP_02_STRUKTUR'] = artifact;
        this.stateManager.lockStructure(artifact);
        break;

      case 'STEP_03_TAMPAK_DEPAN':
        artifact = await this.renderer.renderFrontElevation(state);
        this.artifacts['STEP_03_TAMPAK_DEPAN'] = artifact;
        this.stateManager.completeElevation('front', artifact);
        break;

      case 'STEP_04_TAMPAK_KIRI':
        artifact = await this.renderer.renderLeftElevation(state);
        this.artifacts['STEP_04_TAMPAK_KIRI'] = artifact;
        this.stateManager.completeElevation('left', artifact);
        break;

      case 'STEP_05_TAMPAK_KANAN':
        artifact = await this.renderer.renderRightElevation(state);
        this.artifacts['STEP_05_TAMPAK_KANAN'] = artifact;
        this.stateManager.completeElevation('right', artifact);
        break;

      case 'STEP_06_TAMPAK_BELAKANG':
        artifact = await this.renderer.renderRearElevation(state);
        this.artifacts['STEP_06_TAMPAK_BELAKANG'] = artifact;
        this.stateManager.completeElevation('rear', artifact);
        break;

      case 'STEP_07_MODEL_3D':
        artifact = await this.renderer.render3DModel(state);
        this.artifacts['STEP_07_MODEL_3D'] = artifact;
        this.stateManager.complete3DModel(artifact);
        break;

      case 'STEP_08_HOLOGRAM_3D':
        artifact = await this.renderer.renderHologram(state);
        this.artifacts['STEP_08_HOLOGRAM_3D'] = artifact;
        this.stateManager.completeHologram(artifact);
        break;

      default:
        throw new Error(`Unknown architectural production step: ${stepId}`);
    }

    return {
      stepId,
      artifact,
      nextStep: this.stateManager.getState().currentStep,
      state: this.stateManager.getState()
    };
  }

  /**
   * Executes all 8 production steps sequentially.
   */
  async produceAllSteps() {
    const steps = [
      'STEP_01_DENAH',
      'STEP_02_STRUKTUR',
      'STEP_03_TAMPAK_DEPAN',
      'STEP_04_TAMPAK_KIRI',
      'STEP_05_TAMPAK_KANAN',
      'STEP_06_TAMPAK_BELAKANG',
      'STEP_07_MODEL_3D',
      'STEP_08_HOLOGRAM_3D'
    ];

    const results = [];
    for (const step of steps) {
      console.log(`[ARCHITECTURAL_STUDIO] Producing ${step}...`);
      const res = await this.produceStep(step);
      results.push(res);
    }

    // Run QA on completion
    const qaReport = this.runQA();

    return {
      status: 'ALL_STEPS_COMPLETED',
      stepsCount: results.length,
      artifacts: this.artifacts,
      qaReport,
      finalState: this.stateManager.getState()
    };
  }

  /**
   * Applies user revision instruction and flags affected components.
   */
  applyRevision(revisionInstruction) {
    const state = this.stateManager.getState();
    const evaluation = this.revisionEngine.evaluateRevision(revisionInstruction, state);
    const updatedState = this.revisionEngine.applyRevision(evaluation, this.stateManager);

    return {
      status: 'REVISION_APPLIED',
      evaluation,
      updatedState
    };
  }

  /**
   * Runs the multi-factor architectural QA check.
   */
  runQA() {
    const state = this.stateManager.getState();
    return this.qa.evaluateProject(state, this.artifacts);
  }
}

export const architecturalStudioInstance = new ArchitecturalStudio();
export default architecturalStudioInstance;
