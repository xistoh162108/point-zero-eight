// Firebase setup and the only three server calls the app makes.
// Nothing runs at module load: fb() initialises on first call, so a build or a deploy
// without the environment variables does not crash. Call it only from effects and handlers, inside try/catch.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  type Firestore,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Summary, SummaryBody } from '../storage/upload';
import { parseRow } from './room';

export const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID ?? 'hp26f';

let cached: { db: Firestore; ready: Promise<unknown> } | null = null;

export function fb(): { db: Firestore; ready: Promise<unknown> } {
  if (!cached) {
    const config = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
    if (!config.apiKey || !config.projectId) throw new Error('Firebase is not configured');
    const app = initializeApp(config);
    // Anonymous sign-in, once per page load. Only writes need it.
    const ready = signInAnonymously(getAuth(app));
    ready.catch((err) => console.warn('anonymous sign-in failed', err));
    cached = { db: getFirestore(app), ready };
  }
  return cached;
}

const sessionsRef = () => collection(fb().db, 'events', EVENT_ID, 'sessions');

export async function sendSummary(summary: SummaryBody): Promise<void> {
  await fb().ready;
  await addDoc(sessionsRef(), { ...summary, at: serverTimestamp() });
}

const toRows = (snap: QuerySnapshot<DocumentData>): Summary[] =>
  snap.docs
    .map((d) => {
      const data = d.data();
      return parseRow(data, typeof data.at?.toDate === 'function' ? data.at.toDate().toISOString() : null);
    })
    .filter((r): r is Summary => r !== null);

export async function fetchRows(): Promise<Summary[]> {
  return toRows(await getDocs(sessionsRef()));
}

export function watchRows(onRows: (rows: Summary[]) => void, onError: (err: Error) => void): () => void {
  return onSnapshot(sessionsRef(), (snap) => onRows(toRows(snap)), onError);
}
