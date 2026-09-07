/**
 * MarketPanelRegistry.js
 * Client-side source of truth for MARKET INTELLIGENCE ROW WALL panels.
 *
 * Maps the API's `panels` array (each with `category`) into named ROW groups and
 * provides stable `market.<id>` identity + display metadata. This registry is
 * pure (no data fetching) — it arranges & labels whatever real data the pipeline
 * produced. It never invents panels or prices.
 */

export const ROW_DEFS = [
  {
    id: 'indonesia',
    title: '🇮🇩 INDONESIA VITALS',
    categories: ['indonesia'],
    priority: 100,
    accent: '#10b981'
  },
  {
    id: 'priority',
    title: '⭐ PRIORITY MARKETS',
    categories: ['indonesia', 'metals', 'energy', 'crypto', 'currency'],
    priority: 90,
    accent: '#fbbf24',
    // priority row = instruments flagged priority:true (unique)
    filter: (p) => p.priority === true
  },
  {
    id: 'currency',
    title: '💱 FOREX & VALAS',
    categories: ['currency'],
    priority: 80,
    accent: '#22d3ee'
  },
  {
    id: 'global',
    title: '📈 GLOBAL INDICES',
    categories: ['global'],
    priority: 70,
    accent: '#60a5fa'
  },
  {
    id: 'asia',
    title: '🌏 ASIA MARKETS',
    categories: ['asia'],
    priority: 60,
    accent: '#34d399'
  },
  {
    id: 'crypto',
    title: '🪙 CRYPTO',
    categories: ['crypto'],
    priority: 50,
    accent: '#a78bfa'
  },
  {
    id: 'energy',
    title: '🛢️ ENERGY',
    categories: ['energy'],
    priority: 40,
    accent: '#f97316'
  },
  {
    id: 'metals',
    title: '🟡 METALS',
    categories: ['metals'],
    priority: 30,
    accent: '#eab308'
  },
  {
    id: 'agriculture',
    title: '🌾 AGRICULTURE',
    categories: ['agriculture'],
    priority: 20,
    accent: '#84cc16'
  },
  {
    id: 'bonds',
    title: '🏦 BONDS & MACRO',
    categories: ['bonds'],
    priority: 10,
    accent: '#f472b6'
  }
];

export const CATEGORY_FILTERS = [
  { id: 'all', label: 'ALL', predicate: () => true },
  { id: 'indonesia', label: 'INDONESIA', predicate: (p) => p.category === 'indonesia' },
  { id: 'priority', label: 'PRIORITY', predicate: (p) => p.priority === true },
  { id: 'currency', label: 'FOREX', predicate: (p) => p.category === 'currency' },
  { id: 'global', label: 'GLOBAL', predicate: (p) => p.category === 'global' },
  { id: 'asia', label: 'ASIA', predicate: (p) => p.category === 'asia' },
  { id: 'crypto', label: 'CRYPTO', predicate: (p) => p.category === 'crypto' },
  { id: 'energy', label: 'ENERGY', predicate: (p) => p.category === 'energy' },
  { id: 'metals', label: 'METALS', predicate: (p) => p.category === 'metals' },
  { id: 'agriculture', label: 'AGRICULTURE', predicate: (p) => p.category === 'agriculture' },
  { id: 'bonds', label: 'BONDS', predicate: (p) => p.category === 'bonds' }
];

// Row layout: which rows belong to which category filter tab.
export function rowForCategory(category) {
  return ROW_DEFS.find((r) => r.categories.includes(category)) || null;
}

/**
 * Arrange a list of panels into named rows honoring the priority row.
 * Panels not covered by any row are grouped under "OTHER".
 */
export function arrangeRows(panels) {
  const byRow = new Map();
  const prioritySeen = new Set();
  const rows = [];

  ROW_DEFS.forEach((rowDef) => {
    let members;
    if (rowDef.filter) {
      members = panels.filter((p) => rowDef.filter(p) && !prioritySeen.has(p.id));
      members.forEach((p) => prioritySeen.add(p.id));
    } else {
      members = panels.filter((p) => rowDef.categories.includes(p.category) && !prioritySeen.has(p.id));
    }
    if (members.length > 0) {
      rows.push({ ...rowDef, members });
    }
  });

  // Leftover panels not matched by any named row.
  const leftover = panels.filter((p) => !prioritySeen.has(p.id) && !ROW_DEFS.some((r) => r.categories.includes(p.category)));
  if (leftover.length > 0) {
    rows.push({
      id: 'other',
      title: '🗂️ OTHER',
      categories: [],
      priority: 0,
      accent: '#94a3b8',
      members: leftover
    });
  }

  rows.sort((a, b) => b.priority - a.priority);
  return rows;
}

/**
 * Apply the active category filter to a panel list.
 */
export function filterPanels(panels, filterId) {
  const filter = CATEGORY_FILTERS.find((f) => f.id === filterId) || CATEGORY_FILTERS[0];
  return panels.filter(filter.predicate);
}

/**
 * Stable display metadata lookup by `market.<id>`.
 */
export function panelMeta(id) {
  return {
    id: String(id || '').toLowerCase()
  };
}

export default { ROW_DEFS, arrangeRows, filterPanels, CATEGORY_FILTERS, rowForCategory };
