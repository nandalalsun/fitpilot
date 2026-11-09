import { useEffect, useRef, useState } from 'react';
import { dayTotals } from '../lib/analytics';
import { allFoods, makeItem, rescaleItem, searchFoods, suggestMeals, totals, type Food } from '../lib/foods';
import { itemLabel } from '../lib/coach';
import { parseFoodText, slotForTime } from '../lib/nlp';
import { getState, replaceState, setState, useStore } from '../lib/store';
import type { MealEntry, MealItem, MealSlot } from '../lib/types';
import { addDays, fmtDate, todayISO, uid } from '../lib/util';
import { Icon, MacroBar, Ring, Seg, Sheet, toast } from '../ui/kit';
import { useNav } from '../ui/nav';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snacks' };

export interface Draft { id?: string; date: string; slot: MealSlot; items: MealItem[]; source: MealEntry['source']; estimated: boolean; photo?: string; notes?: string }

/** Review/edit screen shared by every logging method. Nothing is saved until the user taps Save. */
export function MealEditor({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const custom = useStore((s) => s.customFoods);
  const [d, setD] = useState<Draft>(draft);
  const [adding, setAdding] = useState(false);
  const [saveAs, setSaveAs] = useState('');
  const t = totals(d.items);
  const setItem = (i: number, it: MealItem) => setD({ ...d, items: d.items.map((x, j) => (j === i ? it : x)) });
  const unitsFor = (it: MealItem) => allFoods(custom).find((f) => f.id === it.foodId)?.units.map((u) => u.name) ?? [it.unit];
  const uncertain = d.items.some((i) => i.uncertain);

  const save = () => {
    const prev = getState();
    setState((s) => {
      const entry: MealEntry = { id: d.id ?? uid(), date: d.date, slot: d.slot, items: d.items, source: d.source, estimated: d.estimated, createdAt: Date.now(), photo: d.photo };
      const meals = d.id ? s.meals.map((m) => (m.id === d.id ? entry : m)) : [...s.meals, entry];
      const savedMeals = saveAs.trim() ? [...s.savedMeals, { id: uid(), name: saveAs.trim(), items: d.items.map((i) => ({ ...i, uncertain: false })) }] : s.savedMeals;
      return { ...s, meals, savedMeals };
    });
    toast(d.id ? 'Meal updated' : 'Meal saved', () => replaceState(prev));
    onClose();
  };

  return (
    <Sheet title={d.id ? 'Edit meal' : 'Review meal'} onClose={onClose}>
      {d.photo && <img className="photo-prev" src={d.photo} alt="Meal" />}
      {d.estimated && <div className="banner">These values are <b>estimates</b>{d.source === 'photo' ? ' from a photo' : d.source === 'text' || d.source === 'coach' ? ' from your description' : ''}. Check the items and quantities{uncertain ? ' — highlighted rows were guessed' : ''} before saving.</div>}
      {d.notes && <p className="small muted">{d.notes}</p>}
      <Seg value={d.slot} onChange={(slot) => setD({ ...d, slot })} options={SLOTS.map((s) => ({ v: s, l: SLOT_LABEL[s] }))} />
      <div className="col">
        {d.items.map((it, i) => (
          <div key={i} className="card tight" style={it.uncertain ? { borderColor: 'rgba(255,196,107,.5)' } : undefined}>
            <div className="row between">
              <input className="input" style={{ padding: '6px 8px', fontWeight: 600 }} value={it.name} onChange={(e) => setItem(i, { ...it, name: e.target.value })} aria-label="Food name" />
              <button className="icon-btn plain" aria-label={`Remove ${it.name}`} onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })}><Icon name="trash" /></button>
            </div>
            <div className="row">
              <input className="input num" style={{ width: 80 }} inputMode="decimal" aria-label="Quantity" value={it.qty}
                onChange={(e) => { const q = parseFloat(e.target.value); if (!isNaN(q) && q > 0) setItem(i, rescaleItem(it, q, it.unit, custom)); }} />
              <select className="input" style={{ width: 'auto' }} value={it.unit} aria-label="Unit" onChange={(e) => setItem(i, rescaleItem(it, it.qty, e.target.value, custom))}>
                {[...new Set([it.unit, ...unitsFor(it)])].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <span className="tiny muted">≈ {it.grams} g</span>
              {it.uncertain && <span className="badge est">Check</span>}
            </div>
            <div className="grid4">
              {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
                <label key={k} className="field"><span className="tiny">{k === 'kcal' ? 'kcal' : k + ' g'}</span>
                  <input className="input num" style={{ padding: '6px 4px' }} inputMode="decimal" value={it[k]} onChange={(e) => setItem(i, { ...it, [k]: parseFloat(e.target.value) || 0, uncertain: false })} />
                </label>
              ))}
            </div>
          </div>
        ))}
        {!d.items.length && <div className="empty">No items yet.</div>}
        <button className="btn ghost" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Add item</button>
      </div>
      <div className="card tight"><div className="row between"><b>Total</b><span>{t.kcal} kcal · <span style={{ color: 'var(--protein)' }}>{Math.round(t.protein)} g P</span> · {Math.round(t.carbs)} g C · {Math.round(t.fat)} g F</span></div></div>
      {!d.id && <input className="input" placeholder="Save as a favourite meal (optional name)" value={saveAs} onChange={(e) => setSaveAs(e.target.value)} />}
      <button className="btn primary block lg" disabled={!d.items.length} onClick={save}>{d.id ? 'Save changes' : 'Save meal'}</button>
      {adding && <FoodSearch onClose={() => setAdding(false)} onPick={(it) => { setD({ ...d, items: [...d.items, it] }); setAdding(false); }} />}
    </Sheet>
  );
}

