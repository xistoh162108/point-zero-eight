// Reaction test engine. Knows nothing about React: it takes one element,
// changes only its text (and a data-state attribute for styling), and returns the trials.
import { median } from './refresh';
import type { Aborted, BlockResult, Trial, TrialKind } from './types';

export const ISI_MIN_MS = 1000;
export const ISI_MAX_MS = 4000;
export const FEEDBACK_MS = 1000;
export const FEEDBACK_GAP_MS = 200; // feedback is cleared at least this long before the next stimulus
export const MIN_VALID_MS = 100;
export const LAPSE_MS = 355;
export const TIMEOUT_MS = 5000;
export const FRAME_DROP_RATIO = 1.5;
export const MAX_INVALID_SHARE = 0.1;
export const MAX_EARLY_SHARE = 0.3;
export const MIN_VALID_TRIALS: Record<number, number> = { 30: 5, 90: 15, 180: 30 };
const READY_DELAY_MS = 800; // last practice time stays on screen this long
const READY_GUARD_MS = 300; // taps this soon after the "tap to begin" text are ignored

export interface PvtLabels {
  tooEarly: string;
  missed: string;
  practice: string; // shown until the first practice stimulus
  begin: string; // shown after practice; a tap starts the timed block
}

export interface PvtOptions {
  el: HTMLElement; // full-screen element. The engine only changes its text
  lengthS: number; // length of this block
  offsetMs?: number; // 90000 for overtime. Added to onsetMs
  practice?: number; // practice trials. Not recorded
  onProgress?: (elapsedMs: number) => void; // once per second
  labels?: Partial<PvtLabels>;
  signal?: AbortSignal; // lets the page stop the block when it unmounts
}

type Phase = 'practice' | 'ready' | 'block';

