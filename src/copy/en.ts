// Every string the app shows lives in this file.
// Rule: no wording that reads as permission. "fit to", "fine to" and "all-clear" appear only inside
// sentences that say what the test cannot tell you (`start.limit`, `result.cannotClear`, `result.verdict.none`).

export const sec = (ms: number) => (ms / 1000).toFixed(2);
const NB = '\u00a0'; // no-break space: a number never gets separated from its unit at a line end
const secs = (ms: number) => `${sec(ms)}${NB}s`;
const pct = (x: number) => Math.round(Math.abs(x));

export const PREDICTIONS = ['just as sharp', 'a bit slower', 'much slower'] as const;

export const en = {
  start: {
    stepBaseline: 'Step 1 of 2: record daytime you now. Come back after midnight to compare.',
    stepCompare: 'Step 2 of 2: compare with daytime you.',
    title: 'Are you as sharp as you think?',
    daytime: (typicalMs: number) => `Daytime you: typical reaction ${secs(typicalMs)}`,
    subtitle: (lengthS: number) => `A ${lengthS}-second reaction test. No install, no login.`,
    wakeLabel: 'What time did you wake up?',
    wakeHint: "Your last real sleep. Naps under an hour don't count.",
    wakeDays: { today: 'Today', yesterday: 'Yesterday' },
    wakeSummary: (h: number) => (h < 1 ? 'Awake less than an hour.' : `Awake about ${h}${NB}${h === 1 ? 'hour' : 'hours'}.`),
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
      `You compared less than 30 minutes ago. The next comparison opens in ${minutes}${NB}min.`,
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
      `Daytime you is saved. Typical reaction: ${secs(typicalMs)}.${fastestMs === null ? '' : ` Fastest: ${secs(fastestMs)}.`} Come back after midnight to see how you compare.`,
    second: "Second daytime record saved. Tonight's result will be steadier.",
    justWoke:
      `You said you just woke up, so we won't use this one as your daytime record. Try again in 30${NB}minutes.`,
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
        ? `Measured: about the same as daytime${NB}you.`
        : speedDeltaPct > 0
          ? `Measured: ${pct(speedDeltaPct)}% slower than daytime${NB}you.`
          : `Measured: ${pct(speedDeltaPct)}% faster than daytime${NB}you.`,
    verdict: {
      clear:
        "You're clearly slower than daytime you. Put off anything you can't undo, or get a second pair of eyes.",
      signs: "There are signs you're slower than daytime you. Get important things double-checked.",
      none: "This test didn't find evidence that you're slower. It can miss mild slowing, so this is not an all-clear.",
    },
    distanceSame: 'Your typical reaction was about as fast as in the daytime.',
    distanceSlower: (deltaMs: number, feet: number) =>
      `Your typical reaction was ${secs(deltaMs)} later than in the daytime. At 65${NB}mph, that is about ${Math.round(feet)}${NB}feet of road.`,
    distanceFaster: (deltaMs: number) =>
      `Your typical reaction was ${secs(Math.abs(deltaMs))} faster than in the daytime.`,
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
    seeRoom: 'See how the room compares',
    none: 'No comparison on this phone yet.',
    // Measured area
    when: (time: string, awakeH: number) => `${time} · ${awakeH}${NB}h awake`,
    measuredLabel: 'Measured · you vs daytime you',
    headline: (speedDeltaPct: number) =>
      Math.abs(speedDeltaPct) < 3
        ? `You're about the same as daytime${NB}you.`
        : speedDeltaPct > 0
          ? `You're ${pct(speedDeltaPct)}% slower than daytime${NB}you.`
          : `You're ${pct(speedDeltaPct)}% faster than daytime${NB}you.`,
    cannotClear: "This test can't tell you it's fine to drive.",
    ruler: {
      expected: 'expected',
      measured: (speedDeltaPct: number) =>
        Math.abs(speedDeltaPct) < 0.5
          ? 'measured 0%'
          : `measured ${pct(speedDeltaPct)}% ${speedDeltaPct > 0 ? 'slower' : 'faster'}`,
      offRight: ' →',
      offLeft: '← ',
      usualRange: 'your usual range',
      ticks: ['10% faster', '0', '10%', '20%', '30% slower'],
      aria: (rangePct: number, expectedPct: number, speedDeltaPct: number) =>
        `Speed change scale from 10 percent faster to 30 percent slower than your daytime record. ` +
        `Your usual range is about ${Math.round(rangePct)} percent either way. ` +
        `You expected ${expectedPct} percent slower. ` +
        `Measured: ${pct(speedDeltaPct)} percent ${speedDeltaPct < 0 ? 'faster' : 'slower'}.`,
    },
    typicalLabel: 'Typical reaction',
    typicalDaytime: (ms: number) => `daytime ${secs(ms)}`,
    seconds: (ms: number) => secs(ms),
    roadLabel: `At 65${NB}mph`,
    roadValue: (feet: number) => `+${Math.round(feet)}${NB}ft`,
    roadSub: 'of road before you react',
    roadSame: 'about the same',
    roadSameSub: 'as in the daytime',
    // Between the two areas
    divider: 'a different kind of number',
    // Reference area: tied to the hours entered only, never to the test
    ref: {
      label: 'Reference · not measured',
      title: 'What studies saw in other people awake this long',
      intro: "Based only on the hours you entered. Your test above doesn't change where you sit here.",
      hours: (h: number) => `${h}${NB}h`,
      ticks: ['0 h', '17', '21', '24', '28 h'],
      rows: [
        { from: '17 h+', text: 'performance like 0.05% blood alcohol' },
        { from: '21 h+', text: 'like 0.08% in one driving-simulator study' },
        { from: '24 h+', text: 'like 0.10% blood alcohol' },
      ],
      below17: `No study line below 17${NB}h.`,
      tail: "Group averages from published studies. 0.08 doesn't measure blood alcohol and can't convert your result into one.",
      aria: (h: number) =>
        `Hours awake scale from 0 to 28. From 17 hours, studies found performance like 0.05 percent blood alcohol. ` +
        `From 21 hours, one driving-simulator study found 0.08 percent. From 24 hours, 0.10 percent. You entered ${h} hours.`,
    },
  },
  room: {
    title: 'HackPrinceton, tonight',
    subtitle: "Each test compared with that person's own daytime record. Anonymous, exploratory.",
    daytimeRecords: 'daytime records',
    nightTests: 'night tests so far',
    byTime: 'Slower than daytime, by time',
    change: (mean: number) =>
      Math.abs(mean) < 0.5 ? 'about the same' : `${pct(mean)}% ${mean < 0 ? 'faster' : 'slower'}`,
    bucketDetail: (n: number, lo: number, hi: number) =>
      `${n} tests · 95%${NB}CI${NB}${Math.round(lo)}${NB}to${NB}${Math.round(hi)}`,
    collectingShort: 'collecting',
    moreToShow: (missing: number) => `${missing} more ${missing === 1 ? 'test' : 'tests'} to show an average`,
    dotsAria: (n: number) => `${n} of 5 tests needed before showing an average`,
    said: (p: 0 | 1 | 2) => `Said "${PREDICTIONS[p]}"`,
    measuredChange: (mean: number) =>
      Math.abs(mean) < 0.5 ? 'measured about the same' : `measured ${pct(mean)}% ${mean < 0 ? 'faster' : 'slower'}`,
    tests: (n: number) => `${n} tests`,
    collectingSoFar: (n: number) => `collecting, ${n} so far`,
    predictionNote: 'Line starts at 0% = same as daytime. Fewer than 5 tests: no average shown.',
    myResult: 'My result',
    bucketLabel: { '21-24': '9 PM – midnight', '00-03': 'Midnight – 3 AM', '03-06': '3 – 6 AM' } as Record<
      string,
      string
    >,
    predictionTitle: 'What people expected vs what we measured',
    refresh: 'Refresh',
    loading: 'Loading',
    offline: 'The room data is not reachable right now. Your own result is still on this phone.',
    footnote:
      'An observation of people who tested on this site, not proof of a cause. No individual results or rankings are shown.',
    adminCounts: (baseline: number, compare: number, usable: number) =>
      `Daytime records: ${baseline}. Comparisons: ${compare}. In the room numbers: ${usable}.`,
    downloadCsv: 'Download CSV',
  },
  demo: {
    intro: 'Try it: 30 seconds. Tap as soon as the number starts counting.',
    start: 'Start',
    begin: 'The test takes 30 seconds. Tap to begin.',
    result: (typicalMs: number, fastestMs: number, slowestMs: number, feet: number) =>
      `Typical reaction: ${secs(typicalMs)}. Fastest ${secs(fastestMs)}, slowest ${secs(slowestMs)}. That ${secs(slowestMs - fastestMs)} gap is about ${Math.round(feet)}${NB}feet of road at 65${NB}mph.`,
    resultTypicalOnly: (typicalMs: number) => `Typical reaction: ${secs(typicalMs)}.`,
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
