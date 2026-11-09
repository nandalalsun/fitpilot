import { useMemo, useState } from 'react';
import { computeTargets, defaultSplit, generatePlan, SPLIT_LABEL } from '../lib/planner';
import { setState } from '../lib/store';
import { ensureSchedule } from '../lib/training';
import type { Equipment, Experience, Gender, Goal, Profile, SplitType } from '../lib/types';
import { DAY_SHORT, KG_PER_LB, todayISO } from '../lib/util';
import { Seg } from '../ui/kit';
import { cloudSignIn, useCloud } from '../lib/cloud';
import { SYNC_AVAILABLE } from '../lib/firebase-config';

export const GOALS: { v: Goal; l: string; d: string }[] = [
  { v: 'build_muscle', l: 'Build muscle', d: 'Gain size and strength with a small calorie surplus' },
  { v: 'recomp', l: 'Build muscle & lose fat', d: 'Recomposition — slow and steady at maintenance' },
  { v: 'lose_fat', l: 'Lose fat', d: 'Keep muscle while in a moderate deficit' },
  { v: 'strength', l: 'Get stronger', d: 'Lower reps, heavier compound lifts' },
  { v: 'general', l: 'General fitness', d: 'Feel better and stay consistent' },
];
export const EXPERIENCE: { v: Experience; l: string; d: string }[] = [
  { v: 'beginner', l: 'Beginner', d: 'Less than 6 months of regular training' },
  { v: 'intermediate', l: 'Intermediate', d: '6 months – 2 years' },
  { v: 'advanced', l: 'Advanced', d: '2+ years of consistent training' },
];
export const EQUIPMENT: { v: Equipment; l: string }[] = [
  { v: 'machine', l: 'Machines' }, { v: 'cable', l: 'Cables' }, { v: 'barbell', l: 'Barbell & rack' }, { v: 'dumbbell', l: 'Dumbbells' },
  { v: 'bench', l: 'Bench' }, { v: 'pullup_bar', l: 'Pull-up bar' }, { v: 'bands', l: 'Resistance bands' }, { v: 'kettlebell', l: 'Kettlebell' },
];
export const DIETS = ['vegetarian', 'vegan', 'pescatarian', 'halal', 'dairy-free', 'gluten-free'];
const GYM_EQ: Equipment[] = ['machine', 'cable', 'barbell', 'dumbbell', 'bench', 'pullup_bar', 'bodyweight'];
const HOME_EQ: Equipment[] = ['dumbbell', 'bodyweight', 'bands'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const cloud = useCloud();
  const [units, setUnits] = useState<'metric' | 'imperial'>('imperial');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [heightA, setHeightA] = useState(''); // cm or ft
  const [heightB, setHeightB] = useState(''); // in
  const [weight, setWeight] = useState('');
  const [target, setTarget] = useState('');
  const [goal, setGoal] = useState<Goal>('build_muscle');
  const [exp, setExp] = useState<Experience>('beginner');
  const [days, setDays] = useState<number[]>([1, 2, 4, 5]);
  const [time, setTime] = useState<Profile['preferredTime']>('evening');
  const [location, setLocation] = useState<Profile['location']>('gym');
  const [equipment, setEquipment] = useState<Equipment[]>(GYM_EQ);
  const [diet, setDiet] = useState<string[]>([]);
  const [limitations, setLimitations] = useState('');
  const [split, setSplit] = useState<SplitType | null>(null);

  const kg = (v: string) => (units === 'imperial' ? parseFloat(v) * KG_PER_LB : parseFloat(v));
  const heightCm = units === 'imperial' ? ((parseFloat(heightA) || 0) * 12 + (parseFloat(heightB) || 0)) * 2.54 : parseFloat(heightA);
  const wu = units === 'imperial' ? 'lb' : 'kg';
  const valid = [
    !!age && +age >= 13 && +age <= 100 && heightCm > 100 && heightCm < 250 && kg(weight) > 30 && kg(weight) < 300,
    true,
    days.length >= 1,
    location === 'gym' || equipment.length >= 0,
    true,
  ];

  const draft = useMemo((): Profile | null => {
    if (!valid[0]) return null;
    const base = {
      name: name.trim(), age: +age, gender, heightCm: Math.round(heightCm), weightKg: kg(weight), targetWeightKg: target ? kg(target) : kg(weight),
      goal, experience: exp, trainingDays: [...days].sort(), preferredTime: time, location,
      equipment: [...new Set<Equipment>([...equipment, 'bodyweight'])], diet, limitations: limitations.trim(), units,
      split: split ?? defaultSplit(days.length), createdAt: new Date().toISOString(),
    };
    return { ...base, targets: computeTargets(base) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, age, gender, heightCm, weight, target, goal, exp, days, time, location, equipment, diet, limitations, units, split]);

  function finish() {
    if (!draft) return;
    const plan = generatePlan(draft);
    setState((s) => {
      const next = { ...s, profile: draft, plan, schedule: [] };
      return { ...next, schedule: ensureSchedule(next, todayISO()) };
    });
  }

  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

  return (
    <div className="app">
      <div className="page" style={{ paddingTop: 28 }}>
        <div className="row between">
          <div className="row"><img src="./icon.svg" width={34} height={34} alt="" /><h2>FitPilot</h2></div>
          <span className="muted small">Step {step + 1} of 5</span>
        </div>
        <div className="steps">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>

        {step === 0 && (
          <>
            <div><h1>Let's set you up</h1><p className="muted">This helps FitPilot personalise your training and nutrition. Everything stays on this device.</p></div>
            {SYNC_AVAILABLE && (
              <div className="card tight">
                <div className="row between"><span className="small">Used FitPilot before?</span>
                  <button className="btn sm" disabled={cloud.phase === 'connecting'} onClick={() => cloudSignIn()}>{cloud.phase === 'connecting' ? 'Restoring…' : 'Restore from Google'}</button></div>
                {cloud.phase === 'synced' && <p className="tiny muted">Signed in as {cloud.email}. No backup found yet — set up below and it will be backed up automatically.</p>}
                {cloud.error && <p className="tiny" style={{ color: 'var(--amber)' }}>{cloud.error}</p>}
              </div>
            )}
            <Seg value={units} onChange={setUnits} options={[{ v: 'imperial', l: 'lb / ft' }, { v: 'metric', l: 'kg / cm' }]} />
            <label className="field"><span>Name (optional)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="What should I call you?" /></label>
            <div className="grid2">
              <label className="field"><span>Age</span><input className="input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="30" /></label>
              <label className="field"><span>Gender (optional)</span>
                <select className="input" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                  <option value="unspecified">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                </select>
              </label>
            </div>
            {units === 'imperial' ? (
              <div className="grid2">
                <label className="field"><span>Height (ft)</span><input className="input" inputMode="numeric" value={heightA} onChange={(e) => setHeightA(e.target.value)} placeholder="5" /></label>
                <label className="field"><span>(in)</span><input className="input" inputMode="numeric" value={heightB} onChange={(e) => setHeightB(e.target.value)} placeholder="10" /></label>
              </div>
            ) : <label className="field"><span>Height (cm)</span><input className="input" inputMode="numeric" value={heightA} onChange={(e) => setHeightA(e.target.value)} placeholder="178" /></label>}
            <div className="grid2">
              <label className="field"><span>Current weight ({wu})</span><input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={units === 'imperial' ? '175' : '80'} /></label>
              <label className="field"><span>Target weight ({wu})</span><input className="input" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Optional" /></label>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div><h1>Your goal</h1><p className="muted">You can change this any time.</p></div>
            <div className="col">{GOALS.map((g) => <button key={g.v} className={`big-choice ${goal === g.v ? 'on' : ''}`} onClick={() => setGoal(g.v)}><b>{g.l}</b><span>{g.d}</span></button>)}</div>
            <div className="label">Training experience</div>
            <div className="col">{EXPERIENCE.map((g) => <button key={g.v} className={`big-choice ${exp === g.v ? 'on' : ''}`} onClick={() => setExp(g.v)}><b>{g.l}</b><span>{g.d}</span></button>)}</div>
          </>
        )}

        {step === 2 && (
          <>
            <div><h1>Your week</h1><p className="muted">Which days can you usually train? FitPilot adapts when life gets in the way.</p></div>
            <div className="week">{[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} className={`chip ${days.includes(d) ? 'on' : ''}`} style={{ padding: '12px 0' }} onClick={() => { setDays(toggle(days, d)); setSplit(null); }}>{DAY_SHORT[d]}</button>
            ))}</div>
            <p className="small muted">{days.length} day{days.length !== 1 ? 's' : ''} per week</p>
            <div className="label">Preferred time</div>
            <Seg value={time} onChange={setTime} options={[{ v: 'morning', l: 'Morning' }, { v: 'midday', l: 'Midday' }, { v: 'evening', l: 'Evening' }, { v: 'flexible', l: 'Varies' }]} />
            <div className="label">Program style</div>
            <div className="chips">{(['full_body', 'upper_lower', 'ppl', 'body_part'] as SplitType[]).map((s) => (
              <button key={s} className={`chip ${(split ?? defaultSplit(days.length)) === s ? 'on' : ''}`} onClick={() => setSplit(s)}>{SPLIT_LABEL[s]}{s === defaultSplit(days.length) ? ' ★' : ''}</button>
            ))}</div>
            <p className="tiny dim">★ Recommended for {days.length} days a week.</p>
          </>
        )}

        {step === 3 && (
          <>
            <div><h1>Where you train</h1></div>
            <Seg value={location} onChange={(v) => { setLocation(v); setEquipment(v === 'gym' ? GYM_EQ : HOME_EQ); }} options={[{ v: 'gym', l: 'Gym' }, { v: 'home', l: 'Home' }]} />
            <div className="label">Available equipment</div>
            <div className="chips">{EQUIPMENT.map((e) => <button key={e.v} className={`chip ${equipment.includes(e.v) ? 'on' : ''}`} onClick={() => setEquipment(toggle(equipment, e.v))}>{e.l}</button>)}</div>
            <p className="tiny dim">Bodyweight exercises are always available.</p>
            <label className="field"><span>Injuries or limitations (optional)</span>
              <textarea className="input" value={limitations} onChange={(e) => setLimitations(e.target.value)} placeholder="e.g. sore left knee, lower back issues, shoulder impingement" />
            </label>
            <p className="tiny dim">FitPilot avoids exercises that commonly aggravate the areas you mention (knee, back, shoulder). This isn't medical advice — check with a professional for injuries.</p>
          </>
        )}

        {step === 4 && draft && (
          <>
            <div><h1>Food preferences</h1></div>
            <div className="chips">{DIETS.map((d) => <button key={d} className={`chip ${diet.includes(d) ? 'on' : ''}`} onClick={() => setDiet(toggle(diet, d))}>{d}</button>)}</div>
            <div className="card">
              <div className="label">Your starting daily targets</div>
              <div className="grid4">
                <div className="stat"><div className="v">{draft.targets.calories}</div><div className="k">kcal</div></div>
                <div className="stat"><div className="v" style={{ color: 'var(--protein)' }}>{draft.targets.protein}</div><div className="k">protein g</div></div>
                <div className="stat"><div className="v" style={{ color: 'var(--carbs)' }}>{draft.targets.carbs}</div><div className="k">carbs g</div></div>
                <div className="stat"><div className="v" style={{ color: 'var(--fat)' }}>{draft.targets.fat}</div><div className="k">fat g</div></div>
              </div>
              <p className="small muted">Estimated from your body stats, activity and goal. Treat it as a starting point — you can edit targets in Settings, and FitPilot will flag if your weight trend suggests adjusting.</p>
            </div>
          </>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 4
            ? <button className="btn primary grow" disabled={!valid[step]} onClick={() => setStep(step + 1)}>Continue</button>
            : <button className="btn primary grow" disabled={!draft} onClick={finish}>Create my plan</button>}
        </div>
        {step === 0 && !valid[0] && (age || weight || heightA) && <p className="tiny dim">Enter age, height and weight to continue.</p>}
      </div>
    </div>
  );
}
