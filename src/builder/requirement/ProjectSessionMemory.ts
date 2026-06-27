// src/builder/requirement/ProjectSessionMemory.ts

import { ProjectIntelligenceModel } from './ProjectIntelligenceEngine';
import { RenderedPrototype } from '../prototype/SimulatorRenderer';

export interface SessionState {
  model: ProjectIntelligenceModel;
  prototype: RenderedPrototype;
}

export class ProjectSessionMemory {
  private undoStack: SessionState[] = [];
  private redoStack: SessionState[] = [];
  private currentState: SessionState | null = null;

  public initialize(model: ProjectIntelligenceModel, prototype: RenderedPrototype): void {
    this.currentState = { model, prototype };
    this.undoStack = [];
    this.redoStack = [];
  }

  public recordState(model: ProjectIntelligenceModel, prototype: RenderedPrototype): void {
    if (this.currentState) {
      // Deep clone current state to avoid mutated memory refs
      this.undoStack.push(JSON.parse(JSON.stringify(this.currentState)));
    }
    this.currentState = { model, prototype };
    this.redoStack = []; // Clear redo stack on new action
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): SessionState | null {
    if (!this.canUndo()) return null;
    if (this.currentState) {
      this.redoStack.push(JSON.parse(JSON.stringify(this.currentState)));
    }
    const previous = this.undoStack.pop();
    if (previous) {
      this.currentState = previous;
      return previous;
    }
    return null;
  }

  public redo(): SessionState | null {
    if (!this.canRedo()) return null;
    if (this.currentState) {
      this.undoStack.push(JSON.parse(JSON.stringify(this.currentState)));
    }
    const next = this.redoStack.pop();
    if (next) {
      this.currentState = next;
      return next;
    }
    return null;
  }

  public getCurrentState(): SessionState | null {
    return this.currentState;
  }
}
