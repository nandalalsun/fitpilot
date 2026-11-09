import { useState } from 'react';
import { applyProposal } from '../lib/actions';
import { lastUsed } from '../lib/analytics';
import { alternativesFor, getExercise, MUSCLE_GROUPS, MUSCLE_LABEL } from '../lib/exercises';
import { recommendReschedule } from '../lib/scheduler';
import { getState, replaceState, setState, useStore } from '../lib/store';
import { templateById } from '../lib/training';
import type { Muscle, Proposal } from '../lib/types';
import { fmtDate, titleCase, todayISO } from '../lib/util';
import { Icon, Sheet, toast } from './kit';

/** Apply a user-initiated change with an undo toast. */
export function commit(p: Proposal | Proposal[], msg: string) {
  const prev = getState();
  setState((s) => (Array.isArray(p) ? p : [p]).reduce((x, a) => applyProposal(x, a), s));
  toast(msg, () => replaceState(prev));
}

export function ExerciseDetail({ id, onClose, onPick }: { id: string; onClose: () => void; onPick?: (id: string) => void }) {
  const profile = useStore((s) => s.profile)!;
  const state = useStore((s) => s);
  const [cur, setCur] = useState(id);
  const e = getExercise(cur);
  const alts = alternativesFor(cur, profile.equipment, profile.limitations);
  const lu = lastUsed(state, cur);
  return (
    <Sheet title={e.name} onClose={onClose}>
      <div className="chips">
        {e.primary.map((m) => <span key={m} className="badge completed">{MUSCLE_LABEL[m]}</span>)}
        {e.secondary.map((m) => <span key={m} className="badge">{MUSCLE_LABEL[m]}</span>)}
      </div>
      <p>{e.description}</p>
      <div className="card tight">
        <div className="label">How to do it</div>
        <ol className="steps-list">{e.steps.map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
      <div className="card tight">
        <div className="label">Common mistakes</div>
        <ul className="plain">{e.mistakes.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
      <div className="row wrap small"><span className="muted">Equipment:</span>{e.equipment.map((q) => <span key={q} className="badge">{titleCase(q)}</span>)}</div>
      {lu && <p className="small"><span className="muted">Last time ({fmtDate(lu.date)}):</span> {lu.text}</p>}
      <a className="small" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(e.name + ' proper form')}`} target="_blank" rel="noreferrer">Watch a demonstration video ↗</a>
      {alts.length > 0 && (
        <div className="col">
          <div className="label">Alternatives</div>
          {alts.map((a) => (
            <div key={a.id} className="list-item">
              <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setCur(a.id)}>
                <div>{a.name}</div><div className="tiny muted">{a.equipment.map(titleCase).join(', ')}</div>
              </button>
              {onPick && <button className="btn sm" onClick={() => onPick(a.id)}>Use</button>}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export function SwapSheet({ exerciseId, onClose, onPick, title = 'Swap exercise' }: { exerciseId: string; onClose: () => void; onPick: (id: string) => void; title?: string }) {
  const profile = useStore((s) => s.profile)!;
  const [busy, setBusy] = useState(false);
  const e = getExercise(exerciseId);
  const alts = alternativesFor(exerciseId, profile.equipment, profile.limitations, busy && e.equipment.includes('machine') ? 'machine' : busy && e.equipment.includes('cable') ? 'cable' : undefined);
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted small">Replacing <b>{e.name}</b>. These train the same muscles ({e.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}).</p>
      {(e.equipment.includes('machine') || e.equipment.includes('cable')) && (
        <button className={`chip ${busy ? 'on' : ''}`} onClick={() => setBusy(!busy)}>Machine/cable unavailable — show free-weight options</button>
      )}
      <div className="list">
        {alts.map((a) => (
          <button key={a.id} className="list-item tap" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => onPick(a.id)}>
            <div className="grow"><div>{a.name}</div><div className="tiny muted">{a.equipment.map(titleCase).join(', ')} · {a.primary.map((m) => MUSCLE_LABEL[m]).join(', ')}</div></div>
            <Icon name="chevron" size={18} />
          </button>
        ))}
        {!alts.length && <div className="empty">No alternatives with your equipment. Update equipment in Settings.</div>}
      </div>
    </Sheet>
  );
}

/** After a workout is missed/skipped: show the recommended adjustment and alternatives. */
export function RescheduleSheet({ scheduledId, onClose }: { scheduledId: string; onClose: () => void }) {
  const state = useStore((s) => s);
  const adv = recommendReschedule(state, scheduledId, todayISO());
  if (!adv) return null;
  const opts = [adv.recommended, ...adv.alternatives];
  return (
    <Sheet title="Adjust your week?" onClose={onClose}>
      <p className="muted small">{adv.workoutName} on {fmtDate(adv.missed.date)} didn't happen. Here's what FitPilot recommends based on your recent training and recovery:</p>
      {opts.map((o, i) => (
        <div key={o.id} className="card tight" style={i === 0 ? { borderColor: 'var(--accent)' } : undefined}>
          <div className="row between"><b>{o.label}</b>{i === 0 && <span className="badge completed">Recommended</span>}</div>
          <p className="small muted">{o.explanation}</p>
          <button className={`btn sm ${i === 0 ? 'primary' : ''}`} onClick={() => { if (o.proposal) commit(o.proposal, 'Schedule updated'); else toast('Plan kept as is'); onClose(); }}>
            {o.proposal ? 'Apply this change' : 'Keep plan'}
          </button>
        </div>
      ))}
    </Sheet>
  );
}

const GROUP_CHOICES = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core', 'full body'];

export function DifferentWorkoutSheet({ scheduledId, date, onClose, onDone }: { scheduledId: string | null; date: string; onClose: () => void; onDone: () => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const muscles = [...new Set(sel.flatMap((g) => MUSCLE_GROUPS[g]))] as Muscle[];
  return (
    <Sheet title="What did you train?" onClose={onClose}>
      <p className="muted small">FitPilot will count this toward recovery and weekly consistency.</p>
      <div className="chips">{GROUP_CHOICES.map((g) => <button key={g} className={`chip ${sel.includes(g) ? 'on' : ''}`} onClick={() => setSel(sel.includes(g) ? sel.filter((x) => x !== g) : [...sel, g])}>{titleCase(g)}</button>)}</div>
      <button className="btn primary block" disabled={!sel.length} onClick={() => {
        commit({ kind: 'report_different', scheduledId, date, muscles, name: sel.map(titleCase).join(' & ') }, 'Workout recorded');
        onDone();
      }}>Save</button>
    </Sheet>
  );
}

export function PartialSheet({ scheduledId, onClose }: { scheduledId: string; onClose: () => void }) {
  const state = useStore((s) => s);
  const sw = state.schedule.find((s) => s.id === scheduledId)!;
  const t = templateById(state.plan, sw.templateId)!;
  const [done, setDone] = useState<string[]>([]);
  return (
    <Sheet title="Which exercises did you do?" onClose={onClose}>
      <p className="muted small">Tap the ones you completed. The rest are recorded as skipped — nothing is marked missed.</p>
      <div className="list">{t.exercises.map((pe) => {
        const on = done.includes(pe.exerciseId);
        return (
          <button key={pe.uid} className="list-item tap" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => setDone(on ? done.filter((x) => x !== pe.exerciseId) : [...done, pe.exerciseId])}>
            <span className={`done-btn ${on ? 'on' : ''}`} style={{ width: 34, height: 34 }}><Icon name="check" /></span>
            <span className="grow">{getExercise(pe.exerciseId).name}</span>
          </button>
        );
      })}</div>
      <button className="btn primary block" disabled={!done.length || done.length === t.exercises.length} onClick={() => {
        const muscles = [...new Set(done.flatMap((id) => getExercise(id).primary))];
        commit({ kind: 'report_partial', scheduledId, doneExerciseIds: done, muscles }, 'Partial workout recorded');
        onClose();
      }}>{done.length === t.exercises.length ? 'All done? Use "Completed" instead' : 'Save partial workout'}</button>
    </Sheet>
  );
}