function FoodSearch({ onClose, onPick }: { onClose: () => void; onPick: (it: MealItem) => void }) {
  const custom = useStore((s) => s.customFoods);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Food | null>(null);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [creating, setCreating] = useState(false);
  const res = searchFoods(q, custom);
  if (creating) return <CustomFoodForm initialName={q} onClose={() => setCreating(false)} onSaved={(f) => { setCreating(false); setSel(f); setUnit(f.units[0].name); }} />;
  return (
    <Sheet title={sel ? sel.name : 'Add food'} onClose={onClose}>
      {!sel ? (
        <>
          <input className="input" autoFocus placeholder="Search foods (e.g. chicken, rice, roti)" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="list">{res.map((f) => (
            <button key={f.id} className="list-item tap" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', color: 'inherit' }} onClick={() => { setSel(f); setUnit(f.units[0].name); }}>
              <div className="grow"><div>{f.name}{f.custom && <span className="badge" style={{ marginLeft: 6 }}>Custom</span>}</div><div className="tiny muted">per 100 g: {f.per100g.kcal} kcal · {f.per100g.protein} g protein</div></div><Icon name="plus" size={18} />
            </button>
          ))}</div>
          <button className="btn ghost" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> Create custom food{q ? ` "${q}"` : ''}</button>
        </>
      ) : (
        <>
          <div className="row">
            <input className="input num" style={{ width: 90 }} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">{sel.units.map((u) => <option key={u.name} value={u.name}>{u.name}{u.name !== 'g' ? ` (${u.grams} g)` : ''}</option>)}</select>
          </div>
          {(() => { const it = makeItem(sel, parseFloat(qty) || 0, unit); return <p className="small">{it.kcal} kcal · {it.protein} g protein · {it.carbs} g carbs · {it.fat} g fat</p>; })()}
          <div className="row"><button className="btn" onClick={() => setSel(null)}>Back</button><button className="btn primary grow" disabled={!(parseFloat(qty) > 0)} onClick={() => onPick(makeItem(sel, parseFloat(qty), unit))}>Add</button></div>
        </>
      )}
    </Sheet>
  );
}

