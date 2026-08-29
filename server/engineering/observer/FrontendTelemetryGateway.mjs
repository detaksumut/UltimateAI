/**
 * FrontendTelemetryGateway.mjs
 * Real receiver for frontend runtime errors, unhandled rejections, and click telemetry.
 */

import { incidentQueueInstance } from '../queue/IncidentQueue.mjs';
import { createIncidentTicket, IncidentSeverity } from '../types/IncidentTypes.mjs';

export class FrontendTelemetryGateway {
  constructor() {
    this.queue = incidentQueueInstance;
    this.activeMetrics = {
      fps: 60,
      clickSuccessRate: 100,
      renderDriftMs: 0,
      lastHeartbeat: Date.now()
    };
  }

  processTelemetry(payload) {
    if (!payload || typeof payload !== 'object') return null;

    const { type, error, component, selector, severity, metadata } = payload;
    this.activeMetrics.lastHeartbeat = Date.now();

    if (metadata && metadata.fps !== undefined) {
      this.activeMetrics.fps = metadata.fps;
    }
    if (metadata && metadata.clickSuccessRate !== undefined) {
      this.activeMetrics.clickSuccessRate = metadata.clickSuccessRate;
    }

    // If payload contains an error or interaction failure, enqueue real incident
    if (type === 'ERROR' || type === 'CLICK_DROPPED' || type === 'UNHANDLED_REJECTION') {
      const ticket = createIncidentTicket({
        source: 'frontend',
        category: type === 'CLICK_DROPPED' ? 'DOM_INTERACTION_FAILURE' : 'FRONTEND_RUNTIME_EXCEPTION',
        errorMessage: error || 'Unspecified frontend anomaly',
        targetComponent: component || 'UnknownComponent',
        elementSelector: selector || '',
        severity: severity || (type === 'CLICK_DROPPED' ? IncidentSeverity.HIGH : IncidentSeverity.MEDIUM),
        metadata: { ...metadata, activeMetrics: { ...this.activeMetrics } }
      });

      const enqueued = this.queue.enqueue(ticket);
      console.log(`ðŸš¨ [FrontendTelemetry] Captured Anomaly [${type}]: ${ticket.errorMessage} (Queue Size: ${this.queue.getAllIncidents().length})`);
      return enqueued;
    }

    return { status: 'HEARTBEAT_ACK', metrics: this.activeMetrics };
  }

  getMetrics() {
    return { ...this.activeMetrics };
  }
}

export const frontendTelemetryGatewayInstance = new FrontendTelemetryGateway();
