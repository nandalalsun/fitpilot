// Cloud backup & sync with Firebase (Auth + Firestore).
// Local storage stays the source of truth for the UI, so the app works offline;
// changes are pushed per record and remote changes are merged back in.
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut as fbSignOut, type User } from 'firebase/auth';
import {
  collection, doc, getDocsFromServer, getDocs, initializeFirestore, onSnapshot, persistentLocalCache, persistentMultipleTabManager,
  serverTimestamp, writeBatch, type Firestore,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';
import { fromRecords, hash, toRecords, type Rec, type RecMap } from './records';
import { getState, replaceState, subscribe } from './store';

export type SyncPhase = 'signed_out' | 'connecting' | 'choose' | 'syncing' | 'synced' | 'offline' | 'error';
export interface SyncStatus { phase: SyncPhase; email?: string; lastSynced?: number; error?: string; remoteCount?: number }

let status: SyncStatus = { phase: 'signed_out' };
const ls = new Set<() => void>();
const setStatus = (p: Partial<SyncStatus>) => {
  status = { ...status, ...p };
  try { if (status.phase === 'signed_out') localStorage.removeItem('fitpilot.cloud'); else localStorage.setItem('fitpilot.cloud', '1'); } catch { /* ignore */ }
  ls.forEach((l) => l());
};
export const getStatus = () => status;
export const onStatus = (fn: () => void) => { ls.add(fn); return () => { ls.delete(fn); }; };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db: Firestore;
try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch { db = initializeFirestore(app, {}); }

const DELETED = '∅';
let user: User | null = null;
let synced: Record<string, string> = {}; // record id → hash last agreed with the cloud
let stopSnapshot: (() => void) | null = null;
let stopLocal: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRemote: RecMap | null = null;

const metaKey = (uid: string) => `fitpilot.sync.${uid}`;
const loadMeta = (uid: string) => { try { return JSON.parse(localStorage.getItem(metaKey(uid)) ?? '{}'); } catch { return {}; } };
const saveMeta = () => { if (user) try { localStorage.setItem(metaKey(user.uid), JSON.stringify(synced)); } catch { /* ignore */ } };
const recordsRef = (uid: string) => collection(db, 'users', uid, 'records');

function readRemote(snap: { docs: { id: string; data: () => Record<string, unknown> }[] }): RecMap {
  const out: RecMap = {};
  snap.docs.forEach((d) => { const x = d.data(); if (!x.deleted && typeof x.json === 'string') out[d.id] = { c: String(x.c), json: x.json }; });
  return out;
}

// ── Push local changes ───────────────────────────────────────────

async function push() {
  if (!user) return;
  const cur = toRecords(getState());
  const ops: { id: string; rec: Rec | null }[] = [];
  for (const [id, r] of Object.entries(cur)) if (synced[id] !== hash(r.json)) ops.push({ id, rec: r });
  for (const id of Object.keys(synced)) if (!cur[id] && synced[id] !== DELETED) ops.push({ id, rec: null });
  if (!ops.length) { if (status.phase === 'syncing') setStatus({ phase: navigator.onLine ? 'synced' : 'offline', lastSynced: Date.now() }); return; }
  setStatus({ phase: 'syncing' });
  const ref = recordsRef(user.uid);
  for (let i = 0; i < ops.length; i += 400) {
    const batch = writeBatch(db);
    for (const { id, rec } of ops.slice(i, i + 400)) {
      batch.set(doc(ref, id), rec
        ? { c: rec.c, json: rec.json, deleted: false, updatedAt: serverTimestamp() }
        : { c: id.split(':')[0], json: '', deleted: true, updatedAt: serverTimestamp() });
      synced[id] = rec ? hash(rec.json) : DELETED;
    }
    saveMeta();
    // Resolves once the server confirms; offline, Firestore queues the write and sends it later.
    batch.commit().then(
      () => setStatus({ phase: 'synced', lastSynced: Date.now(), error: undefined }),
      (e) => setStatus({ phase: 'error', error: friendly(e) }),
    );
  }
  if (!navigator.onLine) setStatus({ phase: 'offline' });
}

const schedulePush = () => { if (pushTimer) clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); };

// ── Pull remote changes ──────────────────────────────────────────

function listen(uid: string) {
  stopSnapshot?.();
  stopSnapshot = onSnapshot(recordsRef(uid), { includeMetadataChanges: false }, (snap) => {
    const changes = snap.docChanges().filter((c) => !c.doc.metadata.hasPendingWrites);
    if (!changes.length) return;
    const recs = toRecords(getState());
    let changed = false;
    for (const ch of changes) {
      const id = ch.doc.id;
      const x = ch.doc.data();
      const remoteDeleted = ch.type === 'removed' || !!x.deleted;
      const h = remoteDeleted ? DELETED : hash(String(x.json));
      if (synced[id] === h) continue; // we already agree with the cloud
      if (remoteDeleted) { if (recs[id]) { delete recs[id]; changed = true; } }
      else { recs[id] = { c: String(x.c), json: String(x.json) }; changed = true; }
      synced[id] = h;
    }
    saveMeta();
    if (changed) replaceState(fromRecords(recs, getState()));
    setStatus({ phase: snap.metadata.fromCache && !navigator.onLine ? 'offline' : 'synced', lastSynced: Date.now() });
  }, (e) => setStatus({ phase: 'error', error: friendly(e) }));
  stopLocal?.();
  stopLocal = subscribe(schedulePush);
}

