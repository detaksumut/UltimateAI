/**
 * TradingViewScaleCalculator.js
 * Precision Price & Time Scale Calculation for TradingView-style charts.
 */

/**
 * Calculates a TradingView-style clean round price step interval.
 * Returns standard steps: 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, etc.
 *
 * @param {number} range - Total price span (maxPrice - minPrice)
 * @param {number} targetSteps - Desired number of grid steps (default: 7)
 * @returns {number} Clean rounded price step
 */
export function calculateTradingViewStep(range, targetSteps = 7) {
  if (!range || range <= 0) return 1;
  const rawStep = range / targetSteps;
  const power = Math.floor(Math.log10(rawStep));
  const magnitude = Math.pow(10, power);
  const normalized = rawStep / magnitude;

  let niceFactor;
  if (normalized < 1.4) niceFactor = 1;
  else if (normalized < 2.2) niceFactor = 2;
  else if (normalized < 3.8) niceFactor = 2.5;
  else if (normalized < 7.5) niceFactor = 5;
  else niceFactor = 10;

  return niceFactor * magnitude;
}

/**
 * Generates an array of clean rounded price grid levels.
 *
 * @param {number} minPrice
 * @param {number} maxPrice
 * @param {number} step
 * @returns {number[]}
 */
export function generatePriceGridLevels(minPrice, maxPrice, step) {
  if (!step || step <= 0 || minPrice >= maxPrice) return [];
  const firstGrid = Math.ceil(minPrice / step) * step;
  const levels = [];
  for (let p = firstGrid; p <= maxPrice; p += step) {
    levels.push(Number(p.toFixed(4)));
  }
  return levels;
}

/**
 * Formats price label according to the step resolution.
 *
 * @param {number} price
 * @param {number} step
 * @param {string} locale
 * @returns {string}
 */
export function formatTradingViewPrice(price, step = 1, locale = 'en-US') {
  if (!Number.isFinite(price)) return '';
  const decimals = step < 0.1 ? 3 : (step < 1 ? 2 : (step % 1 !== 0 ? 1 : 2));
  return price.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

