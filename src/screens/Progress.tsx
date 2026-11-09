import { useState } from 'react';
import { strengthSeries, trackedExercises, weekConsistency, weeklyReport, weightSeries } from '../lib/analytics';
import { getExercise } from '../lib/exercises';
import { getState, replaceState, setState, useStore } from '../lib/store';
import type { BodyLog } from '../lib/types';
import { addDays, avg, fmtDate, fromDisplayWeight, todayISO, toDisplayWeight, uid, weekStart, weightUnit } from '../lib/util';
import { Bars, Icon, LineChart, Seg, toast } from '../ui/kit';

function WeeklyReportCard() {
  const state = useStore((s) => s);
  const p = state.profile!;
  const today = todayISO();
  const [start, setStart] = useState(weekStart(today));
  const r = weeklyReport(state, start, today);
  const u = weightUnit(p.units);
  return (
    <div className="card">
      <div className="card-head">
        <button className="icon-btn plain" aria-label="Previous week" onClick={() => setStart(addDays(start, -7))}><Icon name="back" /></button>
        <div style={{ textAlign: 'center' }}><div className="label">Weekly report</div><b>{fmtDate(r.start, today)} – {fmtDate(r.end, today)}</b></div>
        <button className="icon-btn plain" aria-label="Next week" disabled={start >= weekStart(today)} onClick={() => setStart(addDays(start, 7))}><Icon name="chevron" /></button>
      </div>
      <div className="grid3">
        <div className="stat"><div className="v">{r.consistency.completed + r.consistency.partial}/{r.consistency.planned}</div><div className="k">workouts</div></div>
        <div className="stat"><div className="v">{r.avgProtein ?? '—'}<span className="small muted">g</span></div><div className="k">avg protein</div></div>
        <div className="stat"><div className="v">{r.weight.avgThis != null ? toDisplayWeight(r.weight.avgThis, p.units) : '—'}</div><div className="k">avg {u}</div></div>
      </div>
      <div className="small col">
        <div className="row wrap tiny muted">
          <span>✓ {r.consistency.completed} completed</span><span>◐ {r.consistency.partial} partial</span><span>✗ {r.consistency.missed} missed</span><span>↷ {r.consistency.skipped} skipped</span>{r.consistency.unreported > 0 && <span>? {r.consistency.unreported} unreported</span>}
        </div>
        {r.nutritionDays > 0 && <div className="tiny muted">Nutrition: {r.nutritionDays} day{r.nutritionDays === 1 ? '' : 's'} logged · avg {r.avgKcal} kcal · protein target hit {r.proteinHitDays}/{r.nutritionDays} days · calories within 10% on {r.calorieInRangeDays} days</div>}
      </div>
      {r.wins.length > 0 && <div className="col"><div className="label" style={{ color: 'var(--accent)' }}>Went well</div><ul className="plain small">{r.wins.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      {r.improve.length > 0 && <div className="col"><div className="label" style={{ color: 'var(--amber)' }}>Needs attention</div><ul className="plain small">{r.improve.map((x) => <li key={x}>{x}</li>)}</ul></div>}
      <div className="col"><div className="label">Next week</div><ul className="plain small">{r.next.map((x) => <li key={x}>{x}</li>)}</ul></div>
      {r.strength.length > 0 && (
        <div className="col"><div className="label">Strength (est. 1-rep max)</div>
          {r.strength.slice(0, 6).map((s) => <div key={s.exerciseId} className="ex-line small"><span>{s.name}</span><span className="p" style={{ color: s.pct > 1 ? 'var(--accent)' : s.pct < -1 ? 'var(--red)' : undefined }}>{s.pct >= 0 ? '+' : ''}{s.pct.toFixed(1)}%</span></div>)}
        </div>
      )}
    </div>
  );
}

function Consistency() {
  const state = useStore((s) => s);
  const today = todayISO();
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(today), -7 * (7 - i)));
  const data = weeks.map((w) => weekConsistency(state, w, today));
  const total = data.reduce((a, d) => ({ p: a.p + d.planned, c: a.c + d.completed, pa: a.pa + d.partial, m: a.m + d.missed + d.skipped }), { p: 0, c: 0, pa: 0, m: 0 });
  return (
    <div className="card">
      <div className="label">Consistency · last 8 weeks</div>
      <Bars data={data.map((d) => ({ label: fmtDate(d.start, today).replace(/^\w+ /, ''), total: Math.max(d.planned, 1), parts: [{ v: d.completed, color: 'var(--accent)' }, { v: d.partial, color: 'var(--amber)' }, { v: d.missed + d.skipped, color: 'var(--red)' }] }))} max={Math.max(1, ...data.map((d) => d.planned))} />
      <div className="grid4">
        <div className="stat"><div className="v">{total.p}</div><div className="k">planned</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--accent)' }}>{total.c}</div><div className="k">completed</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--amber)' }}>{total.pa}</div><div className="k">partial</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--red)' }}>{total.m}</div><div className="k">missed</div></div>
      </div>
      <p className="tiny dim">Only days up to today count. Unreported workouts are excluded from missed — report them for an accurate picture.</p>
    </div>
  );
}

