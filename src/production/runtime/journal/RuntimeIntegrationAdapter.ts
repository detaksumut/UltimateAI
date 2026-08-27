export interface LearningSignals {
  readonly ambiguityLevel: number;
  readonly overallConfidence: number;
  readonly failedComplianceCount: number;
  readonly warningCount: number;
}

export interface TraceRecord {
  readonly requirementId: string;
  readonly analysisId: string;
  readonly blueprintId: string;
  readonly foundationBaseline: string;
  readonly blueprintVersion: string;
  readonly blueprintHash: string;
}

export interface RuntimeBus {
  publishEvent(name: string, payload: any): void;
  getPublishedEvents(): { name: string; payload: any }[];
}

/**
 * RuntimeIntegrationAdapter - Adapter Integrasi Runtime
 * Mengirimkan pesan terdekop via Runtime Bus sesuai prinsip UAI-FB-1.0
 */
export class RuntimeIntegrationAdapter {
  private readonly bus: RuntimeBus;

  constructor(bus: RuntimeBus) {
    this.bus = bus;
  }

  /**
   * Mengirim sinyal pembelajaran (Learning Signals) ke Evolution Runtime via Runtime Bus
   */
  sendEvolutionSignals(signals: LearningSignals): void {
    this.bus.publishEvent("EvolutionSignalEmitted", {
      timestamp: Date.now(),
      signals
    });
  }

  /**
   * Menyimpan traceability audit trail ke Memory Runtime via Runtime Bus
   */
  storeTraceability(record: TraceRecord): void {
    this.bus.publishEvent("TraceabilityStored", {
      timestamp: Date.now(),
      record
    });
  }
}
