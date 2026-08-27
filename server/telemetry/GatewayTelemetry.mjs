/**
 * GatewayTelemetry.mjs
 * Genuine, un-fabricated server-side execution telemetry logger for 9Router Gateway.
 */

export class GatewayTelemetry {
  static logEvent(type, payload = {}) {
    const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
    const entry = {
      timestamp,
      type,
      ...payload
    };
    
    console.log(`[9ROUTER TELEMETRY ${timestamp}] [${type}]`, JSON.stringify(payload));
    return entry;
  }
}

export default GatewayTelemetry;
