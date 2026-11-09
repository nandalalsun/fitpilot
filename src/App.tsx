import { useEffect } from 'react';
import { pickToSend, showNotification } from './lib/reminders';
import { getState, refreshSchedule, useStore } from './lib/store';
import Coach from './screens/Coach';
import Home from './screens/Home';
import Nutrition from './screens/Nutrition';
import Onboarding from './screens/Onboarding';
import Progress from './screens/Progress';
import Settings from './screens/Settings';
import Workout from './screens/Workout';
import { Icon, toast, ToastHost } from './ui/kit';
import { go, useNav, type Tab } from './ui/nav';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'workout', label: 'Workout', icon: 'dumbbell' },
  { id: 'nutrition', label: 'Nutrition', icon: 'food' },
  { id: 'coach', label: 'Coach', icon: 'coach' },
  { id: 'progress', label: 'Progress', icon: 'chart' },
];

export default function App() {
  const hasProfile = useStore((s) => !!s.profile && !!s.plan);
  const active = useStore((s) => !!s.activeSessionId);
  const nav = useNav();

  useEffect(() => {
    // Keep the rolling schedule fresh across midnight and deliver due reminders.
    const tick = async () => {
      refreshSchedule();
      for (const r of pickToSend(getState())) {
        const shown = document.visibilityState === 'hidden' && (await showNotification(r));
        if (!shown) toast(`${r.title} — ${r.body}`);
      }
    };
    tick();
    const id = setInterval(tick, 60_000);
    const vis = () => document.visibilityState === 'visible' && refreshSchedule();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);

  if (!hasProfile) return <><Onboarding /><ToastHost /></>;

  return (
    <div className="app">
      {nav.tab === 'home' && <Home />}
      {nav.tab === 'workout' && <Workout />}
      {nav.tab === 'nutrition' && <Nutrition />}
      {nav.tab === 'coach' && <Coach />}
      {nav.tab === 'progress' && <Progress />}
      {nav.tab === 'settings' && <Settings />}
      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          {TABS.map((t) => (
            <button key={t.id} className={nav.tab === t.id ? 'on' : ''} onClick={() => go(t.id)} aria-current={nav.tab === t.id ? 'page' : undefined}>
              <Icon name={t.icon} />
              {t.label}{t.id === 'workout' && active ? ' •' : ''}
            </button>
          ))}
        </div>
      </nav>
      <ToastHost />
    </div>
  );
}
