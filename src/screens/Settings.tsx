import { useRef, useState } from 'react';
import { MODEL_OPTIONS } from '../lib/ai-config';
import { computeTargets } from '../lib/planner';
import { deleteAllData, exportData, importData, setState, useStore } from '../lib/store';
import type { Equipment, Experience, Goal, NotificationSettings, Profile } from '../lib/types';
import { fromDisplayWeight, toDisplayWeight, weightUnit } from '../lib/util';
import { Icon, Seg, Sheet, Switch, toast } from '../ui/kit';
import { go } from '../ui/nav';
import { DIETS, EQUIPMENT, EXPERIENCE, GOALS } from './Onboarding';
import { requestNotificationPermission } from '../lib/reminders';

const HOSTED = import.meta.env.VITE_HOSTED === '1';

export default function Settings() {
  const state = useStore((s) => s);
  const p = state.profile!;
  const n = state.notifications;
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [key, setKey] = useState(state.ai.apiKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const u = weightUnit(p.units);

  const setProfile = (patch: Partial<Profile>) => setState((s) => ({ ...s, profile: { ...s.profile!, ...patch } }));
  const setN = (patch: Partial<NotificationSettings>) => setState((s) => ({ ...s, notifications: { ...s.notifications, ...patch } }));
  const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
  const suggested = computeTargets(p);
  const targetsDiffer = Math.abs(suggested.calories - p.targets.calories) > 50 || Math.abs(suggested.protein - p.targets.protein) > 5;

  const [exportText, setExportText] = useState<string | null>(null);
  const download = () => {
    if (HOSTED) { setExportText(exportData()); return; }
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fitpilot-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="topbar"><div className="row"><button className="icon-btn" aria-label="Back" onClick={() => go('home')}><Icon name="back" /></button><h1>Settings</h1></div></div>
      <div className="page">
        <div className="card">
          <div className="label">Profile</div>
          <div className="grid2">
            <label className="field"><span>Name</span><input className="input" value={p.name} onChange={(e) => setProfile({ name: e.target.value })} /></label>
            <label className="field"><span>Age</span><input className="input" inputMode="numeric" value={p.age} onChange={(e) => setProfile({ age: +e.target.value || p.age })} /></label>
            <label className="field"><span>Height (cm)</span><input className="input" inputMode="numeric" value={p.heightCm} onChange={(e) => setProfile({ heightCm: +e.target.value || p.heightCm })} /></label>
            <label className="field"><span>Target weight ({u})</span><input className="input" inputMode="decimal" defaultValue={toDisplayWeight(p.targetWeightKg, p.units)} onBlur={(e) => { const v = parseFloat(e.target.value); if (v) setProfile({ targetWeightKg: fromDisplayWeight(v, p.units) }); }} /></label>
          </div>
          <label className="field"><span>Gender</span>
            <select className="input" value={p.gender} onChange={(e) => setProfile({ gender: e.target.value as Profile['gender'] })}>
              <option value="unspecified">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </label>
          <label className="field"><span>Goal</span><select className="input" value={p.goal} onChange={(e) => setProfile({ goal: e.target.value as Goal })}>{GOALS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}</select></label>
          <label className="field"><span>Experience</span><select className="input" value={p.experience} onChange={(e) => setProfile({ experience: e.target.value as Experience })}>{EXPERIENCE.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}</select></label>
          <div className="field"><span>Units</span><Seg value={p.units} onChange={(units) => setProfile({ units })} options={[{ v: 'imperial', l: 'lb' }, { v: 'metric', l: 'kg' }]} /></div>
          <div className="field"><span>Equipment</span><div className="chips">{EQUIPMENT.map((e) => <button key={e.v} className={`chip ${p.equipment.includes(e.v) ? 'on' : ''}`} onClick={() => setProfile({ equipment: toggle<Equipment>(p.equipment, e.v) })}>{e.l}</button>)}</div></div>
          <div className="field"><span>Diet</span><div className="chips">{DIETS.map((d) => <button key={d} className={`chip ${p.diet.includes(d) ? 'on' : ''}`} onClick={() => setProfile({ diet: toggle(p.diet, d) })}>{d}</button>)}</div></div>
          <label className="field"><span>Injuries / limitations</span><textarea className="input" value={p.limitations} onChange={(e) => setProfile({ limitations: e.target.value })} /></label>
          <p className="tiny dim">Training days and program style are in Workout → Plan → Change. Equipment and injury changes apply to swaps and new plans.</p>
        </div>

        <div className="card">
          <div className="card-head"><div className="label">Daily nutrition targets</div><button className="btn sm" onClick={() => setTargetsOpen(true)}>Edit</button></div>
          <div className="grid4">
            <div className="stat"><div className="v">{p.targets.calories}</div><div className="k">kcal</div></div>
            <div className="stat"><div className="v">{p.targets.protein}</div><div className="k">protein</div></div>
            <div className="stat"><div className="v">{p.targets.carbs}</div><div className="k">carbs</div></div>
            <div className="stat"><div className="v">{p.targets.fat}</div><div className="k">fat</div></div>
          </div>
          {targetsDiffer && (
            <div className="banner info">Based on your current profile, FitPilot would suggest {suggested.calories} kcal and {suggested.protein} g protein.
              <div className="row" style={{ marginTop: 8 }}><button className="btn sm primary" onClick={() => { setProfile({ targets: suggested }); toast('Targets updated'); }}>Use suggested targets</button></div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="label">Reminders</div>
          <Switch on={n.enabled} label="Enable reminders" onChange={async (v) => { if (v) await requestNotificationPermission(); setN({ enabled: v }); }} />
          {n.enabled && (
            <>
              <Switch on={n.workoutReminder} label="Workout day reminder" onChange={(v) => setN({ workoutReminder: v })} />
              <Switch on={n.checkInReminder} label="“Have you completed your workout?” check-in" onChange={(v) => setN({ checkInReminder: v })} />
              <Switch on={n.nutritionReminder} label="Remind me to log meals" onChange={(v) => setN({ nutritionReminder: v })} />
              <Switch on={n.proteinNudge} label="Protein target nudge" onChange={(v) => setN({ proteinNudge: v })} />
              <Switch on={n.restDay} label="Rest-day notes" onChange={(v) => setN({ restDay: v })} />
              <Switch on={n.weeklyReport} label="Weekly report ready (Sundays)" onChange={(v) => setN({ weeklyReport: v })} />
              <div className="field"><span>Frequency</span><Seg value={n.frequency} onChange={(frequency) => setN({ frequency })} options={[{ v: 'minimal', l: 'Minimal (max 2/day)' }, { v: 'normal', l: 'Normal (max 4/day)' }]} /></div>
              <div className="grid2">
                <label className="field"><span>Quiet from</span><input className="input" type="time" value={n.quietStart} onChange={(e) => setN({ quietStart: e.target.value })} /></label>
                <label className="field"><span>Quiet until</span><input className="input" type="time" value={n.quietEnd} onChange={(e) => setN({ quietEnd: e.target.value })} /></label>
              </div>
              <p className="tiny dim">Reminders are delivered while FitPilot is open or installed and running in the background on this device. No guilt trips, ever.</p>
            </>
          )}
        </div>

        {HOSTED ? (
          <div className="card">
            <div className="label">AI coach & photo analysis</div>
            <p className="small muted">This hosted preview runs fully on-device, so meal-photo analysis and open-ended AI answers are switched off. Everything else works. Run FitPilot from its own server to add an Anthropic API key.</p>
          </div>
        ) : <div className="card">
          <div className="label">AI coach & photo analysis</div>
          <p className="small muted">Everything works on-device without AI. Adding an Anthropic API key enables meal-photo analysis and open-ended coach answers. When used, a summary of your relevant data (or the meal photo) is sent to Anthropic's API — nothing else is shared, and the AI can't change your records without your confirmation.</p>
          <label className="field"><span>Anthropic API key</span>
            <input className="input" type="password" autoComplete="off" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} onBlur={() => setState((s) => ({ ...s, ai: { ...s.ai, apiKey: key.trim() } }))} />
          </label>
          <label className="field"><span>Model</span>
            <select className="input" value={state.ai.model} onChange={(e) => setState((s) => ({ ...s, ai: { ...s.ai, model: e.target.value } }))}>{MODEL_OPTIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          </label>
          <p className="tiny dim">The key is stored only in this browser's local storage and is excluded from data exports.</p>
          {state.ai.apiKey && <button className="btn sm danger" onClick={() => { setKey(''); setState((s) => ({ ...s, ai: { ...s.ai, apiKey: '' } })); toast('API key removed'); }}>Remove key</button>}
        </div>}

        <div className="card">
          <div className="label">Your data</div>
          <p className="small muted">All fitness and nutrition data is stored only on this device. FitPilot has no accounts and never shares your information with other users.</p>
          <button className="btn" onClick={download}>Export my data (JSON)</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const err = importData(await f.text()); toast(err ?? 'Data imported'); }} />
          <button className="btn" onClick={() => fileRef.current?.click()}>Import from export…</button>
          <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete all data</button>
        </div>
        <p className="tiny dim" style={{ textAlign: 'center' }}>FitPilot provides general fitness guidance, not medical advice.</p>
      </div>

      {exportText && (
        <Sheet title="Export my data" onClose={() => setExportText(null)}>
          <p className="small muted">Copy this JSON and keep it somewhere safe. You can paste it into a .json file to import it later.</p>
          <textarea id="export-json" className="input" readOnly value={exportText} style={{ minHeight: 220, fontFamily: 'ui-monospace, monospace', fontSize: 12 }} onFocus={(e) => e.target.select()} />
          <button className="btn primary block" onClick={() => { navigator.clipboard.writeText(exportText).then(() => toast('Copied to clipboard'), () => { (document.getElementById('export-json') as HTMLTextAreaElement | null)?.select(); toast('Select all and copy'); }); }}>Copy to clipboard</button>
        </Sheet>
      )}
      {targetsOpen && <TargetsSheet onClose={() => setTargetsOpen(false)} />}
      {confirmDelete && (
        <Sheet title="Delete everything?" onClose={() => setConfirmDelete(false)}>
          <p className="muted">This permanently removes your profile, plan, workout history, meals and measurements from this device. Consider exporting first.</p>
          <button className="btn" onClick={download}>Export first</button>
          <button className="btn danger block" onClick={() => { deleteAllData(); go('home'); }}>Delete all my data</button>
        </Sheet>
      )}
    </>
  );
}

function TargetsSheet({ onClose }: { onClose: () => void }) {
  const p = useStore((s) => s.profile)!;
  const [t, setT] = useState({ ...p.targets });
  return (
    <Sheet title="Nutrition targets" onClose={onClose}>
      <div className="grid2">{(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
        <label key={k} className="field"><span>{k === 'calories' ? 'Calories (kcal)' : `${k[0].toUpperCase() + k.slice(1)} (g)`}</span>
          <input className="input" inputMode="numeric" value={t[k]} onChange={(e) => setT({ ...t, [k]: +e.target.value || 0 })} /></label>
      ))}</div>
      <p className="tiny dim">Macros add up to {t.protein * 4 + t.carbs * 4 + t.fat * 9} kcal.</p>
      {t.calories < 1200 && <div className="banner">Very low calorie targets are hard to sustain and can cost muscle. Consider a more moderate target.</div>}
      <button className="btn primary block" onClick={() => { setState((s) => ({ ...s, profile: { ...s.profile!, targets: t } })); toast('Targets saved'); onClose(); }}>Save</button>
    </Sheet>
  );
}
