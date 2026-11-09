import { useEffect, useRef, useState } from 'react';
import { applyProposal, describeProposal } from '../lib/actions';
import { handleMessage } from '../lib/coach';
import { computeInsights } from '../lib/insights';
import { getState, setState, useStore } from '../lib/store';
import type { ChatMessage, ProposalCard } from '../lib/types';
import { uid } from '../lib/util';
import { Icon, toast } from '../ui/kit';
import { go } from '../ui/nav';

const SUGGESTIONS = [
  "What's my workout today?",
  "I missed yesterday's workout",
  'I only trained chest today',
  'How much protein do I have left?',
  'Suggest a high-protein dinner',
  'Should I increase my weights?',
  'How was my week?',
  'I ate two boiled eggs and toast',
];

const push = (m: Omit<ChatMessage, 'id' | 'ts'>) => setState((s) => ({ ...s, chat: [...s.chat.slice(-200), { ...m, id: uid(), ts: Date.now() }] }));
const setCard = (msgId: string, cardId: string, st: ProposalCard['state']) =>
  setState((s) => ({ ...s, chat: s.chat.map((m) => (m.id !== msgId ? m : { ...m, cards: m.cards?.map((c) => (c.id === cardId ? { ...c, state: st } : c)) })) }));

export default function Coach() {
  const chat = useStore((s) => s.chat);
  const ai = useStore((s) => s.ai);
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat.length, thinking]);

  useEffect(() => {
    if (getState().chat.length) return;
    const ins = computeInsights(getState());
    push({ role: 'coach', text: `Hi! I'm your FitPilot coach. I know your plan, history and nutrition, so just tell me what happened or ask me anything.${ins.length ? `\n\nOne thing I noticed: ${ins[0].text}` : ''}`, cards: ins[0]?.card ? [ins[0].card] : undefined });
  }, []);

  async function send(msg: string) {
    const q = msg.trim();
    if (!q || thinking) return;
    setText('');
    push({ role: 'user', text: q });
    const r = handleMessage(getState(), q);
    if (r.handled) { push({ role: 'coach', text: r.text, cards: r.cards.length ? r.cards : undefined }); return; }
    if (!ai.apiKey) {
      push({ role: 'coach', text: "I'm not sure how to help with that one yet. I can log meals and workouts, adjust your schedule when you miss a session, suggest meals, recommend weight increases, and summarise your week." + (import.meta.env.VITE_HOSTED === '1' ? '' : '\n\nFor open-ended questions, add an Anthropic API key in Settings → AI coach.') });
      return;
    }
    setThinking(true);
    try {
      const { askCoach } = await import('../lib/ai');
      const answer = await askCoach(ai.apiKey, ai.model, getState(), q);
      push({ role: 'coach', text: answer, ai: true });
    } catch (e) {
      push({ role: 'coach', text: e instanceof Error && e.name === 'AiError' ? e.message : 'Something went wrong reaching the AI coach.' });
    } finally { setThinking(false); }
  }

  function confirm(m: ChatMessage, c: ProposalCard) {
    setState((s) => c.actions.reduce((x, a) => applyProposal(x, a), s));
    setCard(m.id, c.id, 'applied');
    toast(c.actions.length === 1 ? `${describeProposal(getState(), c.actions[0])} ✓` : 'Updated ✓');
  }

  return (
    <>
      <div className="topbar">
        <div><h1>Coach</h1><div className="sub">{ai.apiKey ? <><span className="badge ai">AI on</span> Open questions use Claude with a summary of your data</> : import.meta.env.VITE_HOSTED === '1' ? 'Runs on-device' : 'Runs on-device · add an AI key in Settings for open questions'}</div></div>
        {chat.length > 1 && <button className="btn sm ghost" onClick={() => setState((s) => ({ ...s, chat: [] }))}>Clear</button>}
      </div>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="chat">
          {chat.map((m) => (
            <div key={m.id} className="col" style={{ gap: 8 }}>
              <div className={`bubble ${m.role}`}>{m.ai && <span className="badge ai" style={{ marginRight: 6 }}>AI</span>}{m.text}</div>
              {m.cards?.map((c) => (
                <div key={c.id} className={`proposal ${c.state}`}>
                  <b className="small">{c.title}</b>
                  <p className="small muted">{c.detail}</p>
                  {c.state === 'pending' ? (
                    <div className="row wrap">
                      {c.actions.length > 0 && <button className="btn sm primary" onClick={() => confirm(m, c)}>Confirm</button>}
                      {c.actions[0]?.kind === 'log_meal' && (
                        <button className="btn sm" onClick={() => { const meal = (c.actions[0] as Extract<ProposalCard['actions'][0], { kind: 'log_meal' }>).meal; setCard(m.id, c.id, 'dismissed'); go('nutrition', { draft: JSON.stringify(meal) }); }}>Edit first</button>
                      )}
                      <button className="btn sm ghost" onClick={() => setCard(m.id, c.id, 'dismissed')}>{c.actions.length ? 'No thanks' : 'OK'}</button>
                    </div>
                  ) : <span className="tiny muted">{c.state === 'applied' ? '✓ Applied' : 'Dismissed'}</span>}
                </div>
              ))}
            </div>
          ))}
          {thinking && <div className="bubble coach row"><span className="spinner" /> Thinking…</div>}
          <div ref={end} />
        </div>
        <div className="chips scroll">{SUGGESTIONS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell me what you ate, trained or missed…" aria-label="Message" />
          <button className="icon-btn" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: 999 }} aria-label="Send" disabled={!text.trim()}><Icon name="send" /></button>
        </form>
      </div>
    </>
  );
}
