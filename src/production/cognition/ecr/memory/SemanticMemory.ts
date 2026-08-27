import { WorkspaceEventBus, WorkspaceEventType } from '../perception/WorkspaceEventBus';

export interface ISemanticNode {
  id: string;
  term: string;
  summary: string;
  references: string[];
}

/**
 * Semantic Memory
 * Stores meaning, knowledge, documentation, and terminology.
 * It does NOT store raw code, only the semantic essence.
 */
export class SemanticMemory {
  private nodes: Map<string, ISemanticNode> = new Map();

  constructor(bus: WorkspaceEventBus) {
    // React to perception events
    bus.subscribe(WorkspaceEventType.FILE_SAVED, async (event) => {
      if (event.payload.file.endsWith('.md')) {
        await this.ingestDocumentation(event.payload.file, event.payload.content);
      }
    });
  }

  private async ingestDocumentation(file: string, content: string): Promise<void> {
    // In reality, this would use embeddings or a semantic parser
    this.nodes.set(file, {
      id: file,
      term: file,
      summary: 'Automatically ingested semantic knowledge',
      references: []
    });
  }

  public query(term: string): ISemanticNode | undefined {
    return this.nodes.get(term);
  }
}
