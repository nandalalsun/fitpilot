import { useState } from 'react';
import { dayTotals, weekConsistency, weightTrend } from '../lib/analytics';
import { getExercise } from '../lib/exercises';
import { computeInsights } from '../lib/insights';
import { getState, replaceState, setState, useStore } from '../lib/store';
import { displayStatus, entryOn, suggestLoad, templateById, templateMuscles, musclesLabel } from '../lib/training';
import type { ScheduledWorkout } from '../lib/types';
import { addDays, DAY_SHORT, fmtDate, fmtWeight, fromDisplayWeight, todayISO, toDisplayWeight, uid, weekStart, weightUnit } from '../lib/util';
import { Icon, MacroBar, Ring, StatusBadge, toast } from '../ui/kit';
import { go } from '../ui/nav';
import { commit, DifferentWorkoutSheet, PartialSheet, RescheduleSheet } from '../ui/parts';
import { startWorkout } from './Workout';

export default function Home() {
  const state = useStore((s) => s);
  const p = state.profile!;
  const today = todayISO();
  const entry = entryOn(state, today);
  const tmpl = templateById(state.plan, entry?.templateId);
  const tot = dayTotals(state, today);
  const wk = weekConsistency(state, weekStart(today), today);
  const wt = weightTrend(state, today);
  const insights = computeInsights(state, today);
  const [sheet, setSheet] = useState<null | { kind: 'partial' | 'different' | 'reschedule'; id: string | null; date?: string }>(null);
  const [weightIn, setWeightIn] = useState('');
  const unreported = state.schedule.filter((s) => s.templateId && displayStatus(s, today) === 'unreported' && s.date >= addDays(today, -6));
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const active = state.sessions.find((s) => s.id === state.activeSessionId);

  function checkIn(e: ScheduledWorkout, kind: 'completed' | 'partial' | 'skipped' | 'rest' | 'different' | 'missed') {
    if (kind === 'partial') return setSheet({ kind: 'partial', id: e.id });
    if (kind === 'different') return setSheet({ kind: 'different', id: e.id, date: e.date });
    commit({ kind: 'set_status', scheduledId: e.id, status: kind }, kind === 'completed' ? 'Nice work — workout marked completed' : kind === 'rest' ? 'Rest day recorded' : `Marked ${kind}`);
    if (kind !== 'completed') setSheet({ kind: 'reschedule', id: e.id });
  }

  function logWeight() {
    const v = parseFloat(weightIn);
    if (!v) return;
    const kg = fromDisplayWeight(v, p.units);
    const prev = getState();
    setState((s) => ({ ...s, body: [...s.body.filter((b) => !(b.date === today && b.weightKg != null && !b.waistCm)), { id: uid(), date: today, weightKg: kg }], profile: { ...s.profile!, weightKg: kg } }));
    setWeightIn('');
    toast('Weight logged', () => replaceState(prev));
  }

  return (
    <>
      <div className="topbar">
        <div><div className="sub">{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</div><h1>{greet}{p.name ? `, ${p.name}` : ''}</h1></div>
        <button className="icon-btn" aria-label="Settings" onClick={() => go('settings')}><Icon name="settings" /></button>
      </div>
      <div className="page">
        {unreported.map((u) => (
          <div key={u.id} className="card tight">
            <div className="row between"><div><b>{fmtDate(u.date, today)}: {templateById(state.plan, u.templateId)?.name}</b><div className="small muted">How did it go? Not reported yet.</div></div><StatusBadge status="unreported" /></div>
            <div className="chips">
              <button className="chip" onClick={() => checkIn(u, 'completed')}>Done</button>
              <button className="chip" onClick={() => checkIn(u, 'partial')}>Partly</button>
              <button className="chip" onClick={() => checkIn(u, 'different')}>Did something else</button>
              <button className="chip" onClick={() => checkIn(u, 'missed')}>Missed it</button>
            </div>
          </div>
        ))}

        {/* Today's workout */}
        <div className="card hero">
          <div className="card-head">
            <div className="label">Today's workout</div>
            {entry && <StatusBadge status={active ? 'in_progress' : displayStatus(entry, today)} />}
          </div>
          {tmpl ? (
            <>
              <div><h2>{tmpl.name}</h2><div className="small muted">{musclesLabel(templateMuscles(tmpl))}</div></div>
              <div className="col" style={{ gap: 6 }}>
                {tmpl.exercises.map((pe) => {
                  const s = suggestLoad(state, pe, p);
                  return <div key={pe.uid} className="ex-line"><span className="n ellipsis">{getExercise(pe.exerciseId).name}</span><span className="p">{pe.sets}×{pe.repsMin}–{pe.repsMax} · {fmtWeight(s.weightKg, p.units)}</span></div>;
                })}
              </div>
              {entry!.status === 'completed' || entry!.status === 'partial' ? (
                <button className="btn block" onClick={() => go('workout', { tab: 'history' })}>View in history</button>
              ) : entry!.status === 'planned' || entry!.status === 'in_progress' ? (
                <button className="btn primary lg block" onClick={() => startWorkout(entry!.id)}>{active ? 'Resume workout' : 'Start workout'}<Icon name="play" size={18} /></button>
              ) : <p className="small muted">{entry!.note ?? ''}</p>}
            </>
          ) : (
            <>
              <h2>Rest day</h2>
              <p className="small muted">Recovery is when muscle actually grows. A walk or light stretching is a great idea.</p>
              {(() => { for (let i = 1; i < 7; i++) { const e = entryOn(state, addDays(today, i)); const t = templateById(state.plan, e?.templateId); if (t && e?.status === 'planned') return <p className="small">Next: <b>{t.name}</b> {fmtDate(e.date, today).toLowerCase()}</p>; } return null; })()}
              {active && <button className="btn primary block" onClick={() => go('workout')}>Resume workout</button>}
            </>
          )}
        </div>

        {/* Check-in */}
        {entry && tmpl && ['planned', 'in_progress'].includes(entry.status) && !active && (
          <div className="card tight">
            <div className="label">Quick check-in</div>
            <div className="chips">
              <button className="chip" onClick={() => checkIn(entry, 'completed')}>✓ I completed it</button>
              <button className="chip" onClick={() => checkIn(entry, 'partial')}>◐ Partially</button>
              <button className="chip" onClick={() => checkIn(entry, 'skipped')}>Skipped</button>
              <button className="chip" onClick={() => checkIn(entry, 'rest')}>Rest day</button>
              <button className="chip" onClick={() => checkIn(entry, 'different')}>Did a different workout</button>
            </div>
          </div>
        )}
        {entry && !tmpl && !active && (
          <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setSheet({ kind: 'different', id: null, date: today })}>Trained anyway? Log it</button>
        )}

        {/* Nutrition */}
        <div className="card" onClick={() => go('nutrition')} style={{ cursor: 'pointer' }}>
          <div className="card-head"><div className="label">Nutrition today</div><Icon name="chevron" size={18} /></div>
          <div className="row" style={{ gap: 16 }}>
            <Ring value={tot.kcal} max={p.targets.calories}>
              <div><div style={{ fontWeight: 800, fontSize: 18 }}>{Math.max(0, p.targets.calories - tot.kcal)}</div><div className="tiny muted">{tot.kcal > p.targets.calories ? 'over' : 'kcal left'}</div></div>
            </Ring>
            <Ring value={tot.protein} max={p.targets.protein} color="var(--protein)">
              <div><div style={{ fontWeight: 800, fontSize: 18 }}>{Math.max(0, Math.round(p.targets.protein - tot.protein))}g</div><div className="tiny muted">protein left</div></div>
            </Ring>
            <div className="col grow" style={{ gap: 8 }}>
              <div className="small"><b>{tot.kcal}</b><span className="muted"> / {p.targets.calories} kcal</span></div>
              <div className="small"><b>{Math.round(tot.protein)}</b><span className="muted"> / {p.targets.protein} g protein</span></div>
              <MacroBar label="Carbs" value={tot.carbs} target={p.targets.carbs} color="var(--carbs)" />
              <MacroBar label="Fat" value={tot.fat} target={p.targets.fat} color="var(--fat)" />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="card">
          <div className="label">This week</div>
          <div className="week">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const d = addDays(weekStart(today), i);
              const e = entryOn(state, d);
              const st = e ? displayStatus(e, today) : 'rest';
              return (
                <div key={d} className={`day ${d === today ? 'today' : ''}`} onClick={() => go('workout', { tab: 'plan' })}>
                  <span className="d">{DAY_SHORT[(i + 1) % 7]}</span>
                  <span className={`pip ${st === 'planned' && d < today ? 'unreported' : st}`} />
                  <span className="tiny dim ellipsis" style={{ maxWidth: '100%' }}>{templateById(state.plan, e?.templateId)?.name.split(' ')[0] ?? ''}</span>
                </div>
              );
            })}
          </div>
          <div className="grid2">
            <div className="stat"><div className="v">{wk.completed + wk.partial}<span className="muted small"> / {wk.planned}</span></div><div className="k">workouts done so far{wk.pct ? ` · ${wk.pct}%` : ''}</div></div>
            <div className="stat">
              <div className="v">{wt.current != null ? toDisplayWeight(wt.current, p.units) : '—'}<span className="muted small"> {weightUnit(p.units)}</span></div>
              <div className="k">{wt.delta != null ? `${wt.delta >= 0 ? '+' : '−'}${toDisplayWeight(Math.abs(wt.delta), p.units)} vs last week avg` : 'current weight'}</div>
            </div>
          </div>
          <div className="row">
            <input className="input" inputMode="decimal" placeholder={`Log today's weight (${weightUnit(p.units)})`} value={weightIn} onChange={(e) => setWeightIn(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && logWeight()} />
            <button className="btn" disabled={!weightIn} onClick={logWeight}>Log</button>
          </div>
        </div>

        {/* Coach */}
        <div className="card">
          <div className="card-head"><div className="label">Coach</div><button className="btn sm ghost" onClick={() => go('coach')}>Ask <Icon name="chevron" size={16} /></button></div>
          {insights.length ? insights.slice(0, 2).map((i) => (
            <div key={i.id} className={`insight ${i.tone}`}>
              <span className="dot" />
              <div className="col grow">
                <p className="small">{i.text}</p>
                {i.card && (
                  <div className="row">
                    <button className="btn sm primary" onClick={() => { commit(i.card!.actions, 'Done'); setState((s) => ({ ...s, dismissedInsights: [...s.dismissedInsights, i.id] })); }}>{i.card.title.length < 40 ? i.card.title.replace(/\?$/, '') : 'Apply'}</button>
                    <button className="btn sm ghost" onClick={() => setState((s) => ({ ...s, dismissedInsights: [...s.dismissedInsights, i.id] }))}>Not now</button>
                  </div>
                )}
              </div>
            </div>
          )) : (
            <p className="small muted">{tot.protein < p.targets.protein * 0.5 && hour >= 15
              ? `You've had ${Math.round(tot.protein)} g of your ${p.targets.protein} g protein so far — a protein-focused dinner will help.`
              : tmpl && entry?.status === 'planned' ? `Today is ${tmpl.name}. Suggested weights are pre-filled${state.sessions.some((x) => x.source === 'tracked') ? ' from your history' : ' conservatively for your first sessions'} — adjust freely if they feel off.` : 'Keep logging workouts and meals — recommendations get sharper as FitPilot learns your patterns.'}</p>
          )}
        </div>
      </div>

      {sheet?.kind === 'partial' && sheet.id && <PartialSheet scheduledId={sheet.id} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'reschedule' && sheet.id && <RescheduleSheet scheduledId={sheet.id} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'different' && (
        <DifferentWorkoutSheet scheduledId={sheet.id} date={sheet.date ?? today} onClose={() => setSheet(null)}
          onDone={() => setSheet(sheet.id ? { kind: 'reschedule', id: sheet.id } : null)} />
      )}
    </>
  );
}

