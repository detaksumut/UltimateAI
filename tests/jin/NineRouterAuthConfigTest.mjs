import assert from 'node:assert/strict';
import { resolveNineRouterApiKey } from '../../server/config/ninerouter-auth.mjs';

assert.equal(resolveNineRouterApiKey({ NINE_ROUTER_API_KEY: ' alias-key ' }), 'alias-key');
assert.equal(resolveNineRouterApiKey({ NINEROUTER_API_KEY: 'second-key' }), 'second-key');
assert.equal(resolveNineRouterApiKey({ NINEROUTER_KEY: 'canonical-key' }), 'canonical-key');
assert.equal(
  resolveNineRouterApiKey({
    NINE_ROUTER_API_KEY: 'NINEROUTER_KEY_ANDA',
    NINEROUTER_KEY: 'usable-key'
  }),
  'usable-key'
);
assert.equal(resolveNineRouterApiKey({ NINEROUTER_KEY: 'YOUR_NINEROUTER_KEY' }), '');
assert.equal(resolveNineRouterApiKey({}), '');

console.log('NineRouter auth key alias tests passed.');