function CustomFoodForm({ initialName, onClose, onSaved }: { initialName: string; onClose: () => void; onSaved: (f: Food) => void }) {
  const [name, setName] = useState(initialName);
  const [serving, setServing] = useState('100');
  const [servingName, setServingName] = useState('serving');
  const [m, setM] = useState({ kcal: '', protein: '', carbs: '', fat: '' });
  const g = parseFloat(serving) || 100;
  const save = () => {
    const per = (v: string) => Math.round(((parseFloat(v) || 0) / g) * 1000) / 10;
    const food = { id: 'custom_' + uid(), name: name.trim(), per100g: { kcal: Math.round(((parseFloat(m.kcal) || 0) / g) * 100), protein: per(m.protein), carbs: per(m.carbs), fat: per(m.fat) }, units: [{ name: servingName.trim() || 'serving', grams: g }] };
    setState((s) => ({ ...s, customFoods: [...s.customFoods, food] }));
    toast('Custom food saved');
    onSaved({ ...food, aliases: [food.name.toLowerCase()], custom: true, units: [...food.units, { name: 'g', grams: 1 }] });
  };
  return (
    <Sheet title="Custom food" onClose={onClose}>
      <label className="field"><span>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid2">
        <label className="field"><span>Serving name</span><input className="input" value={servingName} onChange={(e) => setServingName(e.target.value)} /></label>
        <label className="field"><span>Serving size (g)</span><input className="input" inputMode="decimal" value={serving} onChange={(e) => setServing(e.target.value)} /></label>
      </div>
      <div className="label">Per serving (from the label)</div>
      <div className="grid4">{(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
        <label key={k} className="field"><span className="tiny">{k}</span><input className="input num" inputMode="decimal" value={m[k]} onChange={(e) => setM({ ...m, [k]: e.target.value })} /></label>
      ))}</div>
      <button className="btn primary block" disabled={!name.trim() || !m.kcal} onClick={save}>Save food</button>
    </Sheet>
  );
}

async function fileToDataUrl(file: File, max = 1024): Promise<{ dataUrl: string; base64: string }> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', 0.82);
  return { dataUrl, base64: dataUrl.split(',')[1] };
}

function thumb(dataUrl: string): Promise<string> {
  return new Promise((res) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); const s = 160 / Math.max(i.width, i.height); c.width = i.width * s; c.height = i.height * s; c.getContext('2d')!.drawImage(i, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7)); }; i.src = dataUrl; });
}

function PhotoLogger({ date, onClose, onDraft }: { date: string; onClose: () => void; onDraft: (d: Draft) => void }) {
  const ai = useStore((s) => s.ai);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ dataUrl: string; base64: string } | null>(null);
  const [hint, setHint] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const analyze = async () => {
    if (!photo) return;
    setBusy(true); setErr('');
    try {
      const { analyzeFoodPhoto } = await import('../lib/ai');
      const r = await analyzeFoodPhoto(ai.apiKey, ai.model, photo.base64, 'image/jpeg', hint);
      if (!r.items.length) { setErr(r.notes || 'No food was recognised. Try another photo or describe the meal instead.'); return; }
      onDraft({ date, slot: slotForTime(), items: r.items, source: 'photo', estimated: true, photo: await thumb(photo.dataUrl), notes: r.notes });
    } catch (e) { setErr(e instanceof Error && e.name === 'AiError' ? e.message : 'Something went wrong analysing the photo.'); }
    finally { setBusy(false); }
  };
  const describeInstead = async () => {
    const parsed = parseFoodText(hint);
    onDraft({ date, slot: parsed.slot ?? slotForTime(), items: parsed.items, source: 'text', estimated: true, photo: photo ? await thumb(photo.dataUrl) : undefined, notes: parsed.unknown.length ? `Not recognised: ${parsed.unknown.join(', ')} — add them manually.` : undefined });
  };
  return (
    <Sheet title="Log with a photo" onClose={onClose}>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await fileToDataUrl(f)); }} />
      {photo ? <img className="photo-prev" src={photo.dataUrl} alt="Your meal" /> : (
        <button className="card" style={{ alignItems: 'center', padding: 32, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
          <Icon name="camera" size={36} /><b>Take or choose a photo</b><span className="small muted">Good light and the whole plate in view help accuracy.</span>
        </button>
      )}
      {photo && <button className="btn sm ghost" onClick={() => fileRef.current?.click()}>Choose a different photo</button>}
      <label className="field"><span>Anything the photo can't show? (optional)</span><input className="input" value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. cooked in 1 tbsp olive oil, 200 g chicken" /></label>
      {ai.apiKey ? (
        <>
          <button className="btn primary block lg" disabled={!photo || busy} onClick={analyze}>{busy ? <><span className="spinner" /> Analysing…</> : <><Icon name="sparkle" size={18} /> Estimate nutrition</>}</button>
          <p className="tiny dim"><span className="badge ai">AI</span> The photo is sent to Anthropic's Claude API for analysis. Results are estimates you review before saving.</p>
        </>
      ) : (
        <div className="banner info">{import.meta.env.VITE_HOSTED === '1' ? 'AI photo analysis is off in this hosted preview.' : 'Photo analysis needs an AI key (Settings → AI).'} For now, describe what's on the plate above and FitPilot will estimate from its food database.
          <div className="row" style={{ marginTop: 8 }}><button className="btn sm primary" disabled={!hint.trim()} onClick={describeInstead}>Estimate from description</button></div>
        </div>
      )}
      {err && <div className="banner">{err}</div>}
    </Sheet>
  );
}

