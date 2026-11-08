import React from 'react';

const SIDES = [
  {
    id: 'SUPPLY',
    color: '#fb7185',
    border: 'rgba(251,113,133,0.35)',
    background: 'rgba(251,113,133,0.08)',
  },
  {
    id: 'DEMAND',
    color: '#34d399',
    border: 'rgba(52,211,153,0.35)',
    background: 'rgba(52,211,153,0.08)',
  },
];

const ROLES = [
  { id: 'ENTRY', color: null },
  { id: 'SL', color: '#fbbf24' },
  { id: 'TP', color: '#67e8f9' },
];

const ui = {
  wrap: {
    flexShrink: 0,
    padding: '8px 10px 9px',
    borderTop: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(2,6,23,0.55)',
  },
  sides: {
    display: 'grid',
    gap: 6,
  },
  sideRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '5px 14px',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 9px',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  },
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10.5,
  },
  price: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontWeight: 700,
    color: '#e2e8f0',
  },
  note: {
    fontSize: 9.5,
    color: '#64748b',
    lineHeight: 1.5,
    marginTop: 6,
  },
};

function fmtPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return Math.abs(num) >= 100 ? num.toFixed(2) : num.toFixed(4);
}

function findLevel(levels, side, role) {
  const key = `${side} ${role}`;
  return levels.find((level) => (
    String(level?.label || '').split('/').map((part) => part.trim()).includes(key)
  )) || null;
}

export default function M1LevelLegend({ data }) {
  const levels = Array.isArray(data?.levels) ? data.levels : [];
  if (levels.length === 0) return null;

  return (
    <div style={ui.wrap} aria-label="Level preview M1">
      <div style={ui.sides}>
        {SIDES.map((side) => {
          const rows = ROLES.map((role) => ({
            ...role,
            price: findLevel(levels, side.id, role.id)?.price,
          }));
          if (!rows.some((role) => Number.isFinite(Number(role.price)))) return null;
          return (
            <div key={side.id} style={ui.sideRow}>
              <span
                style={{
                  ...ui.pill,
                  color: side.color,
                  border: `1px solid ${side.border}`,
                  background: side.background,
                }}
              >
                {side.id}
              </span>
              {rows.map((role) => {
                const price = Number(role.price);
                if (!Number.isFinite(price)) return null;
                const color = role.color || side.color;
                return (
                  <span key={role.id} style={ui.item}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ color: '#94a3b8' }}>{role.id}</span>
                    <span style={ui.price}>{fmtPrice(price)}</span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={ui.note}>
        ENTRY solid, SL dashed, TP dotted. Level ini preview dari zona M1 XM, bukan order.
        Chart JIN memakai OHLC XM tervalidasi; chart native XM tidak diinjeksi.
      </div>
    </div>
  );
}
