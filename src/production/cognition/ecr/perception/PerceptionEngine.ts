import { WorkspaceEventBus, WorkspaceEvent, WorkspaceEventType } from './WorkspaceEventBus';

export interface IPerceptionSource {
  name: string;
  initialize(bus: WorkspaceEventBus): Promise<void>;
}

/**
 * Engineering Perception
 * The sensory organ of the ECR. It does not think. It observes Reality 
 * (Filesystem, Git, CI) and translates them into Cognitive Events.
 */
export class PerceptionEngine {
  private bus: WorkspaceEventBus;
  private sources: IPerceptionSource[] = [];

  constructor(bus: WorkspaceEventBus) {
    this.bus = bus;
  }

  public async registerSource(source: IPerceptionSource): Promise<void> {
    this.sources.push(source);
    await source.initialize(this.bus);
  }

  public async perceiveManual(type: WorkspaceEventType, payload: any): Promise<void> {
    const event: WorkspaceEvent = {
      id: `evt_${Date.now()}`,
      type,
      timestamp: Date.now(),
      payload,
      source: 'manual_perception'
    };
    await this.bus.publish(event);
  }
}
