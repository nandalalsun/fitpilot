import { useEffect, useState, type ReactNode } from 'react';
import { STATUS_LABEL } from '../lib/training';
import type { WorkoutStatus } from '../lib/types';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const icons: Record<string, ReactNode> = {
  home: <path {...P} d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  dumbbell: <g {...P}><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></g>,
  food: <g {...P}><path d="M7 3v8a2 2 0 0 0 2 2v8M11 3v6M7 7h4M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" /></g>,
  coach: <g {...P}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" /><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" /></g>,
  chart: <g {...P}><path d="M4 20V4M4 20h16" /><path d="m7 15 4-4 3 3 5-6" /></g>,
  settings: <g {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14.1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9.9 4.6V4.5a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></g>,
  check: <path {...P} strokeWidth={2.6} d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path {...P} d="M6 6l12 12M18 6 6 18" />,
  plus: <path {...P} d="M12 5v14M5 12h14" />,
  minus: <path {...P} d="M5 12h14" />,
  swap: <g {...P}><path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" /></g>,
  info: <g {...P}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></g>,
  camera: <g {...P}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></g>,
  pen: <g {...P}><path d="M4 20h4L19 9l-4-4L4 16z" /></g>,
  search: <g {...P}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></g>,
  trash: <g {...P}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></g>,
  chevron: <path {...P} d="m9 6 6 6-6 6" />,
  back: <path {...P} d="m15 6-6 6 6 6" />,
  pause: <g {...P}><path d="M9 5v14M15 5v14" /></g>,
  play: <path {...P} d="M7 5v14l11-7z" />,
  skip: <g {...P}><path d="M5 5v14l9-7zM18 5v14" /></g>,
  send: <path {...P} d="m4 12 16-8-6 16-2.5-6.5z" />,
  bell: <g {...P}><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 21h4" /></g>,
  sparkle: <g {...P}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></g>,
  calendar: <g {...P}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></g>,
  star: <path {...P} d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z" />,
};

export function Icon({ name, size }: { name: keyof typeof icons | string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{icons[name]}</svg>;
}

export function StatusBadge({ status }: { status: WorkoutStatus | 'unreported' }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status]}</span>;
}

export function Sheet({ title, onClose, children, full, footer }: { title?: ReactNode; onClose: () => void; children: ReactNode; full?: boolean; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="sheet-wrap" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`sheet ${full ? 'full' : ''}`} onClick={(e) => e.stopPropagation()}>
        {!full && <div className="grabber" />}
        <div className="sheet-head">
          <h2 className="grow">{title}</h2>
          <button className="icon-btn plain" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
        {footer}
      </div>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="check">
      <span>{label}</span>
      <button type="button" className={`switch ${on ? 'on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)} />
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: ReactNode }[]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map((o) => <button key={o.v} className={value === o.v ? 'on' : ''} onClick={() => onChange(o.v)}>{o.l}</button>)}</div>;
}

export function Stepper({ value, onChange, step, min = 0, unit, label }: { value: number; onChange: (v: number) => void; step: number; min?: number; unit?: string; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div className="stepper">
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}>−</button>
      <input inputMode="decimal" aria-label={label} value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { const n = parseFloat(text); if (!isNaN(n) && n >= min) onChange(n); else setText(String(value)); }}
        onFocus={(e) => e.target.select()} />
      {unit && <span className="u">{unit}</span>}
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(+(value + step).toFixed(2))}>+</button>
    </div>
  );
}

export function Ring({ value, max, size = 92, stroke = 9, color = 'var(--accent)', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max * 1.05;
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg-2)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={over ? 'var(--amber)' : color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

export function MacroBar({ label, value, target, color, unit = 'g' }: { label: string; value: number; target: number; color: string; unit?: string }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row between small"><span className="muted">{label}</span><span><b>{Math.round(value)}</b><span className="dim"> / {target}{unit}</span></span></div>
      <div className="bar"><i style={{ width: `${Math.min(100, (value / Math.max(1, target)) * 100)}%`, background: color }} /></div>
    </div>
  );
}

export interface Pt { x: string; y: number }

export function LineChart({ series, height = 150, fmt = (n) => String(Math.round(n)), target }: { series: { pts: Pt[]; color: string; dashed?: boolean; dots?: boolean }[]; height?: number; fmt?: (n: number) => string; target?: number }) {
  const all = series.flatMap((s) => s.pts);
  if (all.length < 2) return <div className="empty small">Not enough data yet — log a few more entries to see a trend.</div>;
  const xs = [...new Set(all.map((p) => p.x))].sort();
  const ys = all.map((p) => p.y).concat(target != null ? [target] : []);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const W = 320, H = height, L = 34, B = 18;
  const X = (x: string) => L + (xs.indexOf(x) / Math.max(1, xs.length - 1)) * (W - L - 6);
  const Y = (y: number) => 6 + (1 - (y - lo) / (hi - lo)) * (H - B - 6);
  const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
      {ticks.map((t) => <g key={t}><line x1={L} x2={W} y1={Y(t)} y2={Y(t)} stroke="var(--line)" strokeDasharray="2 4" /><text x={L - 4} y={Y(t) + 3} textAnchor="end">{fmt(t)}</text></g>)}
      {target != null && <line x1={L} x2={W} y1={Y(target)} y2={Y(target)} stroke="var(--violet)" strokeDasharray="5 4" opacity={0.7} />}
      {series.map((s, i) => (
        <g key={i}>
          <polyline fill="none" stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dashed ? '4 4' : undefined} strokeLinejoin="round" strokeLinecap="round" points={s.pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} />
          {s.dots && s.pts.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={2.6} fill={s.color} />)}
        </g>
      ))}
      <text x={L} y={H - 4}>{xs[0].slice(5)}</text>
      <text x={W - 4} y={H - 4} textAnchor="end">{xs[xs.length - 1].slice(5)}</text>
    </svg>
  );
}

export function Bars({ data, height = 120, max }: { data: { label: string; parts: { v: number; color: string }[]; total?: number }[]; height?: number; max?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.total ?? d.parts.reduce((a, p) => a + p.v, 0)));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 6, alignItems: 'end', height }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: 28, display: 'flex', flexDirection: 'column-reverse', height: '82%', justifyContent: 'flex-start', background: 'var(--bg-2)', borderRadius: 6, overflow: 'hidden' }}>
            {d.parts.map((p, i) => <div key={i} style={{ height: `${(p.v / m) * 100}%`, background: p.color, transition: 'height .4s' }} />)}
          </div>
          <span className="tiny dim">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

let toastSet: ((t: { msg: string; undo?: () => void } | null) => void) | null = null;
export function toast(msg: string, undo?: () => void) { toastSet?.({ msg, undo }); }
export function ToastHost() {
  const [t, setT] = useState<{ msg: string; undo?: () => void } | null>(null);
  useEffect(() => { toastSet = setT; return () => { toastSet = null; }; }, []);
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), t.undo ? 5000 : 2600); return () => clearTimeout(id); }, [t]);
  if (!t) return null;
  return <div className="toast" role="status"><span>{t.msg}</span>{t.undo && <button onClick={() => { t.undo!(); setT(null); }}>Undo</button>}</div>;
}