export function runBlock(opts: PvtOptions): Promise<BlockResult> {
  return new Promise((resolve) => {
    const { el } = opts;
    const lengthMs = opts.lengthS * 1000;
    const offsetMs = opts.offsetMs ?? 0;
    const labels: PvtLabels = {
      tooEarly: 'Too early',
      missed: 'Missed',
      practice: 'Practice',
      begin: 'Tap to begin',
      ...opts.labels,
    };
    const startedAt = new Date().toISOString();

    let practiceLeft = opts.practice ?? 0;
    let phase: Phase = practiceLeft > 0 ? 'practice' : 'block';
    const trials: Trial[] = [];
    const frameDeltas: number[] = [];

    let t0 = 0; // start of the timed block
    let isiMs = 0; // interval drawn for the next stimulus
    let dueAt = 0; // when the next stimulus should appear
    let stimAt: number | null = null; // onset of the stimulus on screen
    let stimFrameMs = 0;
    let clearAt: number | null = null; // when to wipe the feedback text
    let readyAt = 0;
    let readyShownAt: number | null = null;
    let fingers = 0;
    let prevFrame: number | null = null;
    let lastProgressS = -1;
    let raf = 0;
    let done = false;
    let trustEventTime: boolean | null = null;
    let wakeLock: WakeLockSentinel | null = null;

    const show = (text: string, state: 'idle' | 'stim' | 'feedback' | 'message') => {
      el.textContent = text;
      el.dataset.state = state;
    };

    const schedule = (from: number) => {
      isiMs = ISI_MIN_MS + Math.random() * (ISI_MAX_MS - ISI_MIN_MS);
      dueAt = from + isiMs;
    };

    // After a response, a timeout or a false start: draw a new interval counted from that moment.
    const next = (from: number) => {
      stimAt = null;
      schedule(from);
      clearAt = Math.min(from + FEEDBACK_MS, dueAt - FEEDBACK_GAP_MS);
    };

    const startBlock = (now: number) => {
      phase = 'block';
      t0 = now;
      stimAt = null;
      clearAt = null;
      show('', 'idle');
      schedule(now);
    };

    const record = (kind: TrialKind, rtMs: number | null, now: number) => {
      if (phase === 'practice') {
        if (kind !== 'false_start') {
          practiceLeft -= 1;
          if (practiceLeft <= 0) {
            phase = 'ready';
            readyAt = now + READY_DELAY_MS;
            readyShownAt = null;
          }
        }
        return;
      }
      trials.push({
        i: trials.length,
        isiMs,
        onsetMs: kind === 'false_start' || stimAt === null ? null : stimAt - t0 + offsetMs,
        rtMs,
        kind,
        frameMs: stimFrameMs,
      });
    };

    const frame = (ts: number) => {
      if (done) return;
      const delta = prevFrame === null ? 0 : ts - prevFrame;
      prevFrame = ts;

      if (phase === 'ready') {
        if (readyShownAt === null && ts >= readyAt) {
          show(labels.begin, 'message');
          readyShownAt = ts;
        }
      } else {
        if (phase === 'block') {
          if (delta > 0) frameDeltas.push(delta);
          const s = Math.floor((ts - t0) / 1000);
          if (s !== lastProgressS) {
            lastProgressS = s;
            opts.onProgress?.(Math.min(ts - t0, lengthMs));
          }
        }
        if (stimAt === null) {
          if (clearAt !== null && ts >= clearAt) {
            show('', 'idle');
            clearAt = null;
          }
          // No new stimulus after the block length. One already on screen is still taken.
          if (phase === 'block' && ts - t0 >= lengthMs) {
            finish(null);
            return;
          }
          if (ts >= dueAt && fingers === 0) {
            stimAt = ts;
            stimFrameMs = delta;
            clearAt = null;
            show('0', 'stim');
          }
        } else {
          const elapsed = ts - stimAt;
          if (elapsed >= TIMEOUT_MS) {
            const at = stimAt + TIMEOUT_MS;
            record('timeout', TIMEOUT_MS, at);
            show(labels.missed, 'feedback');
            if ((phase as Phase) !== 'ready') next(at);
            else stimAt = null;
          } else {
            show(String(Math.round(elapsed)), 'stim');
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const onDown = (t: number) => {
      if (done) return;
      if (phase === 'ready') {
        if (readyShownAt !== null && t - readyShownAt >= READY_GUARD_MS) startBlock(performance.now());
        return;
      }
      if (stimAt !== null) {
        const rt = t - stimAt;
        if (rt < MIN_VALID_MS) {
          record('false_start', null, t);
          show(labels.tooEarly, 'feedback');
        } else {
          record(rt >= LAPSE_MS ? 'lapse' : 'ok', rt, t);
          show(String(Math.round(rt)), 'feedback');
        }
      } else {
        record('false_start', null, t);
        show(labels.tooEarly, 'feedback');
      }
      if ((phase as Phase) === 'ready') stimAt = null;
      else next(t);
    };

    // Event timestamps are on the performance.now() clock in current browsers. Check once;
    // if they are not, read the clock inside the handler instead.
    const eventTime = (e: Event) => {
      const now = performance.now();
      if (trustEventTime === null) trustEventTime = Math.abs(now - e.timeStamp) < 50;
      return trustEventTime ? e.timeStamp : now;
    };

    const onPointerDown = (e: PointerEvent) => {
      fingers += 1;
      onDown(eventTime(e));
    };
    const onPointerUp = () => {
      fingers = Math.max(0, fingers - 1);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      onDown(eventTime(e));
    };
    const onVisibility = () => {
      if (document.hidden) finish('hidden');
    };
    const onBlur = () => finish('blur');
    const onSignal = () => finish('hidden');
    const onContextMenu = (e: Event) => e.preventDefault();

    function finish(reason: Aborted) {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      opts.signal?.removeEventListener('abort', onSignal);
      wakeLock?.release().catch((err) => console.warn('wake lock release failed', err));
      show('', 'idle');

      const frameMedianMs = median(frameDeltas);
      for (const t of trials) {
        if (t.onsetMs !== null && t.kind !== 'false_start' && t.frameMs > FRAME_DROP_RATIO * frameMedianMs) {
          t.kind = 'invalid';
        }
      }

      let aborted = reason;
      if (aborted === null) {
        const shown = trials.filter((t) => t.onsetMs !== null).length;
        const invalid = trials.filter((t) => t.kind === 'invalid').length;
        const early = trials.filter((t) => t.kind === 'false_start').length;
        const valid = shown - invalid;
        const minValid = MIN_VALID_TRIALS[opts.lengthS] ?? Math.round(opts.lengthS / 6);
        if (shown > 0 && invalid / shown > MAX_INVALID_SHARE) aborted = 'frames';
        else if (trials.length > 0 && early / trials.length > MAX_EARLY_SHARE) aborted = 'early_taps';
        else if (valid < minValid) aborted = 'too_few';
      }

      resolve({
        lengthS: opts.lengthS,
        trials,
        refreshHz: 1000 / frameMedianMs,
        frameMedianMs,
        aborted,
        startedAt,
      });
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    opts.signal?.addEventListener('abort', onSignal);

    if ('wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          if (done) lock.release().catch((err) => console.warn('wake lock release failed', err));
          else wakeLock = lock;
        })
        .catch((err) => console.warn('wake lock unavailable', err));
    }

    const now = performance.now();
    if (phase === 'practice') {
      show(labels.practice, 'message');
      schedule(now);
    } else {
      startBlock(now);
    }
    raf = requestAnimationFrame(frame);
  });
}
