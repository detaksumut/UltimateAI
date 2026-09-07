/**
 * GatewayTelemetry.mjs
 * Genuine, un-fabricated server-side execution telemetry logger for Local Router Gateway.
 */

export class GatewayTelemetry {
  static logEvent(type, payload = {}) {
    const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
    const entry = {
      timestamp,
      type,
      ...payload
    };
    
    console.log(`[LOCAL ROUTER TELEMETRY ${timestamp}] [${type}]`, JSON.stringify(payload));
    return entry;
  }
}

export default GatewayTelemetry;
