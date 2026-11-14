// Builds the summary document for a session and keeps a retry queue.
// The summary has nothing that links to a person or a device: no device id, no auth uid,
// no per-trial reaction times, no absolute daytime values.
import type { BaselineClass, HzClass, Os, Prediction, Session } from '../engine/types';
import { bucketOf, type Bucket } from '../lib/time';
import { baselinesFor, getSessions, KEYS, markUploaded } from './local';

export interface SummaryBody {
  v: 1;
  kind: 'baseline' | 'compare';
  bucket: Bucket;
  first: boolean; // first comparison this device sent in this bucket. The device decides
  team: boolean;
  lengthS: 90 | 180;
  overtime: 'none' | 'declined' | 'taken';
  awakeH: number;
  caffeine: boolean;
  alcohol: boolean;
  justWoke: boolean;
  hzClass: HzClass;
  refreshHz: number;
  os: Os;
  n: number; // valid stimuli
  // Values below exist for comparisons only; null for a daytime record.
  prediction: Prediction | null;
  baselineClass: BaselineClass | null;
  k: number | null;
  z: number | null;
  verdict: 'clear' | 'signs' | 'none' | null;
  speedDeltaPct: number | null;
  lapseDeltaPts: number | null;
  rtDeltaMs: number | null;
}

// As read back from the server. `at` is the server time as an ISO string.
export type Summary = SummaryBody & { at: string | null };

interface OutboxItem {
  sid: string; // local session id. Stays on the device
  summary: SummaryBody;
}

const round = (x: number, digits: number) => Number(x.toFixed(digits));

// Latest class among the daytime records a comparison used: late > evening > day.
export function baselineClassUsed(s: Session, all: Session[]): BaselineClass | null {
  const before = all.filter((b) => Date.parse(b.startedAt) < Date.parse(s.startedAt));
  const used = baselinesFor(before, s.hzClass, s.team ? 180 : 90);
  if (used.length === 0) return null;
  if (used.some((b) => b.baselineClass === 'late')) return 'late';
  if (used.some((b) => b.baselineClass === 'evening')) return 'evening';
  return 'day';
}

export function summaryOf(s: Session, all: Session[]): SummaryBody {
  const bucket = bucketOf(s.localHour);
  const isCompare = s.mode === 'compare' && s.result !== null;
  const earlierInBucket = all.some(
    (o) =>
      o.id !== s.id &&
      o.mode === 'compare' &&
      bucketOf(o.localHour) === bucket &&
      Date.parse(o.startedAt) < Date.parse(s.startedAt),
  );
  const r = s.result;
  return {
    v: 1,
    kind: s.mode,
    bucket,
    first: isCompare && !earlierInBucket,
    team: s.team,
    lengthS: s.lengthS,
    overtime: s.overtime,
    awakeH: s.awakeH,
    caffeine: s.caffeine,
    alcohol: s.alcohol,
    justWoke: s.justWoke,
    hzClass: s.hzClass,
    refreshHz: round(s.refreshHz, 1),
    os: s.os,
    n: s.metrics.n,
    prediction: isCompare ? s.prediction : null,
    baselineClass: isCompare ? baselineClassUsed(s, all) : null,
    k: r ? r.k : null,
    z: r ? round(r.z, 4) : null,
    verdict: r ? r.verdict : null,
    speedDeltaPct: r ? round(r.speedDeltaPct, 3) : null,
    lapseDeltaPts: r ? round(r.lapseDeltaPts, 3) : null,
    rtDeltaMs: r ? round(r.rtDeltaMs, 1) : null,
  };
}

function readOutbox(): OutboxItem[] {
  const raw = localStorage.getItem(KEYS.outbox);
  return raw === null ? [] : (JSON.parse(raw) as OutboxItem[]);
}

function writeOutbox(items: OutboxItem[]): void {
  try {
    localStorage.setItem(KEYS.outbox, JSON.stringify(items));
  } catch (err) {
    console.error('could not write outbox', err);
  }
}

// Put a finished session in the send queue. Does not touch the network.
export function enqueue(s: Session): void {
  const items = readOutbox().filter((i) => i.sid !== s.id);
  items.push({ sid: s.id, summary: summaryOf(s, getSessions()) });
  writeOutbox(items);
}

// Send one summary. On success the session is marked uploaded and leaves the queue.
export async function upload(sid: string, summary: SummaryBody): Promise<void> {
  const fb = await import('../lib/firebase');
  await fb.sendSummary(summary);
  markUploaded(sid);
  writeOutbox(readOutbox().filter((i) => i.sid !== sid));
}

let inflight: Promise<void> | null = null;

// Called on every page open: sends every session that is not uploaded yet.
// Daytime records taken before uploading existed go up this way.
export function flush(): Promise<void> {
  inflight ??= doFlush().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doFlush(): Promise<void> {
  const sessions = getSessions();
  const waiting = sessions.filter((s) => !s.uploaded);
  if (waiting.length === 0) return;
  const queued = new Map(readOutbox().map((i) => [i.sid, i.summary]));
  for (const s of waiting) {
    const summary = queued.get(s.id) ?? summaryOf(s, sessions);
    try {
      await upload(s.id, summary);
    } catch (err) {
      console.warn('summary upload failed, will retry on next page open', err);
      writeOutbox([...readOutbox().filter((i) => i.sid !== s.id), { sid: s.id, summary }]);
    }
  }
}
