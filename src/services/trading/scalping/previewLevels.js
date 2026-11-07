const SIDE_COLOR = {
  DEMAND: '#34d399',
  SUPPLY: '#fb7185',
};

function addLevel(map, price, label, color, style, lineWidth, side) {
  const num = Number(price);
  if (!Number.isFinite(num) || num <= 0) return;
  const key = num.toFixed(6);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, { price: num, labels: [label], color, style, lineWidth, side });
    return;
  }
  if (!existing.labels.includes(label)) existing.labels.push(label);
  existing.color = '#cbd5e1';
  existing.lineWidth = Math.max(existing.lineWidth, lineWidth);
  if (existing.style !== style) existing.style = 'solid';
}

export function buildPreviewLevels(scenarios = {}) {
  const byPrice = new Map();
  for (const scenario of [scenarios?.demand, scenarios?.supply]) {
    if (!scenario?.available) continue;
    const side = scenario.side === 'SUPPLY' ? 'SUPPLY' : 'DEMAND';
    const entryColor = SIDE_COLOR[side];
    addLevel(byPrice, scenario.entry, `${side} ENTRY`, entryColor, 'solid', 2, side);
    addLevel(byPrice, scenario.stopLoss, `${side} SL`, '#fbbf24', 'dashed', 1, side);
    addLevel(byPrice, scenario.takeProfit, `${side} TP`, '#67e8f9', 'dotted', 1, side);
  }
  return [...byPrice.values()].map(({ labels, ...level }) => ({
    ...level,
    label: labels.join(' / '),
  }));
}
