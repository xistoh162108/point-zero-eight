// Firebase setup and the only three server calls the app makes.
// Loaded with a dynamic import so the test screen never pays for it.
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { Summary, SummaryBody } from '../storage/upload';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID ?? 'hp26f';
export const configured = Boolean(config.apiKey && config.projectId);

const app = configured ? initializeApp(config) : null;
export const db = app ? getFirestore(app) : null;
// Anonymous sign-in, once per page load. Only writes need it.
export const ready = app ? signInAnonymously(getAuth(app)) : null;
ready?.catch((err) => console.warn('anonymous sign-in failed', err));

const sessionsRef = () => {
  if (!db) throw new Error('Firebase is not configured');
  return collection(db, 'events', EVENT_ID, 'sessions');
};

export async function sendSummary(summary: SummaryBody): Promise<void> {
  if (!ready) throw new Error('Firebase is not configured');
  await ready;
  await addDoc(sessionsRef(), { ...summary, at: serverTimestamp() });
}

const toRows = (snap: QuerySnapshot<DocumentData>): Summary[] =>
  snap.docs.map((d) => {
    const data = d.data();
    return { ...data, at: data.at?.toDate ? data.at.toDate().toISOString() : null } as Summary;
  });

export async function fetchRows(): Promise<Summary[]> {
  return toRows(await getDocs(sessionsRef()));
}

export function watchRows(onRows: (rows: Summary[]) => void, onError: (err: Error) => void): () => void {
  return onSnapshot(sessionsRef(), (snap) => onRows(toRows(snap)), onError);
}
