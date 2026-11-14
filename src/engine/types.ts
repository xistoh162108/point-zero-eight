import type { Metrics } from '../scoring/metrics';
import type { Result } from '../scoring/verdict';

export type TrialKind = 'ok' | 'lapse' | 'timeout' | 'false_start' | 'invalid';

export interface Trial {
  i: number; // sequence number, from 0
  isiMs: number; // interval drawn before this stimulus
  onsetMs: number | null; // stimulus onset since block start. null for a false start
  rtMs: number | null; // reaction time. null for a false start, 5000 for a timeout
  kind: TrialKind;
  frameMs: number; // frame interval of the frame that showed the stimulus
}

export type Aborted = null | 'hidden' | 'blur' | 'frames' | 'too_few' | 'early_taps';

export interface BlockResult {
  lengthS: number; // 30, 90, 180
  trials: Trial[];
  refreshHz: number;
  frameMedianMs: number;
  aborted: Aborted;
  startedAt: string; // ISO time
}

export type HzClass = 'normal' | 'low';
export type Os = 'ios' | 'android' | 'other';
export type BaselineClass = 'day' | 'evening' | 'late';
export type Prediction = 0 | 1 | 2;

export interface Session {
  v: 1;
  id: string;
  startedAt: string; // ISO time
  localHour: number; // 0-23
  mode: 'baseline' | 'compare';
  baselineClass: BaselineClass | null; // baseline sessions only
  lengthS: 90 | 180; // length actually measured. 180 after overtime
  overtime: 'none' | 'declined' | 'taken';
  team: boolean;
  awakeH: number;
  prediction: Prediction | null; // 0 same, 1 a bit slower, 2 much slower. null for a baseline
  caffeine: boolean;
  alcohol: boolean;
  justWoke: boolean;
  refreshHz: number;
  hzClass: HzClass;
  os: Os;
  trials: Trial[]; // practice is not stored
  metrics: Metrics;
  result: Result | null; // compare sessions only
  uploaded: boolean;
}
