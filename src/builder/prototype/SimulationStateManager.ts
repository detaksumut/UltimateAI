// src/builder/prototype/SimulationStateManager.ts

export type SimulationLifecycleState = 'Draft' | 'Adjusted' | 'Reviewed' | 'Approved' | 'Generated';

export class SimulationStateManager {
  private currentState: SimulationLifecycleState = 'Draft';

  constructor(initialState?: SimulationLifecycleState) {
    if (initialState) {
      this.currentState = initialState;
    }
  }

  public getState(): SimulationLifecycleState {
    return this.currentState;
  }

  public transitionTo(nextState: SimulationLifecycleState): void {
    const allowedTransitions: Record<SimulationLifecycleState, SimulationLifecycleState[]> = {
      'Draft': ['Adjusted', 'Reviewed', 'Approved'],
      'Adjusted': ['Reviewed', 'Approved'],
      'Reviewed': ['Approved'],
      'Approved': ['Generated'],
      'Generated': []
    };

    const allowed = allowedTransitions[this.currentState];
    if (allowed && allowed.includes(nextState)) {
      this.currentState = nextState;
    }
  }

  public canGenerate(): boolean {
    return this.currentState === 'Approved';
  }
}
