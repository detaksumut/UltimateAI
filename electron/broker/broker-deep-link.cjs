/**
 * Broker deep-link parser (main process).
 *
 * Official deep link:
 *   ultimateai://broker/open?broker=xm&platform=xm-web
 *
 * Only known broker adapters and their configured platforms are accepted.
 * The web UI uses this same scheme to hand off from the browser to the
 * installed desktop app without opening a new browser tab/window.
 */

const { getBroker, getPlatform } = require('./broker-adapters.cjs');

const BROKER_DEEP_LINK_PROTOCOL = 'ultimateai';

function parseBrokerDeepLink(raw) {
  if (!raw || typeof raw !== 'string') {
    return { ok: false, reason: 'empty_deep_link' };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'invalid_deep_link' };
  }

  if (parsed.protocol !== `${BROKER_DEEP_LINK_PROTOCOL}:`) {
    return { ok: false, reason: 'wrong_protocol' };
  }

  const host = String(parsed.hostname || '').toLowerCase();
  const path = String(parsed.pathname || '').replace(/\/+$/, '').toLowerCase();
  const isBrokerRoute = host === 'broker'
    || host === 'broker-workspace'
    || host === 'open-broker'
    || path.includes('/broker');
  if (!isBrokerRoute) {
    return { ok: false, reason: 'unsupported_deep_link_route' };
  }

  const brokerId = String(
    parsed.searchParams.get('broker')
      || parsed.searchParams.get('brokerId')
      || 'xm',
  ).toLowerCase();
  const platformParam = parsed.searchParams.get('platform')
    || parsed.searchParams.get('platformId')
    || null;

  const broker = getBroker(brokerId);
  if (!broker) return { ok: false, reason: 'unknown_broker', brokerId };
  if (!broker.enabled) return { ok: false, reason: 'broker_disabled', brokerId };

  const platform = getPlatform(broker, platformParam);
  if (!platform) {
    return {
      ok: false,
      reason: 'unknown_platform',
      brokerId: broker.id,
      platformId: platformParam,
    };
  }

  return {
    ok: true,
    brokerId: broker.id,
    platformId: platform.id,
    url: raw,
  };
}

module.exports = {
  BROKER_DEEP_LINK_PROTOCOL,
  parseBrokerDeepLink,
};