function Body() {
  const state = useStore((s) => s);
  const p = state.profile!;
  const u = weightUnit(p.units);
  const lenU = p.units === 'imperial' ? 'in' : 'cm';
  const toLen = (cm?: number) => (cm == null ? '' : p.units === 'imperial' ? (cm / 2.54).toFixed(1) : cm.toFixed(1));
  const fromLen = (v: string) => (v ? (p.units === 'imperial' ? parseFloat(v) * 2.54 : parseFloat(v)) : undefined);
  const [f, setF] = useState({ date: todayISO(), weight: '', waist: '', chest: '', arms: '', thighs: '' });
  const series = weightSeries(state);
  const pts = series.map((s) => ({ x: s.date, y: toDisplayWeight(s.kg, p.units) }));
  const avgPts = series.map((s) => ({ x: s.date, y: toDisplayWeight(avg(series.filter((x) => x.date <= s.date && x.date > addDays(s.date, -7)).map((x) => x.kg)), p.units) }));
  const save = () => {
    const entry: BodyLog = { id: uid(), date: f.date, weightKg: f.weight ? fromDisplayWeight(parseFloat(f.weight), p.units) : undefined, waistCm: fromLen(f.waist), chestCm: fromLen(f.chest), armsCm: fromLen(f.arms), thighsCm: fromLen(f.thighs) };
    setState((s) => ({ ...s, body: [...s.body, entry], profile: entry.weightKg && f.date >= (s.body.filter((b) => b.weightKg).map((b) => b.date).sort().pop() ?? '') ? { ...s.profile!, weightKg: entry.weightKg } : s.profile }));
    setF({ ...f, weight: '', waist: '', chest: '', arms: '', thighs: '' });
    toast('Saved');
  };
  const measures = [...state.body].filter((b) => b.waistCm || b.chestCm || b.armsCm || b.thighsCm).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="card">
        <div className="card-head"><div className="label">Body weight</div><span className="tiny muted">target {toDisplayWeight(p.targetWeightKg, p.units)} {u}</span></div>
        <LineChart series={[{ pts, color: 'var(--dim)', dots: true }, { pts: avgPts, color: 'var(--accent)' }]} target={toDisplayWeight(p.targetWeightKg, p.units)} fmt={(n) => n.toFixed(0)} />
        <p className="tiny dim">Green line = 7-day average. Daily weight swings by 1–2% from water and food, so judge progress by the average, not single days.</p>
      </div>
      <div className="card">
        <div className="label">Log measurements</div>
        <div className="grid2">
          <label className="field"><span>Date</span><input className="input" type="date" max={todayISO()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="field"><span>Weight ({u})</span><input className="input" inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></label>
          <label className="field"><span>Waist ({lenU})</span><input className="input" inputMode="decimal" value={f.waist} onChange={(e) => setF({ ...f, waist: e.target.value })} /></label>
          <label className="field"><span>Chest ({lenU})</span><input className="input" inputMode="decimal" value={f.chest} onChange={(e) => setF({ ...f, chest: e.target.value })} /></label>
          <label className="field"><span>Arms ({lenU})</span><input className="input" inputMode="decimal" value={f.arms} onChange={(e) => setF({ ...f, arms: e.target.value })} /></label>
          <label className="field"><span>Thighs ({lenU})</span><input className="input" inputMode="decimal" value={f.thighs} onChange={(e) => setF({ ...f, thighs: e.target.value })} /></label>
        </div>
        <button className="btn primary" disabled={!f.weight && !f.waist && !f.chest && !f.arms && !f.thighs} onClick={save}>Save</button>
      </div>
      {(series.length > 0 || measures.length > 0) && (
        <div className="card">
          <div className="label">Entries</div>
          <div className="list">{[...state.body].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((b) => (
            <div key={b.id} className="list-item small">
              <span className="muted" style={{ width: 84 }}>{fmtDate(b.date)}</span>
              <span className="grow">{[b.weightKg && `${toDisplayWeight(b.weightKg, p.units)} ${u}`, b.waistCm && `waist ${toLen(b.waistCm)}`, b.chestCm && `chest ${toLen(b.chestCm)}`, b.armsCm && `arms ${toLen(b.armsCm)}`, b.thighsCm && `thighs ${toLen(b.thighsCm)}`].filter(Boolean).join(' · ')}</span>
              <button className="icon-btn plain" aria-label="Delete entry" onClick={() => { const prev = getState(); setState((s) => ({ ...s, body: s.body.filter((x) => x.id !== b.id) })); toast('Entry deleted', () => replaceState(prev)); }}><Icon name="trash" /></button>
            </div>
          ))}</div>
        </div>
      )}
    </>
  );
}

