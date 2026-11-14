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
