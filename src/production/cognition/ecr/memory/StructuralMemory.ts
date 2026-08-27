import { WorkspaceEventBus, WorkspaceEventType } from '../perception/WorkspaceEventBus';

export interface IStructuralNode {
  id: string;
  type: 'MODULE' | 'COMPONENT' | 'DATABASE';
  dependencies: string[]; // IDs of other structural nodes
}

/**
 * Structural Memory
 * Stores the Dependency Graph and Architecture Module boundaries.
 * Answers: "Who calls whom?" and "What breaks if I change this?"
 */
export class StructuralMemory {
  private architectureMap: Map<string, IStructuralNode> = new Map();

  constructor(bus: WorkspaceEventBus) {
    bus.subscribe(WorkspaceEventType.FILE_SAVED, async (event) => {
      if (event.payload.file.endsWith('.ts') || event.payload.file.endsWith('.tsx')) {
        await this.updateDependencies(event.payload.file, event.payload.astOrImports);
      }
    });
  }

  private async updateDependencies(file: string, imports: string[]): Promise<void> {
    this.architectureMap.set(file, {
      id: file,
      type: 'MODULE',
      dependencies: imports || []
    });
  }

  public getDependencies(id: string): string[] {
    return this.architectureMap.get(id)?.dependencies || [];
  }
}
