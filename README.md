# 0.08

**Are you as sharp as you think?** A 90-second reaction test in the browser that sets what you
expect against what we measure. The comparison is with your own daytime record, not with other people.

Built at HackPrinceton, November 14-15, 2026. Track: Healthcare.

This is a hackathon project. It does not measure blood alcohol, and it does not tell you whether
you are fit to drive or work.

## How it works

1. **Daytime record.** In the afternoon you take the test once or twice. The record stays on your phone.
2. **Prediction.** At night, before the test, you say how sharp you think you are compared with daytime you.
3. **Measurement.** You take the same test again.
4. **Comparison.** The result screen puts your prediction next to the measured change in reaction speed.
5. **The room.** An anonymous summary goes to a shared screen: how much the room slowed down overnight,
   and how well people's predictions matched.

## Run it

```
npm i
npm run dev
npm test
```

Firebase settings go in `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_EVENT_ID=hp26f
```

Without them the test and the result still work; only the room screen has no data.

## Frameworks and libraries

- Next.js (App Router), React, TypeScript
- Tailwind CSS
- Firebase: anonymous Authentication and Firestore. No server code, no Cloud Functions
- Vitest
- Analysis: Python with pandas, NumPy, SciPy, Matplotlib

## What we built

| Part | Where |
| --- | --- |
| Test engine: stimulus timing on animation frames, touch input, interruption and frame-drop checks | `src/engine/` |
| Scoring: speed and lapse metrics, z against your own daytime record, verdict and overtime rule | `src/scoring/` |
| Device storage and the upload queue | `src/storage/` |
| Room statistics | `src/lib/room.ts` |
| Screens | `src/app/` |
| Every string on screen | `src/copy/en.ts` |
| Firestore security rules | `firestore.rules` |
| Analysis script | `analysis/analyze.py` |

## Data handling

- Reaction times stay on the phone, in `localStorage`.
- The server gets one summary per test: the change from your own daytime record, hours awake, and the
  answers on the start screen. No name, no account, no device ID, no per-trial reaction times.
- Summaries can be created but not changed or deleted. Rows read back are checked field by field.

## Limits

- The room data is an exploratory observation. It cannot show what caused a change.
- The verdict thresholds come from a simulation over assumed distributions. They were fixed before
  the event and were not tuned on participants. We do not know their real error rates.
- The 90-second length is not a validated test. The validated short form is 3 minutes, which is why
  an unclear result offers 90 more seconds and why the team measured itself at 3 minutes.
- The sentences about blood alcohol quote published studies of other people. They are not a
  measurement of the person taking the test.
- This is not a medical or safety assessment.

## Results

Filled in after the data closes at 5:30 AM on Sunday: tables 1 and 2 and figures 1 and 2 from `analysis/`.
