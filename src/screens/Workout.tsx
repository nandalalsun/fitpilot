import { useEffect, useMemo, useState } from 'react';
import { EXERCISES, getExercise, MUSCLE_LABEL } from '../lib/exercises';
import { generatePlan, setScheme, SPLIT_LABEL, startingWeight } from '../lib/planner';
import { getState, replaceState, setState, useStore } from '../lib/store';
import {
  createSession, displayStatus, entryOn, exerciseStatus, finalizeSession, newExerciseLog, personalRecords, rebuildFutureSchedule,
  sessionDurationMin, sessionOutcome, sessionVolume, STATUS_LABEL, suggestLoad, templateById, templateMuscles, musclesLabel,
} from '../lib/training';
import type { AppState, ExerciseLog, Muscle, PlannedExercise, Session, SplitType, WorkoutStatus } from '../lib/types';
import { addDays, DAY_SHORT, fmtDate, fmtWeight, fromDisplayWeight, todayISO, toDisplayWeight, uid, weightUnit } from '../lib/util';
import { Icon, Seg, Sheet, StatusBadge, Stepper, toast } from '../ui/kit';
import { go, useNav } from '../ui/nav';
import { commit, ExerciseDetail, RescheduleSheet, SwapSheet } from '../ui/parts';

// ── Session helpers ──────────────────────────────────────────────

export function startWorkout(scheduledId: string) {
  const s = getState();
  if (s.activeSessionId) return go('workout');
  const sw = s.schedule.find((x) => x.id === scheduledId);
  const t = templateById(s.plan, sw?.templateId);
  if (!sw || !t || !s.profile) return;
  const session = createSession(s, t, s.profile, sw.id, todayISO());
  setState((st) => ({
    ...st, sessions: [...st.sessions, session], activeSessionId: session.id,
    schedule: st.schedule.map((x) => (x.id === sw.id ? { ...x, status: 'in_progress', sessionId: session.id, date: x.date < todayISO() ? x.date : x.date } : x)),
  }));
  go('workout');
}

const updateSession = (id: string, fn: (s: Session) => Session) =>
  setState((st) => ({ ...st, sessions: st.sessions.map((s) => (s.id === id ? fn(s) : s)) }));
const updateEx = (sid: string, uidx: string, fn: (e: ExerciseLog) => ExerciseLog) =>
  updateSession(sid, (s) => ({ ...s, exercises: s.exercises.map((e) => (e.uid === uidx ? fn(e) : e)) }));

function loadStep(exerciseId: string, units: 'metric' | 'imperial') {
  const inc = getExercise(exerciseId).increment || 2.5;
  return units === 'imperial' ? (inc <= 1.25 ? 2.5 : 5) : inc;
}

// ── Active workout ───────────────────────────────────────────────

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => { const id = setInterval(() => set((n) => n + 1), ms); return () => clearInterval(id); }, [ms]);
}

