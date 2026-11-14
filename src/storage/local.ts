// Device storage. Every record is written here first; the server only gets a summary.
// The stored format is frozen after M1: tonight's code must read this afternoon's records.
import type { HzClass, Os, Prediction, Session } from '../engine/types';

export const KEYS = {
  device: 'pze:v1:device',
  sessions: 'pze:v1:sessions',
  outbox: 'pze:v1:outbox',
  roomcache: 'pze:v1:roomcache',
  pending: 'pze:v1:pending', // sessionStorage: answers from the start screen
} as const;

export const BASELINE_END_HOUR = 20; // set to 22 if the 18:30 stop rule fires
export const COMPARE_COOLDOWN_MIN = 30;
export const MAX_BASELINES = 3;

export interface Device {
  id: string; // random UUID. Never sent to the server
  createdAt: string;
  team: boolean;
}

export interface Pending {
  awakeH: number;
  prediction: Prediction | null;
  caffeine: boolean;
  alcohol: boolean;
  justWoke: boolean;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return JSON.parse(raw) as T;
}

// Write a probe and read it back. False means the test must not start.
export function storageOk(): boolean {
  try {
    const probe = 'pze:v1:probe';
    localStorage.setItem(probe, '1');
    const ok = localStorage.getItem(probe) === '1';
    localStorage.removeItem(probe);
    return ok;
  } catch (err) {
    console.warn('storage blocked', err);
    return false;
  }
}

export function getDevice(): Device {
  let d = readJson<Device | null>(KEYS.device, null);
  const teamParam = new URLSearchParams(window.location.search).get('team') === '1';
  if (!d) {
    d = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), team: teamParam };
    localStorage.setItem(KEYS.device, JSON.stringify(d));
  } else if (teamParam && !d.team) {
    d = { ...d, team: true };
    localStorage.setItem(KEYS.device, JSON.stringify(d));
  }
  return d;
}

// Throws if the stored value is unreadable, so a later write can never wipe records.
export function getSessions(): Session[] {
  return readJson<Session[]>(KEYS.sessions, []);
}

// Read all, change, write all. Returns false if the write failed.
export function addSession(s: Session): boolean {
  try {
    const all = getSessions();
    all.push(s);
    localStorage.setItem(KEYS.sessions, JSON.stringify(all));
    return true;
  } catch (err) {
    console.error('could not save session', err);
    return false;
  }
}

export function markUploaded(id: string): void {
  try {
    const all = getSessions().map((s) => (s.id === id ? { ...s, uploaded: true } : s));
    localStorage.setItem(KEYS.sessions, JSON.stringify(all));
  } catch (err) {
    console.error('could not mark session uploaded', err);
  }
}

const usableBaseline = (s: Session, hzClass: HzClass) =>
  s.mode === 'baseline' && !s.justWoke && s.hzClass === hzClass;

export function decideMode(now: Date, sessions: Session[], hzClass: HzClass): 'baseline' | 'compare' {
  const usable = sessions.filter((s) => usableBaseline(s, hzClass));
  if (usable.length === 0) return 'baseline';
  const hour = now.getHours();
  const last = usable[usable.length - 1];
  const minutesSinceLast = (now.getTime() - Date.parse(last.startedAt)) / 60000;
  if (hour >= 12 && hour < BASELINE_END_HOUR && usable.length < 2 && minutesSinceLast >= 30) return 'baseline';
  return 'compare';
}

// Daytime records a comparison uses: same hzClass and length, most recent first, at most three.
export function baselinesFor(sessions: Session[], hzClass: HzClass, lengthS: 90 | 180): Session[] {
  return sessions
    .filter((s) => usableBaseline(s, hzClass) && s.lengthS === lengthS)
    .slice(-MAX_BASELINES)
    .reverse();
}

// Minutes until a new comparison is allowed. 0 means allowed now.
export function compareCooldownMin(now: Date, sessions: Session[]): number {
  const compares = sessions.filter((s) => s.mode === 'compare');
  if (compares.length === 0) return 0;
  const last = compares[compares.length - 1];
  const since = (now.getTime() - Date.parse(last.startedAt)) / 60000;
  return since >= COMPARE_COOLDOWN_MIN ? 0 : Math.ceil(COMPARE_COOLDOWN_MIN - since);
}

export function detectOs(ua: string): Os {
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export function setPending(p: Pending): void {
  sessionStorage.setItem(KEYS.pending, JSON.stringify(p));
}

export function getPending(): Pending | null {
  const raw = sessionStorage.getItem(KEYS.pending);
  return raw === null ? null : (JSON.parse(raw) as Pending);
}
