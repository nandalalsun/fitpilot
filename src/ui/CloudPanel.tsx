import { cloudResolve, cloudSignIn, cloudSignOut, cloudSyncNow, useCloud } from '../lib/cloud';
import { SYNC_AVAILABLE } from '../lib/firebase-config';
import { Sheet } from './kit';

const PHASE_LABEL: Record<string, string> = {
  connecting: 'Connecting…', syncing: 'Syncing…', synced: 'Backed up', offline: 'Offline — will sync when you reconnect', error: 'Sync problem', choose: 'Waiting for your choice',
};

export function CloudPanel() {
  const c = useCloud();
  if (!SYNC_AVAILABLE) return (
    <div className="card">
      <div className="label">Cloud backup & sync</div>
      <p className="small muted">Not available in this preview. Use the installed FitPilot app to back up to your Google account.</p>
    </div>
  );
  return (
    <div className="card">
      <div className="label">Cloud backup & sync</div>
      {c.phase === 'signed_out' ? (
        <>
          <p className="small muted">Sign in with Google to back up everything to your own private cloud space. Reinstall the app or switch phones, sign in again, and your workouts, meals and progress come back. The app keeps working offline and syncs when you're online.</p>
          <button className="btn primary" onClick={() => cloudSignIn()}>Sign in with Google</button>
          {c.error && <div className="banner">{c.error}</div>}
        </>
      ) : (
        <>
          <div className="row between">
            <div><div className="small">{c.email}</div><div className="tiny muted">{PHASE_LABEL[c.phase] ?? ''}{c.lastSynced && c.phase === 'synced' ? ` · ${new Date(c.lastSynced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</div></div>
            <span className={`badge ${c.phase === 'synced' ? 'completed' : c.phase === 'error' ? 'missed' : 'in_progress'}`}>{c.phase === 'synced' ? 'On' : c.phase === 'error' ? 'Error' : '…'}</span>
          </div>
          {c.error && <div className="banner">{c.error}</div>}
          <div className="row">
            <button className="btn sm" onClick={() => cloudSyncNow()}>Sync now</button>
            <button className="btn sm ghost" onClick={() => cloudSignOut()}>Sign out</button>
          </div>
          <p className="tiny dim">Only you can read this data; it's stored in FitPilot's Firebase project under your Google account. Signing out keeps a copy on this device.</p>
        </>
      )}
    </div>
  );
}

/** Shown once if both this device and the cloud already have FitPilot data. */
export function CloudChoice() {
  const c = useCloud();
  if (c.phase !== 'choose') return null;
  return (
    <Sheet title="You have data in two places" onClose={() => undefined}>
      <p className="muted small">Your Google account already has a FitPilot backup, and this device has its own data too. Which one should FitPilot keep?</p>
      <button className="btn primary block" onClick={() => cloudResolve('cloud')}>Use my cloud backup <span className="tiny">(replaces this device)</span></button>
      <button className="btn block" onClick={() => cloudResolve('device')}>Use this device's data <span className="tiny">(replaces the cloud backup)</span></button>
      <button className="btn ghost block" onClick={() => cloudSignOut()}>Cancel and sign out</button>
    </Sheet>
  );
}