function fmtClock(sec: number) { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function ActiveWorkout({ session }: { session: Session }) {
  useTick();
  const state = useStore((s) => s);
  const p = state.profile!;
  const units = p.units;
  const [info, setInfo] = useState<string | null>(null);
  const [swap, setSwap] = useState<ExerciseLog | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [adding, setAdding] = useState(false);
  const paused = session.state === 'paused';
  const elapsed = ((paused ? session.pausedAt! : Date.now()) - session.startedAt - session.pausedMs) / 1000;
  const rest = session.restEndsAt ? (session.restEndsAt - Date.now()) / 1000 : 0;
  const doneSets = session.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const totalSets = session.exercises.filter((e) => e.status !== 'skipped').reduce((a, e) => a + e.sets.length, 0);

  useEffect(() => {
    if (session.restEndsAt && rest <= 0 && rest > -1.2) { try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ } }
  }, [Math.ceil(rest)]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSet = (e: ExerciseLog, i: number) => {
    const willBeDone = !e.sets[i].done;
    updateSession(session.id, (s) => ({
      ...s,
      restEndsAt: willBeDone ? Date.now() + e.restSec * 1000 : s.restEndsAt,
      exercises: s.exercises.map((x) => x.uid !== e.uid ? x : { ...x, status: x.status === 'skipped' ? 'pending' : x.status, sets: x.sets.map((st, j) => (j === i ? { ...st, done: willBeDone } : st)) }),
    }));
  };
  const setField = (e: ExerciseLog, i: number, patch: Partial<{ weightKg: number | null; reps: number }>) =>
    updateEx(session.id, e.uid, (x) => ({ ...x, sets: x.sets.map((st, j) => {
      if (j === i) return { ...st, ...patch };
      // Propagate a weight change to the following not-yet-done sets — fewer taps.
      if (j > i && !st.done && patch.weightKg !== undefined) return { ...st, weightKg: patch.weightKg };
      return st;
    }) }));

  const togglePause = () => updateSession(session.id, (s) => s.state === 'paused'
    ? { ...s, state: 'active', pausedMs: s.pausedMs + (Date.now() - (s.pausedAt ?? Date.now())), pausedAt: undefined }
    : { ...s, state: 'paused', pausedAt: Date.now(), restEndsAt: undefined });

  return (
    <>
      <div className="topbar">
        <div className="grow">
          <div className="sub">{paused ? 'Paused' : 'In progress'} · {fmtClock(elapsed)} · {doneSets}/{totalSets} sets</div>
          <h1 className="ellipsis">{session.name}</h1>
        </div>
        <button className="icon-btn" aria-label={paused ? 'Resume' : 'Pause'} onClick={togglePause}><Icon name={paused ? 'play' : 'pause'} /></button>
        <button className="btn primary sm" onClick={() => setFinishing(true)}>Finish</button>
      </div>
      <div className="page">
        <div className="bar"><i style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} /></div>
        {paused && <div className="banner info">Workout paused. Your progress is saved — you can close the app and come back.</div>}
        {session.exercises.map((e) => {
          const ex = getExercise(e.exerciseId);
          const st = exerciseStatus(e);
          const step = loadStep(e.exerciseId, units);
          const pe = templateById(state.plan, state.schedule.find((x) => x.id === session.scheduledId)?.templateId)?.exercises.find((x) => x.exerciseId === (e.replacedFrom ?? e.exerciseId));
          const sug = pe ? suggestLoad({ ...state, sessions: state.sessions.filter((s) => s.id !== session.id) }, { ...pe, exerciseId: e.exerciseId }, p, session.date) : null;
          return (
            <div key={e.uid} className={`card ex-card ${st === 'done' ? 'done' : ''} ${e.status === 'skipped' ? 'skipped' : ''}`}>
              <div className="card-head">
                <button style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} className="grow" onClick={() => setInfo(e.exerciseId)}>
                  <h3>{ex.name} <span className="dim"><Icon name="info" size={14} /></span></h3>
                  <div className="small muted">{e.sets.length} × {e.repsMin}–{e.repsMax} · {fmtWeight(e.plannedWeightKg, units)}{ex.perHand ? ' each' : ''}{e.replacedFrom ? ` · swapped from ${getExercise(e.replacedFrom).name}` : ''}</div>
                </button>
                <button className="icon-btn plain" aria-label="Swap exercise" onClick={() => setSwap(e)}><Icon name="swap" /></button>
                <button className="icon-btn plain" aria-label={e.status === 'skipped' ? 'Unskip exercise' : 'Skip exercise'} onClick={() => updateEx(session.id, e.uid, (x) => ({ ...x, status: x.status === 'skipped' ? 'pending' : 'skipped' }))}><Icon name="skip" /></button>
              </div>
              {sug?.basis === 'history' && e.status !== 'skipped' && <p className="tiny muted">{sug.reason}</p>}
              {e.status === 'skipped' ? <p className="small muted">Skipped — tap ⏭ again to undo.</p> : (
                <div className="col">
                  <div className="set-row tiny dim"><span className="idx">Set</span><span style={{ textAlign: 'center' }}>{ex.startRatio === 0 && e.plannedWeightKg == null ? 'Added load' : `Weight (${weightUnit(units)})`}</span><span style={{ textAlign: 'center' }}>{ex.pattern === 'core' && ex.id === 'plank' ? 'Seconds' : 'Reps'}</span><span /></div>
                  {e.sets.map((s, i) => (
                    <div key={i} className={`set-row ${s.done ? 'done' : ''}`}>
                      <span className="idx">{i + 1}</span>
                      <Stepper label={`Set ${i + 1} weight`} value={s.weightKg == null ? 0 : toDisplayWeight(s.weightKg, units)} step={step}
                        onChange={(v) => setField(e, i, { weightKg: v === 0 && ex.startRatio === 0 ? null : fromDisplayWeight(v, units) })} />
                      <Stepper label={`Set ${i + 1} reps`} value={s.reps} step={1} onChange={(v) => setField(e, i, { reps: Math.round(v) })} />
                      <button className={`done-btn ${s.done ? 'on' : ''}`} aria-label={`Complete set ${i + 1}`} aria-pressed={s.done} onClick={() => toggleSet(e, i)}><Icon name="check" /></button>
                    </div>
                  ))}
                  <div className="row">
                    <button className="btn sm ghost" onClick={() => updateEx(session.id, e.uid, (x) => ({ ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1] ?? { weightKg: x.plannedWeightKg, reps: x.repsMax }, done: false }] }))}><Icon name="plus" size={16} /> Set</button>
                    {e.sets.length > 1 && <button className="btn sm ghost" onClick={() => updateEx(session.id, e.uid, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}><Icon name="minus" size={16} /> Set</button>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button className="btn ghost" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Add exercise</button>
        {rest > 0 && !paused && (
          <div className="rest-timer" role="timer">
            <div><div className="tiny muted">Rest</div><div className="t">{fmtClock(rest)}</div></div>
            <div className="row">
              <button className="btn sm" onClick={() => updateSession(session.id, (s) => ({ ...s, restEndsAt: (s.restEndsAt ?? Date.now()) + 30000 }))}>+30s</button>
              <button className="btn sm" onClick={() => updateSession(session.id, (s) => ({ ...s, restEndsAt: undefined }))}>Skip</button>
            </div>
          </div>
        )}
      </div>
      {info && <ExerciseDetail id={info} onClose={() => setInfo(null)} />}
      {swap && <SwapSheet exerciseId={swap.exerciseId} onClose={() => setSwap(null)} onPick={(id) => {
        const ex = getExercise(id);
        const pe: PlannedExercise = { uid: swap.uid, exerciseId: id, sets: swap.sets.length, repsMin: swap.repsMin, repsMax: swap.repsMax, restSec: swap.restSec, weightKg: startingWeight(ex, p) };
        const fresh = newExerciseLog({ ...state, sessions: state.sessions.filter((s) => s.id !== session.id) }, pe, p, session.date);
        updateEx(session.id, swap.uid, (x) => ({ ...fresh, uid: x.uid, replacedFrom: x.replacedFrom ?? x.exerciseId, sets: fresh.sets.map((s, i) => x.sets[i]?.done ? x.sets[i] : s) }));
        setSwap(null);
        toast(`Swapped to ${ex.name} for today`);
      }} />}
      {adding && <LibraryPicker onClose={() => setAdding(false)} onPick={(id) => {
        const ex = getExercise(id);
        const pe: PlannedExercise = { uid: uid(), exerciseId: id, ...setScheme(p.goal, p.experience, ex.compound), weightKg: startingWeight(ex, p) };
        updateSession(session.id, (s) => ({ ...s, exercises: [...s.exercises, newExerciseLog({ ...state, sessions: state.sessions.filter((x) => x.id !== session.id) }, pe, p, session.date)] }));
        setAdding(false);
      }} />}
      {finishing && <FinishSheet session={session} onClose={() => setFinishing(false)} />}
    </>
  );
}

function FinishSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const outcome = sessionOutcome(session);
  const pending = session.exercises.filter((e) => exerciseStatus(e) === 'pending' || exerciseStatus(e) === 'partial');
  const finish = (status: WorkoutStatus | 'discard') => {
    const prev = getState();
    setState((st) => {
      if (status === 'discard') {
        return { ...st, activeSessionId: null, sessions: st.sessions.filter((s) => s.id !== session.id),
          schedule: st.schedule.map((x) => (x.id === session.scheduledId ? { ...x, status: 'planned', sessionId: undefined } : x)) };
      }
      const fin = finalizeSession(session);
      return { ...st, activeSessionId: null, sessions: st.sessions.map((s) => (s.id === session.id ? fin : s)),
        schedule: st.schedule.map((x) => (x.id === session.scheduledId ? { ...x, status, sessionId: session.id } : x)) };
    });
    onClose();
    if (status === 'discard') toast('Workout discarded', () => replaceState(prev));
    else go('workout', { tab: 'history', session: session.id, summary: '1' });
  };
  return (
    <Sheet title="Finish workout?" onClose={onClose}>
      {outcome === null ? (
        <>
          <p className="muted">No sets have been completed yet.</p>
          <button className="btn block" onClick={onClose}>Keep going</button>
          <button className="btn block" onClick={() => finish('skipped')}>Mark today's workout as skipped</button>
          <button className="btn danger block" onClick={() => finish('discard')}>Discard session</button>
        </>
      ) : (
        <>
          {pending.length > 0 && <p className="muted small">{pending.length} exercise{pending.length > 1 ? 's are' : ' is'} unfinished: {pending.map((e) => getExercise(e.exerciseId).name).join(', ')}. {outcome === 'partial' ? 'It will be saved as partially completed — the sets you did still count.' : ''}</p>}
          <button className="btn primary block lg" onClick={() => finish(outcome)}>Save as {STATUS_LABEL[outcome].toLowerCase()}</button>
          <button className="btn block" onClick={onClose}>Keep going</button>
        </>
      )}
    </Sheet>
  );
}

function LibraryPicker({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const list = EXERCISES.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()) || e.primary.some((m) => m.includes(q.toLowerCase())));
  return (
    <Sheet title="Add exercise" onClose={onClose}>
      <input className="input" autoFocus placeholder="Search exercises or muscles" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="list">{list.map((e) => (
        <button key={e.id} className="list-item tap" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => onPick(e.id)}>
          <div className="grow"><div>{e.name}</div><div className="tiny muted">{e.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</div></div><Icon name="plus" size={18} />
        </button>
      ))}</div>
    </Sheet>
  );
}

// ── Today (not started) ──────────────────────────────────────────

function TodayTab() {
  const state = useStore((s) => s);
  const p = state.profile!;
  const today = todayISO();
  const e = entryOn(state, today);
  const t = templateById(state.plan, e?.templateId);
  const [info, setInfo] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<PlannedExercise | null>(null);
  if (!t || !e) return (
    <div className="card"><h2>Rest day</h2><p className="muted small">Nothing scheduled today. You can still start any workout from your plan.</p>
      <div className="col">{state.plan?.templates.map((tt) => (
        <button key={tt.id} className="btn" onClick={() => {
          const id = uid();
          setState((s) => ({ ...s, schedule: [...s.schedule.filter((x) => !(x.date === today && x.status === 'rest')), { id, date: today, templateId: tt.id, status: 'planned', note: 'Extra session' }] }));
          startWorkout(id);
        }}>Start {tt.name}</button>
      ))}</div>
    </div>
  );
  const st = displayStatus(e, today);
  return (
    <>
      <div className="card hero">
        <div className="card-head"><div><h2>{t.name}</h2><div className="small muted">{musclesLabel(templateMuscles(t))}</div></div><StatusBadge status={st} /></div>
        {t.exercises.map((pe) => {
          const s = suggestLoad(state, pe, p);
          const ex = getExercise(pe.exerciseId);
          return (
            <div key={pe.uid} className="list-item">
              <button className="grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setInfo(pe.exerciseId)}>
                <div>{ex.name}</div>
                <div className="tiny muted">{pe.sets} sets × {pe.repsMin}–{pe.repsMax} reps · {fmtWeight(s.weightKg, p.units)}{ex.perHand && s.weightKg ? ' each' : ''} · rest {Math.round(pe.restSec / 15) * 15}s</div>
                <div className="tiny dim">{ex.equipment.join(', ')}</div>
              </button>
              <button className="icon-btn plain" aria-label={`Alternatives for ${ex.name}`} onClick={() => setSwapFor(pe)}><Icon name="swap" /></button>
            </div>
          );
        })}
        {(e.status === 'planned' || e.status === 'in_progress') && <button className="btn primary lg block" onClick={() => startWorkout(e.id)}>Start workout <Icon name="play" size={18} /></button>}
      </div>
      <p className="tiny dim">Suggested weights come from your last performance of each exercise. For new exercises they're deliberately conservative — adjust them during the workout.</p>
      {info && <ExerciseDetail id={info} onClose={() => setInfo(null)} />}
      {swapFor && <SwapSheet title="Replace in plan" exerciseId={swapFor.exerciseId} onClose={() => setSwapFor(null)} onPick={(id) => {
        commit({ kind: 'replace_exercise', templateId: t.id, uid: swapFor.uid, exerciseId: id }, `Plan updated: ${getExercise(id).name}`);
        setSwapFor(null);
      }} />}
    </>
  );
}

// ── Plan ─────────────────────────────────────────────────────────

function PlanTab() {
  const state = useStore((s) => s);
  const p = state.profile!;
  const plan = state.plan!;
  const today = todayISO();
  const [editing, setEditing] = useState<{ tid: string; pe: PlannedExercise } | null>(null);
  const [swap, setSwap] = useState<{ tid: string; pe: PlannedExercise } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [regen, setRegen] = useState<{ split: SplitType; days: number[] } | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const upcoming = state.schedule.filter((s) => s.date >= today && s.date <= addDays(today, 13));

  const editTemplate = (tid: string, fn: (pes: PlannedExercise[]) => PlannedExercise[]) =>
    setState((s) => ({ ...s, plan: s.plan && { ...s.plan, templates: s.plan.templates.map((t) => (t.id === tid ? { ...t, exercises: fn(t.exercises) } : t)) } }));

  return (
    <>
      <div className="card">
        <div className="card-head"><div><div className="label">Program</div><h3>{SPLIT_LABEL[plan.split]} · {Object.keys(plan.week).length} days/week</h3></div>
          <button className="btn sm" onClick={() => setRegen({ split: plan.split, days: Object.keys(plan.week).map(Number) })}>Change</button></div>
        <div className="week">{[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const t = templateById(plan, plan.week[d]);
          return <div key={d} className="day" style={{ cursor: 'default' }}><span className="d">{DAY_SHORT[d]}</span><span className="tiny ellipsis" style={{ maxWidth: '100%' }}>{t ? t.name.replace(' & ', '/') : '—'}</span></div>;
        })}</div>
      </div>

      <div className="card">
        <div className="label">Next two weeks</div>
        <div className="list">{upcoming.map((s) => {
          const t = templateById(plan, s.templateId);
          if (!t && s.status === 'rest' && !s.note) return null;
          return (
            <button key={s.id} className="list-item tap" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => t && setDay(s.id)}>
              <div style={{ width: 84 }} className="small muted">{fmtDate(s.date, today)}</div>
              <div className="grow"><div>{t?.name ?? 'Rest'}</div>{s.movedFrom && <div className="tiny dim">Moved from {fmtDate(s.movedFrom, today)}</div>}</div>
              <StatusBadge status={displayStatus(s, today)} />
            </button>
          );
        })}</div>
      </div>

      {plan.templates.map((t) => (
        <div key={t.id} className="card">
          <div className="card-head"><div><h3>{t.name}</h3><div className="tiny muted">{musclesLabel(templateMuscles(t))}</div></div>
            <span className="tiny muted">{Object.entries(plan.week).filter(([, id]) => id === t.id).map(([d]) => DAY_SHORT[+d]).join(', ')}</span></div>
          {t.exercises.map((pe) => (
            <div key={pe.uid} className="list-item">
              <button className="grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setEditing({ tid: t.id, pe })}>
                <div>{getExercise(pe.exerciseId).name}</div>
                <div className="tiny muted">{pe.sets} × {pe.repsMin}–{pe.repsMax} · {fmtWeight(pe.weightKg, p.units)} · {pe.restSec}s rest</div>
              </button>
              <button className="icon-btn plain" aria-label="Info" onClick={() => setInfo(pe.exerciseId)}><Icon name="info" /></button>
              <button className="icon-btn plain" aria-label="Swap" onClick={() => setSwap({ tid: t.id, pe })}><Icon name="swap" /></button>
            </div>
          ))}
          <button className="btn sm ghost" onClick={() => setAdding(t.id)}><Icon name="plus" size={16} /> Add exercise</button>
        </div>
      ))}

      {editing && <PlannedEditor tid={editing.tid} pe={editing.pe} onClose={() => setEditing(null)}
        onSave={(pe) => { editTemplate(editing.tid, (xs) => xs.map((x) => (x.uid === pe.uid ? pe : x))); setEditing(null); toast('Exercise updated'); }}
        onRemove={() => { const prev = getState(); editTemplate(editing.tid, (xs) => xs.filter((x) => x.uid !== editing.pe.uid)); setEditing(null); toast('Removed from plan', () => replaceState(prev)); }} />}
      {swap && <SwapSheet title="Replace in plan" exerciseId={swap.pe.exerciseId} onClose={() => setSwap(null)} onPick={(id) => {
        commit({ kind: 'replace_exercise', templateId: swap.tid, uid: swap.pe.uid, exerciseId: id }, `Replaced with ${getExercise(id).name}`);
        editTemplate(swap.tid, (xs) => xs.map((x) => (x.uid === swap.pe.uid ? { ...x, weightKg: startingWeight(getExercise(id), p) } : x)));
        setSwap(null);
      }} />}
      {adding && <LibraryPicker onClose={() => setAdding(null)} onPick={(id) => {
        const ex = getExercise(id);
        editTemplate(adding, (xs) => [...xs, { uid: uid(), exerciseId: id, weightKg: startingWeight(ex, p), ...setScheme(p.goal, p.experience, ex.compound) }]);
        setAdding(null); toast(`${ex.name} added`);
      }} />}
      {day && <DaySheet id={day} onClose={() => setDay(null)} />}
      {info && <ExerciseDetail id={info} onClose={() => setInfo(null)} />}
      {regen && (
        <Sheet title="Change program" onClose={() => setRegen(null)}>
          <div className="label">Training days</div>
          <div className="week">{[1, 2, 3, 4, 5, 6, 0].map((d) => <button key={d} className={`chip ${regen.days.includes(d) ? 'on' : ''}`} style={{ padding: '10px 0' }} onClick={() => setRegen({ ...regen, days: regen.days.includes(d) ? regen.days.filter((x) => x !== d) : [...regen.days, d] })}>{DAY_SHORT[d]}</button>)}</div>
          <div className="label">Style</div>
          <div className="chips">{(Object.keys(SPLIT_LABEL) as SplitType[]).map((s) => <button key={s} className={`chip ${regen.split === s ? 'on' : ''}`} onClick={() => setRegen({ ...regen, split: s })}>{SPLIT_LABEL[s]}</button>)}</div>
          <div className="banner info">This creates a fresh plan for future workouts. Your workout history is never changed. Exercise weights restart from conservative suggestions but are re-calculated from your history when you train.</div>
          <button className="btn primary block" disabled={!regen.days.length} onClick={() => {
            setState((s) => {
              const profile = { ...s.profile!, trainingDays: regen.days, split: regen.split };
              const np = generatePlan(profile, regen.split);
              return { ...s, profile, plan: np, schedule: rebuildFutureSchedule(s, np, today) };
            });
            setRegen(null); toast('New plan created');
          }}>Create new plan</button>
        </Sheet>
      )}
    </>
  );
}

