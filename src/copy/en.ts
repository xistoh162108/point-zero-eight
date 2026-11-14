// Every string the app shows lives in this file.
// Rule: no wording that reads as permission. The one "fit to" is in `start.limit`.

export const sec = (ms: number) => (ms / 1000).toFixed(2);
const pct = (x: number) => Math.round(Math.abs(x));

export const PREDICTIONS = ['just as sharp', 'a bit slower', 'much slower'] as const;

export const en = {
  start: {
    title: 'Are you as sharp as you think?',
    daytime: (typicalMs: number) => `Daytime you: typical reaction ${sec(typicalMs)} s`,
    subtitle: (lengthS: number) => `A ${lengthS}-second reaction test. No install, no login.`,
    awakeLabel: 'How many hours have you been awake?',
    awakeHint: "Count from your last real sleep. Naps under an hour don't count.",
    awakePlaceholder: 'Select hours',
    predictionLabel: 'Before we measure: compared with daytime you, right now you are',
    predictionButtons: ['Just as sharp', 'A bit slower', 'Much slower'],
    flags: {
      caffeine: 'Caffeine in the last 2 hours',
      alcohol: 'Alcohol today',
      justWoke: 'Woke up in the last 30 minutes',
    },
    startButton: 'Start',
    dnd: 'Please turn on Do Not Disturb for two minutes.',
    notice:
      'Anonymous and voluntary. Your reaction times stay on this phone. We upload only a summary: your change from your own daytime record, hours awake, and your answers on this screen. No name, no account, no device ID.',
    limit:
      'This is a hackathon project. It does not measure blood alcohol, and it does not tell you whether you are fit to drive or work.',
    storageBlocked: 'This browser is blocking storage. Open this page in Safari or Chrome, not in a private tab.',
    cooldown: (minutes: number) =>
      `You compared less than 30 minutes ago. The next comparison opens in ${minutes} min.`,
    lastResult: 'See your last result',
  },
  test: {
    preparing: 'Getting ready',
    lowPower: 'Low Power Mode makes the timing coarse. Turn it off for two minutes, then tap Retry.',
    retry: 'Retry',
    continueAnyway: 'Continue anyway',
    hzMismatch:
      'Your daytime record was taken with a different screen timing. Set Low Power Mode the way it was in the daytime, then tap Retry.',
    practice: 'Practice. Tap anywhere as soon as the number starts counting.',
    begin: (lengthS: number) => `The real test takes ${lengthS} seconds. Tap to begin.`,
    tooEarly: 'Too early',
    missed: 'Missed',
    overtime: 'Too close to call. 90 more seconds will settle it.',
    keepGoing: 'Keep going',
    stopHere: 'Stop here',
    aborted: {
      hidden: "That one got interrupted. Let's start over.",
      blur: "That one got interrupted. Let's start over.",
      frames: 'Your phone was too busy to time this well. Close other apps and try again.',
      too_few: "Not enough valid taps. Let's try again.",
      early_taps: "Wait for the number, then tap. Let's try again.",
    },
    startOver: 'Start over',
    saveFailed: 'Could not save this test on this phone. Free up storage and try again.',
  },
  saved: {
    first: (typicalMs: number, fastestMs: number | null) =>
      `Daytime you is saved. Typical reaction: ${sec(typicalMs)} s.${fastestMs === null ? '' : ` Fastest: ${sec(fastestMs)} s.`} Come back after midnight to see how you compare.`,
    second: "Second daytime record saved. Tonight's result will be steadier.",
    justWoke:
      "You said you just woke up, so we won't use this one as your daytime record. Try again in 30 minutes.",
    late: "This is your starting point. Come back in a few hours and we'll show the change since now.",
    sameBrowser: 'Open this page in this same browser tonight.',
    copyLink: 'Copy link',
    copied: 'Copied',
    none: 'No record on this phone yet.',
    toStart: 'Go to start',
  },
  result: {
    expected: (p: 0 | 1 | 2) => `You expected: ${PREDICTIONS[p]}.`,
    measured: (speedDeltaPct: number) =>
      Math.abs(speedDeltaPct) < 3
        ? 'Measured: about the same as daytime you.'
        : speedDeltaPct > 0
          ? `Measured: ${pct(speedDeltaPct)}% slower than daytime you.`
          : `Measured: ${pct(speedDeltaPct)}% faster than daytime you.`,
    verdict: {
      clear:
        "You're clearly slower than daytime you. Put off anything you can't undo, or get a second pair of eyes.",
      signs: "There are signs you're slower than daytime you. Get important things double-checked.",
      none: "This test didn't find evidence that you're slower. It can miss mild slowing, so this is not an all-clear.",
    },
    distanceSame: 'Your typical reaction was about as fast as in the daytime.',
    distanceSlower: (deltaMs: number, feet: number) =>
      `Your typical reaction was ${sec(deltaMs)} s later than in the daytime. At 65 mph, that is about ${Math.round(feet)} feet of road.`,
    distanceFaster: (deltaMs: number) =>
      `Your typical reaction was ${sec(Math.abs(deltaMs))} s faster than in the daytime.`,
    awake17: (h: number) =>
      `You've been awake about ${h} hours. In studies, people awake 17 to 19 hours performed about as slowly as people at a blood alcohol level of 0.05%.`,
    awake21: (h: number) =>
      `You've been awake about ${h} hours. In one driving-simulator study, 21 hours awake was about as impairing as a blood alcohol level of 0.08%.`,
    awake24: (h: number) =>
      `You've been awake about ${h} hours. In studies, about 24 hours awake was comparable to a blood alcohol level of 0.10%.`,
    awakeTag: 'From published studies of other people. Not a measurement of you.',
    nature:
      'Exploratory: a short test compared with your own daytime record. Not a medical or safety assessment.',
    caffeine: 'Caffeine can hide slowing for a while.',
    alcohol: "You said you had alcohol today. Don't drive, whatever this screen says.",
    lateBaseline: 'Your daytime record was taken late, so the real change may be larger.',
    seeRoom: 'See the room',
    none: 'No comparison on this phone yet.',
  },
  room: {
    title: 'This room tonight. Exploratory and anonymous.',
    bucketLabel: { '21-24': '9 PM to midnight', '00-03': 'Midnight to 3 AM', '03-06': '3 to 6 AM' } as Record<
      string,
      string
    >,
    bucketLine: (label: string, n: number, mean: number, lo: number, hi: number) =>
      `${label}: ${n} people, ${pct(mean)}% ${mean < 0 ? 'faster' : 'slower'} than their daytime selves on average (95% CI ${Math.round(lo)} to ${Math.round(hi)}).`,
    collecting: (label: string, n: number) => `${label}: collecting, ${n} so far.`,
    predictionTitle: 'What people expected, and what we measured',
    predictionLine: (p: 0 | 1 | 2, n: number, mean: number) =>
      Math.abs(mean) < 0.5
        ? `Said "${PREDICTIONS[p]}": ${n} tests, measured about the same on average.`
        : `Said "${PREDICTIONS[p]}": ${n} tests, measured ${pct(mean)}% ${mean < 0 ? 'faster' : 'slower'} on average.`,
    predictionCollecting: (p: 0 | 1 | 2, n: number) => `Said "${PREDICTIONS[p]}": collecting, ${n} so far.`,
    refresh: 'Refresh',
    loading: 'Loading',
    offline: 'The room data is not reachable right now. Your own result is still on this phone.',
    footnote:
      'Speed change compared with each person’s own daytime record. An observation of this room, not proof of a cause.',
    adminCounts: (baseline: number, compare: number, usable: number) =>
      `Daytime records: ${baseline}. Comparisons: ${compare}. In the room numbers: ${usable}.`,
    downloadCsv: 'Download CSV',
    back: 'Back to start',
  },
  demo: {
    intro: 'Try it: 30 seconds. Tap as soon as the number starts counting.',
    start: 'Start',
    begin: 'The test takes 30 seconds. Tap to begin.',
    result: (typicalMs: number, fastestMs: number, slowestMs: number, feet: number) =>
      `Typical reaction: ${sec(typicalMs)} s. Fastest ${sec(fastestMs)} s, slowest ${sec(slowestMs)} s. That ${sec(slowestMs - fastestMs)} s gap is about ${Math.round(feet)} feet of road at 65 mph.`,
    resultTypicalOnly: (typicalMs: number) => `Typical reaction: ${sec(typicalMs)} s.`,
    note: 'A real result compares you with your own daytime record.',
    again: 'Try again',
    seeRoom: 'See the room',
  },
  exportPage: {
    title: 'Export records from this phone',
    count: (n: number) => `${n} sessions on this device.`,
    copy: 'Copy JSON',
    copied: 'Copied',
    download: 'Download JSON',
  },
};
