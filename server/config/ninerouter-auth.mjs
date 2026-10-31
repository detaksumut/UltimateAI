/**
 * 9Router API-key resolution.
 *
 * Keep compatibility with both historical environment names used by local
 * launchers and the canonical NINEROUTER_KEY used by UltimateAI.
 * Never log or expose the resolved secret.
 */
const PLACEHOLDER_KEYS = new Set([
  '',
  'undefined',
  'YOUR_NINEROUTER_KEY',
  'NINEROUTER_KEY_ANDA',
  'YOUR_NINE_ROUTER_API_KEY'
]);

export function resolveNineRouterApiKey(env = process.env) {
  // NINE_ROUTER_API_KEY is checked first because some existing local launchers
  // export this spelling. Fall back to the canonical/older spellings.
  for (const name of ['NINE_ROUTER_API_KEY', 'NINEROUTER_API_KEY', 'NINEROUTER_KEY']) {
    const value = String(env?.[name] || '').trim();
    if (value && !PLACEHOLDER_KEYS.has(value.toUpperCase())) return value;
  }
  return '';
}

export default resolveNineRouterApiKey;