function TextLogger({ date, onClose, onDraft }: { date: string; onClose: () => void; onDraft: (d: Draft) => void }) {
  const custom = useStore((s) => s.customFoods);
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseFoodText(text, custom) : null;
  return (
    <Sheet title="Describe your meal" onClose={onClose}>
      <textarea className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={'e.g. "I had one cup of rice and 150 grams of chicken"\nor "chicken curry with two rotis"'} />
      {parsed && (
        <div className="card tight">
          {parsed.items.map((i, k) => <div key={k} className="ex-line"><span>{itemLabel(i)}{i.uncertain && <span className="badge est" style={{ marginLeft: 6 }}>qty?</span>}</span><span className="p">{i.kcal} kcal · {i.protein} g P</span></div>)}
          {parsed.unknown.length > 0 && <p className="small" style={{ color: 'var(--amber)' }}>Not recognised: {parsed.unknown.join(', ')}. You can add these manually on the next screen.</p>}
          {!parsed.items.length && <p className="small muted">Keep typing — try including quantities like "2 eggs" or "150 g chicken".</p>}
        </div>
      )}
      <button className="btn primary block" disabled={!parsed?.items.length} onClick={() => onDraft({ date, slot: parsed!.slot ?? slotForTime(), items: parsed!.items, source: 'text', estimated: true, notes: parsed!.unknown.length ? `Not recognised: ${parsed!.unknown.join(', ')}` : undefined })}>Review & save</button>
    </Sheet>
  );
}

