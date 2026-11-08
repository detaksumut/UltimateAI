import fs from 'fs';

const filePath = 'd:/Users/ultimateai/src/components/platform-trader/ProfessionalCandlestickChart.jsx';
let code = fs.readFileSync(filePath, 'utf8');

// Ensure calculateTradingViewStep is exported
if (!code.includes('export function calculateTradingViewStep')) {
  const exportFunc = `/**
 * Calculates a TradingView-style clean round price step interval (e.g. 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50).
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

`;
  code = code.replace("const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];", exportFunc + "const TIMEFRAMES = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];");
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('calculateTradingViewStep integrated successfully.');