function PlannedEditor({ pe, onClose, onSave, onRemove }: { tid: string; pe: PlannedExercise; onClose: () => void; onSave: (pe: PlannedExercise) => void; onRemove: () => void }) {
  const units = useStore((s) => s.profile!.units);
  const [x, setX] = useState(pe);
  const ex = getExercise(pe.exerciseId);
  return (
    <Sheet title={ex.name} onClose={onClose}>
      <div className="grid2">
        <label className="field"><span>Sets</span><Stepper label="sets" value={x.sets} step={1} min={1} onChange={(v) => setX({ ...x, sets: Math.max(1, Math.round(v)) })} /></label>
        <label className="field"><span>Rest (sec)</span><Stepper label="rest" value={x.restSec} step={15} min={15} onChange={(v) => setX({ ...x, restSec: v })} /></label>
        <label className="field"><span>Reps (min)</span><Stepper label="min reps" value={x.repsMin} step={1} min={1} onChange={(v) => setX({ ...x, repsMin: Math.round(v), repsMax: Math.max(x.repsMax, Math.round(v)) })} /></label>
        <label className="field"><span>Reps (max)</span><Stepper label="max reps" value={x.repsMax} step={1} min={1} onChange={(v) => setX({ ...x, repsMax: Math.max(x.repsMin, Math.round(v)) })} /></label>
      </div>
      <label className="field"><span>Starting weight ({weightUnit(units)}){ex.startRatio === 0 ? ' — 0 = bodyweight' : ''}</span>
        <Stepper label="weight" value={x.weightKg == null ? 0 : toDisplayWeight(x.weightKg, units)} step={loadStep(ex.id, units)} onChange={(v) => setX({ ...x, weightKg: v === 0 ? null : fromDisplayWeight(v, units) })} />
      </label>
      <p className="tiny dim">Once you've trained this exercise, workouts pre-fill from your actual performance instead.</p>
      <button className="btn primary block" onClick={() => onSave(x)}>Save</button>
      <button className="btn danger block" onClick={onRemove}>Remove from plan</button>
    </Sheet>
  );
}

function DaySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore((s) => s);
  const today = todayISO();
  const s = state.schedule.find((x) => x.id === id);
  const [moving, setMoving] = useState(false);
  const [resched, setResched] = useState(false);
  if (!s) return null;
  const t = templateById(state.plan, s.templateId)!;
  if (resched) return <RescheduleSheet scheduledId={id} onClose={onClose} />;
  const free = Array.from({ length: 10 }, (_, i) => addDays(today, i)).filter((d) => d !== s.date && !state.schedule.some((x) => x.date === d && x.templateId && ['planned', 'in_progress', 'completed', 'partial'].includes(x.status)));
  return (
    <Sheet title={`${t.name} · ${fmtDate(s.date, today)}`} onClose={onClose}>
      <div className="col">{t.exercises.map((pe) => <div key={pe.uid} className="ex-line"><span>{getExercise(pe.exerciseId).name}</span><span className="p">{pe.sets}×{pe.repsMin}–{pe.repsMax}</span></div>)}</div>
      {s.status === 'planned' && (
        moving ? (
          <>
            <div className="label">Move to</div>
            <div className="chips">{free.map((d) => <button key={d} className="chip" onClick={() => { commit({ kind: 'reschedule', moves: [{ scheduledId: s.id, templateId: t.id, toDate: d, fromDate: s.date }] }, `Moved to ${fmtDate(d, today)}`); onClose(); }}>{fmtDate(d, today)}</button>)}</div>
          </>
        ) : (
          <div className="col">
            {s.date === today && <button className="btn primary block" onClick={() => { onClose(); startWorkout(s.id); }}>Start now</button>}
            <button className="btn block" onClick={() => setMoving(true)}><Icon name="calendar" size={18} /> Move to another day</button>
            <button className="btn block" onClick={() => { commit({ kind: 'set_status', scheduledId: s.id, status: 'skipped', note: 'Skipped in advance' }, 'Marked skipped'); setResched(true); }}>I'll skip this one</button>
          </div>
        )
      )}
    </Sheet>
  );
}