export default function Nutrition() {
  const state = useStore((s) => s);
  const nav = useNav();
  const p = state.profile!;
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [mode, setMode] = useState<null | 'photo' | 'text' | 'search' | 'saved'>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => { if (nav.params?.draft) { try { setDraft(JSON.parse(nav.params.draft)); } catch { /* ignore */ } } }, [nav]);
  const meals = state.meals.filter((m) => m.date === date);
  const t = dayTotals(state, date);
  const remK = p.targets.calories - t.kcal;
  const remP = Math.max(0, p.targets.protein - t.protein);
  const ideas = date === today ? suggestMeals(remK, remP, p.diet) : [];

  const del = (m: MealEntry) => { const prev = getState(); setState((s) => ({ ...s, meals: s.meals.filter((x) => x.id !== m.id) })); toast('Meal deleted', () => replaceState(prev)); };

  return (
    <>
      <div className="topbar">
        <h1>Nutrition</h1>
        <div className="row">
          <button className="icon-btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}><Icon name="back" /></button>
          <span className="small" style={{ minWidth: 76, textAlign: 'center' }}>{fmtDate(date, today)}</span>
          <button className="icon-btn" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}><Icon name="chevron" /></button>
        </div>
      </div>
      <div className="page">
        <div className="card">
          <div className="row" style={{ gap: 16 }}>
            <Ring value={t.kcal} max={p.targets.calories} size={112} stroke={11}>
              <div><div style={{ fontWeight: 800, fontSize: 22 }}>{Math.abs(remK)}</div><div className="tiny muted">{remK >= 0 ? 'kcal left' : 'kcal over'}</div></div>
            </Ring>
            <div className="col grow" style={{ gap: 10 }}>
              <MacroBar label="Protein" value={t.protein} target={p.targets.protein} color="var(--protein)" />
              <MacroBar label="Carbs" value={t.carbs} target={p.targets.carbs} color="var(--carbs)" />
              <MacroBar label="Fat" value={t.fat} target={p.targets.fat} color="var(--fat)" />
              <div className="tiny muted">{t.kcal} / {p.targets.calories} kcal eaten</div>
            </div>
          </div>
          <div className="grid4">
            <button className="btn" style={{ flexDirection: 'column', gap: 2, borderRadius: 14, padding: 10 }} onClick={() => setMode('photo')}><Icon name="camera" size={20} /><span className="tiny">Photo</span></button>
            <button className="btn" style={{ flexDirection: 'column', gap: 2, borderRadius: 14, padding: 10 }} onClick={() => setMode('text')}><Icon name="pen" size={20} /><span className="tiny">Describe</span></button>
            <button className="btn" style={{ flexDirection: 'column', gap: 2, borderRadius: 14, padding: 10 }} onClick={() => setMode('search')}><Icon name="search" size={20} /><span className="tiny">Search</span></button>
            <button className="btn" style={{ flexDirection: 'column', gap: 2, borderRadius: 14, padding: 10 }} onClick={() => setMode('saved')}><Icon name="star" size={20} /><span className="tiny">Saved</span></button>
          </div>
        </div>

        {SLOTS.map((slot) => {
          const ms = meals.filter((m) => m.slot === slot);
          const st = totals(ms.flatMap((m) => m.items));
          return (
            <div key={slot} className="card tight">
              <div className="row between"><h3>{SLOT_LABEL[slot]}</h3><span className="small muted">{ms.length ? `${st.kcal} kcal · ${Math.round(st.protein)} g P` : ''}</span></div>
              {ms.map((m) => (
                <div key={m.id} className="list-item">
                  {m.photo && <img className="thumb" src={m.photo} alt="" />}
                  <button className="grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => setDraft({ id: m.id, date: m.date, slot: m.slot, items: m.items, source: m.source, estimated: m.estimated, photo: m.photo })}>
                    <div className="small">{m.items.map((i) => i.name.replace(/\s*\(.*\)/, '')).join(', ')}</div>
                    <div className="tiny muted">{totals(m.items).kcal} kcal · {Math.round(totals(m.items).protein)} g protein {m.estimated && <span className="badge est">estimate</span>}</div>
                  </button>
                  <button className="icon-btn plain" aria-label="Delete meal" onClick={() => del(m)}><Icon name="trash" /></button>
                </div>
              ))}
              {!ms.length && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setDraft({ date, slot, items: [], source: 'manual', estimated: false })}><Icon name="plus" size={16} /> Add {slot}</button>}
            </div>
          );
        })}

        {ideas.length > 0 && remP > 15 && (
          <div className="card">
            <div className="label">Ideas for your remaining {Math.round(remP)} g protein</div>
            {ideas.map((i) => <div key={i.name} className="ex-line small"><span>{i.name}</span><span className="p">{i.kcal} kcal · {i.protein} g</span></div>)}
          </div>
        )}
      </div>

      {mode === 'photo' && <PhotoLogger date={date} onClose={() => setMode(null)} onDraft={(d) => { setMode(null); setDraft(d); }} />}
      {mode === 'text' && <TextLogger date={date} onClose={() => setMode(null)} onDraft={(d) => { setMode(null); setDraft(d); }} />}
      {mode === 'search' && <FoodSearch onClose={() => setMode(null)} onPick={(it) => { setMode(null); setDraft({ date, slot: slotForTime(), items: [it], source: 'manual', estimated: false }); }} />}
      {mode === 'saved' && (
        <Sheet title="Saved meals" onClose={() => setMode(null)}>
          {state.savedMeals.length ? state.savedMeals.map((sm) => (
            <div key={sm.id} className="list-item">
              <button className="grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => { setMode(null); setDraft({ date, slot: slotForTime(), items: sm.items, source: 'manual', estimated: false }); }}>
                <div>{sm.name}</div><div className="tiny muted">{totals(sm.items).kcal} kcal · {Math.round(totals(sm.items).protein)} g protein</div>
              </button>
              <button className="icon-btn plain" aria-label="Delete saved meal" onClick={() => setState((s) => ({ ...s, savedMeals: s.savedMeals.filter((x) => x.id !== sm.id) }))}><Icon name="trash" /></button>
            </div>
          )) : <div className="empty">No saved meals yet. When saving a meal, give it a name to reuse it with one tap.</div>}
        </Sheet>
      )}
      {draft && <MealEditor draft={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
