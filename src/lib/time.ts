import type { BaselineClass } from '../engine/types';

export type Bucket = 'day' | 'evening' | '21-24' | '00-03' | '03-06' | '06-09' | 'other';

// Time-of-day bucket of a summary, from the device's local hour.
export function bucketOf(hour: number): Bucket {
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'evening';
  if (hour >= 21) return '21-24';
  if (hour < 3) return '00-03';
  if (hour < 6) return '03-06';
  if (hour < 9) return '06-09';
  return 'other';
}

// When a daytime record was taken: 12-18 day, 18-22 evening, otherwise late.
export function baselineClassOf(hour: number): BaselineClass {
  if (hour >= 12 && hour < 18) return 'day';
  if (hour >= 18 && hour < 22) return 'evening';
  return 'late';
}

export type WakeDay = 'today' | 'yesterday';

// Whole hours awake, from the wake-up time the person typed ("HH:MM", local time).
// A time that is still ahead today can only mean yesterday.
export function hoursAwake(wake: string, day: WakeDay, now: Date): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(wake);
  if (!m) return null;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Number(m[1]), Number(m[2]));
  if (day === 'yesterday' || t.getTime() > now.getTime()) t.setDate(t.getDate() - 1);
  return Math.round((now.getTime() - t.getTime()) / 3_600_000);
}

// True when the typed time has not happened yet today, so "today" is not a possible answer.
export function wakeIsAhead(wake: string, now: Date): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(wake);
  if (!m) return false;
  return Number(m[1]) * 60 + Number(m[2]) > now.getHours() * 60 + now.getMinutes();
}