// ── History ──────────────────────────────────────────────────────

const STATUSES_EDITABLE: WorkoutStatus[] = ['completed', 'partial', 'missed', 'skipped', 'rest'];

function HistoryTab({ openId, summary }: { openId?: string; summary?: boolean }) {
  const state = useStore((s) => s);
  const today = todayISO();
  const [open, setOpen] = useState<{ sessionId?: string; scheduledId?: string; summary?: boolean } | null>(openId ? { sessionId: openId, summary } : null);
  const items = useMemo(() => {
    const sched = state.schedule.filter((s) => s.templateId && (s.date < today || !['planned'].includes(s.status)) && s.status !== 'in_progress');
    const extra = state.sessions.filter((s) => s.state === 'finished' && !state.schedule.some((x) => x.sessionId === s.id));
    return [
      ...sched.map((s) => ({ date: s.date, key: s.id, name: templateById(state.plan, s.templateId)?.name ?? '?', status: displayStatus(s, today), scheduledId: s.id, sessionId: s.sessionId })),
      ...extra.map((s) => ({ date: s.date, key: s.id, name: s.name, status: 'completed' as const, scheduledId: undefined, sessionId: s.id })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [state, today]);
  if (!items.length) return <div className="empty">No workout history yet. Your completed, partial and missed sessions will appear here.</div>;
  return (
    <>
      <div className="card"><div className="list">{items.map((i) => {
        const sess = state.sessions.find((s) => s.id === i.sessionId);
        return (
          <button key={i.key} className="list-item tap" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => setOpen({ sessionId: i.sessionId, scheduledId: i.scheduledId })}>
            <div style={{ width: 84 }} className="small muted">{fmtDate(i.date, today)}</div>
            <div className="grow"><div>{i.name}</div>{sess?.state === 'finished' && <div className="tiny dim">{sess.source === 'tracked' ? `${sessionDurationMin(sess)} min · ${sess.exercises.filter((e) => e.status === 'done').length}/${sess.exercises.length} exercises` : 'Reported'}</div>}</div>
            <StatusBadge status={i.status} />
          </button>
        );
      })}</div></div>
      {open && <SessionDetail {...open} onClose={() => setOpen(null)} />}
    </>
  );
}

function SessionDetail({ sessionId, scheduledId, summary, onClose }: { sessionId?: string; scheduledId?: string; summary?: boolean; onClose: () => void }) {
  const state = useStore((s) => s);
  const units = state.profile!.units;
  const sess = state.sessions.find((s) => s.id === sessionId);
  const sw = state.schedule.find((s) => s.id === (scheduledId ?? sess?.scheduledId));
  const t = templateById(state.plan, sw?.templateId);
  const [confirmDel, setConfirmDel] = useState(false);
  const prs = sess && sess.source === 'tracked' ? personalRecords(state, sess, units) : [];
  const title = sess?.name ?? t?.name ?? 'Workout';
  return (
    <Sheet title={summary ? 'Workout saved 🎉' : title} onClose={onClose}>
      {summary && <h3>{title}</h3>}
      <div className="row wrap">{sw && <StatusBadge status={displayStatus(sw)} />}<span className="muted small">{fmtDate(sess?.date ?? sw!.date)}</span>{sw?.movedFrom && <span className="tiny dim">moved from {fmtDate(sw.movedFrom)}</span>}</div>
      {sess?.source === 'tracked' && sess.state === 'finished' && (
        <div className="grid3">
          <div className="stat"><div className="v">{sessionDurationMin(sess)}</div><div className="k">minutes</div></div>
          <div className="stat"><div className="v">{sess.exercises.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0)}</div><div className="k">sets</div></div>
          <div className="stat"><div className="v">{toDisplayWeight(sessionVolume(sess), units).toLocaleString()}</div><div className="k">{weightUnit(units)} volume</div></div>
        </div>
      )}
      {prs.length > 0 && <div className="card tight" style={{ borderColor: 'var(--accent)' }}><div className="label">Personal records</div>{prs.map((x) => <div key={x} className="small">🏆 {x}</div>)}</div>}
      {sw?.note && <p className="small muted">{sw.note}</p>}
      {sess?.reportedMuscles && !sess.exercises.length && <p className="small">Trained: {sess.reportedMuscles.map((m: Muscle) => MUSCLE_LABEL[m]).join(', ')} (reported, no set details)</p>}
      {sess?.exercises.map((e) => {
        const plannedPe = t?.exercises.find((x) => x.exerciseId === (e.replacedFrom ?? e.exerciseId));
        return (
          <div key={e.uid} className="card tight">
            <div className="row between"><b>{getExercise(e.exerciseId).name}</b><span className={`badge ${e.status === 'done' ? 'completed' : e.status}`}>{e.status === 'done' ? 'Done' : e.status === 'partial' ? 'Partial' : e.status === 'skipped' ? 'Skipped' : 'Pending'}</span></div>
            {e.replacedFrom && <div className="tiny dim">Replaced {getExercise(e.replacedFrom).name}</div>}
            <div className="tiny muted">Planned: {plannedPe ? `${plannedPe.sets} × ${plannedPe.repsMin}–${plannedPe.repsMax}` : `${e.sets.length} sets`} @ {fmtWeight(e.plannedWeightKg, units)}</div>
            {e.sets.filter((x) => x.done).length > 0 ? (
              <div className="small">Actual: {e.sets.filter((x) => x.done).map((x, i) => <span key={i}>{i ? ', ' : ''}{fmtWeight(x.weightKg, units)} × {x.reps}</span>)}</div>
            ) : sess.source === 'reported' ? <div className="tiny dim">Reported without set details</div> : null}
          </div>
        );
      })}
      {sw && !summary && (
        <div className="col">
          <div className="label">Correct status</div>
          <div className="chips">{STATUSES_EDITABLE.map((st) => <button key={st} className={`chip ${sw.status === st ? 'on' : ''}`} onClick={() => commit({ kind: 'set_status', scheduledId: sw.id, status: st }, `Status changed to ${STATUS_LABEL[st].toLowerCase()}`)}>{STATUS_LABEL[st]}</button>)}</div>
        </div>
      )}
      {sess && !summary && (confirmDel
        ? <div className="row"><button className="btn grow" onClick={() => setConfirmDel(false)}>Cancel</button><button className="btn danger grow" onClick={() => {
            const prev = getState();
            setState((s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== sess.id), schedule: s.schedule.map((x) => (x.sessionId === sess.id ? { ...x, sessionId: undefined, status: x.date < todayISO() ? 'planned' : x.status === 'in_progress' ? 'planned' : x.status } : x)) }));
            onClose(); toast('Session deleted', () => replaceState(prev));
          }}>Delete session</button></div>
        : <button className="btn danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} /> Delete this record</button>)}
      {summary && <button className="btn primary block" onClick={() => { onClose(); go('home'); }}>Done</button>}
    </Sheet>
  );
}

// ── Library ──────────────────────────────────────────────────────

function LibraryTab() {
  const [q, setQ] = useState('');
  const [m, setM] = useState<string>('all');
  const [info, setInfo] = useState<string | null>(null);
  const muscles = ['all', 'chest', 'back', 'lats', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings', 'glutes', 'calves', 'core'];
  const list = EXERCISES.filter((e) => (m === 'all' || e.primary.includes(m as Muscle)) && (!q || e.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <input className="input" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips scroll">{muscles.map((x) => <button key={x} className={`chip ${m === x ? 'on' : ''}`} onClick={() => setM(x)}>{x === 'all' ? 'All' : MUSCLE_LABEL[x as Muscle]}</button>)}</div>
      <div className="card"><div className="list">{list.map((e) => (
        <button key={e.id} className="list-item tap" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => setInfo(e.id)}>
          <div className="grow"><div>{e.name}</div><div className="tiny muted">{e.primary.map((x) => MUSCLE_LABEL[x]).join(', ')} · {e.equipment.join(', ')}</div></div><Icon name="chevron" size={18} />
        </button>
      ))}</div></div>
      {info && <ExerciseDetail id={info} onClose={() => setInfo(null)} />}
    </>
  );
}

// ── Screen ───────────────────────────────────────────────────────

export default function Workout() {
  const nav = useNav();
  const active = useStore((s: AppState) => s.sessions.find((x) => x.id === s.activeSessionId));
  const [tab, setTab] = useState<'today' | 'plan' | 'history' | 'library'>((nav.params?.tab as 'plan') ?? 'today');
  useEffect(() => { if (nav.params?.tab) setTab(nav.params.tab as 'plan'); }, [nav]);
  if (active && tab === 'today') return <ActiveWorkout session={active} />;
  return (
    <>
      <div className="topbar"><h1>Workout</h1>{active && <button className="btn sm primary" onClick={() => setTab('today')}>Resume</button>}</div>
      <div className="page">
        <Seg value={tab} onChange={setTab} options={[{ v: 'today', l: 'Today' }, { v: 'plan', l: 'Plan' }, { v: 'history', l: 'History' }, { v: 'library', l: 'Exercises' }]} />
        {tab === 'today' && <TodayTab />}
        {tab === 'plan' && <PlanTab />}
        {tab === 'history' && <HistoryTab openId={nav.params?.session} summary={nav.params?.summary === '1'} />}
        {tab === 'library' && <LibraryTab />}
      </div>
    </>
  );
}