// ── First connection on this device ──────────────────────────────

async function connect(u: User) {
  user = u;
  setStatus({ phase: 'connecting', email: u.email ?? undefined, error: undefined });
  synced = loadMeta(u.uid);
  let remote: RecMap;
  try { remote = readRemote(await getDocsFromServer(recordsRef(u.uid))); }
  catch { try { remote = readRemote(await getDocs(recordsRef(u.uid))); } catch (e) { setStatus({ phase: 'error', error: friendly(e) }); return; } }
  const local = getState();
  const firstTimeHere = Object.keys(synced).length === 0;
  const remoteHasData = Object.keys(remote).some((id) => id === 's:profile' && remote[id].json !== 'null');
  if (firstTimeHere && remoteHasData && local.profile) {
    // Both this device and the cloud have a FitPilot history. Let the user decide instead of guessing.
    pendingRemote = remote;
    setStatus({ phase: 'choose', remoteCount: Object.keys(remote).length });
    return;
  }
  if (firstTimeHere && remoteHasData) adoptRemote(remote);
  else if (!firstTimeHere) {
    // Normal reconnect: take remote records we haven't seen yet; local edits are pushed afterwards.
    const recs = toRecords(local);
    let changed = false;
    for (const [id, r] of Object.entries(remote)) {
      const h = hash(r.json);
      if (synced[id] !== h && (!recs[id] || hash(recs[id].json) === synced[id])) { recs[id] = r; synced[id] = h; changed = true; }
    }
    for (const id of Object.keys(synced)) if (!remote[id] && synced[id] !== DELETED && recs[id] && hash(recs[id].json) === synced[id]) { delete recs[id]; synced[id] = DELETED; changed = true; }
    saveMeta();
    if (changed) replaceState(fromRecords(recs, local));
  }
  listen(u.uid);
  await push();
  if (status.phase === 'connecting') setStatus({ phase: 'synced', lastSynced: Date.now() });
}

function adoptRemote(remote: RecMap) {
  synced = Object.fromEntries(Object.entries(remote).map(([id, r]) => [id, hash(r.json)]));
  saveMeta();
  replaceState(fromRecords(remote, getState()));
}

/** Resolve the first-sync choice when both this device and the cloud have data. */
export async function resolveChoice(choice: 'cloud' | 'device') {
  if (!user || !pendingRemote) return;
  const remote = pendingRemote;
  pendingRemote = null;
  if (choice === 'cloud') adoptRemote(remote);
  else synced = Object.fromEntries(Object.keys(remote).map((id) => [id, 'replace'])); // forces every remote record to be overwritten or deleted
  listen(user.uid);
  await push();
}

// ── Auth ─────────────────────────────────────────────────────────

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'Sign-in was cancelled.';
  if (code.includes('unauthorized-domain')) return 'This web address is not allowed to sign in yet. Add it under Firebase → Authentication → Settings → Authorized domains.';
  if (code.includes('operation-not-allowed')) return 'Google sign-in is not enabled yet. Turn it on in Firebase → Authentication → Sign-in method.';
  if (code.includes('permission-denied')) return 'The cloud refused access. Check that the Firestore security rules are deployed.';
  if (code.includes('unavailable') || code.includes('network')) return 'Offline — changes are saved on this device and will sync when you reconnect.';
  if (code.includes('failed-precondition') || code.includes('not-found')) return 'The cloud database is not set up yet (Firestore → Create database).';
  return (e as Error)?.message ?? 'Sync error';
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.includes('popup-blocked') || code.includes('operation-not-supported')) return signInWithRedirect(auth, provider);
    setStatus({ phase: 'error', error: friendly(e) });
  }
}

export async function signOut() {
  if (pushTimer) { clearTimeout(pushTimer); await push(); }
  stopSnapshot?.(); stopLocal?.(); stopSnapshot = stopLocal = null;
  await fbSignOut(auth);
}

export const syncNow = () => push();

let started = false;
export function startSync() {
  if (started) return;
  started = true;
  getRedirectResult(auth).catch((e) => setStatus({ phase: 'error', error: friendly(e) }));
  onAuthStateChanged(auth, (u) => {
    if (u) connect(u);
    else { user = null; stopSnapshot?.(); stopLocal?.(); stopSnapshot = stopLocal = null; setStatus({ phase: 'signed_out', email: undefined, error: undefined }); }
  });
  window.addEventListener('online', () => { if (user) { setStatus({ phase: 'syncing' }); push(); } });
  window.addEventListener('offline', () => { if (user) setStatus({ phase: 'offline' }); });
}
