/**
 * Local MT5 bridge symbol canonicalization tests.
 * Run: node tests/trading-symbols.test.mjs
 */

import assert from 'node:assert/strict';
import {
  JIN_TRADING_ALLOWED_SYMBOLS,
  canonicalTradingSymbol,
} from '../server/local_router/TradingSymbols.mjs';

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

console.log('Local trading symbol canonicalization tests');

check('maps XM GOLD and suffix variants to XAUUSD', () => {
  assert.equal(canonicalTradingSymbol('GOLD'), 'XAUUSD');
  assert.equal(canonicalTradingSymbol('GOLD.a'), 'XAUUSD');
  assert.equal(canonicalTradingSymbol('XAUUSD.a'), 'XAUUSD');
  assert.equal(canonicalTradingSymbol(' xauusd '), 'XAUUSD');
});

check('maps crypto and index aliases', () => {
  assert.equal(canonicalTradingSymbol('BTCUSD'), 'BTCUSDT');
  assert.equal(canonicalTradingSymbol('ETHUSD'), 'ETHUSDT');
  assert.equal(canonicalTradingSymbol('DJI'), 'US30');
  assert.equal(canonicalTradingSymbol('US30.cash'), 'US30');
});

check('keeps unknown symbols normalized without inventing an alias', () => {
  assert.equal(canonicalTradingSymbol('USOIL'), 'USOIL');
  assert.equal(canonicalTradingSymbol(''), '');
  assert.equal(canonicalTradingSymbol(null), '');
  assert.equal(canonicalTradingSymbol('xyz-abc'), 'XYZABC');
});

check('all canonical aliases are accepted by the bridge allowlist', () => {
  for (const raw of ['GOLD', 'GOLD.a', 'XAUUSD.a', 'BTCUSD', 'ETHUSD', 'DJI', 'US30.cash']) {
    assert.ok(JIN_TRADING_ALLOWED_SYMBOLS.includes(canonicalTradingSymbol(raw)));
  }
});

console.log(`\nTrading symbol tests passed: ${passed} checks.`);