function Strength() {
  const state = useStore((s) => s);
  const p = state.profile!;
  const ids = trackedExercises(state);
  const [sel, setSel] = useState(ids[0]);
  if (!ids.length) return <div className="empty">Track a workout set-by-set to see strength progression here.</div>;
  const cur = ids.includes(sel) ? sel : ids[0];
  const s = strengthSeries(state, cur);
  const u = weightUnit(p.units);
  return (
    <div className="card">
      <div className="chips scroll">{ids.map((id) => <button key={id} className={`chip ${cur === id ? 'on' : ''}`} onClick={() => setSel(id)}>{getExercise(id).name}</button>)}</div>
      <LineChart series={[{ pts: s.map((x) => ({ x: x.date, y: toDisplayWeight(x.best, p.units) })), color: 'var(--accent)', dots: true }, { pts: s.map((x) => ({ x: x.date, y: toDisplayWeight(x.top, p.units) })), color: 'var(--blue)', dashed: true, dots: true }]} fmt={(n) => n.toFixed(0)} />
      <p className="tiny dim"><span style={{ color: 'var(--accent)' }}>●</span> estimated 1-rep max &nbsp; <span style={{ color: 'var(--blue)' }}>●</span> heaviest set</p>
      <div className="list">{[...s].reverse().map((x) => (
        <div key={x.date} className="ex-line small list-item"><span className="muted">{fmtDate(x.date)}</span><span>{toDisplayWeight(x.top, p.units)} {u} top · est. 1RM {toDisplayWeight(x.best, p.units)} {u}</span></div>
      ))}</div>
      {s.length === 1 && <p className="small muted">One session so far — progression appears after your next one.</p>}
    </div>
  );
}

export default function Progress() {
  const [tab, setTab] = useState<'overview' | 'body' | 'strength'>('overview');
  return (
    <>
      <div className="topbar"><h1>Progress</h1></div>
      <div className="page">
        <Seg value={tab} onChange={setTab} options={[{ v: 'overview', l: 'Overview' }, { v: 'body', l: 'Body' }, { v: 'strength', l: 'Strength' }]} />
        {tab === 'overview' && <><WeeklyReportCard /><Consistency /></>}
        {tab === 'body' && <Body />}
        {tab === 'strength' && <Strength />}
      </div>
    </>
  );
}
