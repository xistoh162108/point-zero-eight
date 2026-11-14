"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { en } from "@/copy/en";
import type { Prediction } from "@/engine/types";
import { baselineOf } from "@/scoring/metrics";
import {
  baselinesFor,
  compareCooldownMin,
  decideMode,
  getDevice,
  getSessions,
  setPending,
  storageOk,
} from "@/storage/local";
import { flush } from "@/storage/upload";
import { Btn, Mark, Page, linkClass } from "./ui";
import { useIsClient } from "@/lib/client";

interface Ready {
  storage: boolean;
  team: boolean;
  mode: "baseline" | "compare";
  cooldownMin: number;
  dayTypicalMs: number | null;
  hasResult: boolean;
}

function load(): Ready {
  if (!storageOk()) {
    return { storage: false, team: false, mode: "baseline", cooldownMin: 0, dayTypicalMs: null, hasResult: false };
  }
  const device = getDevice();
  const sessions = getSessions();
  const now = new Date();
  const lengthS = device.team ? 180 : 90;
  // The screen timing class is only known after the test screen measures it,
  // so ask the prediction if either class would be a comparison.
  const cls = (["normal", "low"] as const).find((c) => decideMode(now, sessions, c) === "compare");
  const bases = cls ? baselinesFor(sessions, cls, lengthS) : [];
  const mode = cls && bases.length > 0 ? "compare" : "baseline";
  return {
    storage: true,
    team: device.team,
    mode,
    cooldownMin: mode === "compare" ? compareCooldownMin(now, sessions) : 0,
    // Recomputed from the stored trials, the same way a comparison will use them.
    dayTypicalMs: bases.length ? baselineOf(bases.map((b) => b.trials), lengthS * 1000).typicalRtMs : null,
    hasResult: sessions.some((s) => s.mode === "compare"),
  };
}

const HOURS = Array.from({ length: 48 }, (_, i) => i + 1);
const FLAGS = ["caffeine", "alcohol", "justWoke"] as const;

export default function StartPage() {
  const router = useRouter();
  const mounted = useIsClient();
  const ready = useMemo(() => (mounted ? load() : null), [mounted]);
  const [awakeH, setAwakeH] = useState<number | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [flags, setFlags] = useState({ caffeine: false, alcohol: false, justWoke: false });

  useEffect(() => {
    if (ready?.storage) flush().catch((err) => console.warn("flush failed", err));
  }, [ready]);

  if (!ready) return <Page>{null}</Page>;

  const compare = ready.mode === "compare";
  const blocked = !ready.storage || ready.cooldownMin > 0;
  const canStart = !blocked && awakeH !== null && (!compare || prediction !== null);

  const start = () => {
    if (!canStart || awakeH === null) return;
    setPending({ awakeH, prediction: compare ? prediction : null, ...flags });
    router.push("/test");
  };

  return (
    <Page>
      <header className="flex flex-col gap-3">
        <Mark />
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">{en.start.title}</h1>
        {compare && ready.dayTypicalMs !== null && (
          <p className="text-balance text-accent">{en.start.daytime(ready.dayTypicalMs)}</p>
        )}
        <p className="text-dim">{en.start.subtitle(ready.team ? 180 : 90)}</p>
      </header>

      {!ready.storage && <p className="rounded-lg border border-alert p-4 text-alert">{en.start.storageBlocked}</p>}

      {ready.cooldownMin > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
          <p>{en.start.cooldown(ready.cooldownMin)}</p>
          <Link href="/result" className={linkClass}>
            {en.start.lastResult}
          </Link>
        </div>
      )}

      {!blocked && (
        <>
          <label className="flex flex-col gap-2">
            <span className="font-medium">{en.start.awakeLabel}</span>
            <select
              className="min-h-12 rounded-lg border border-line bg-panel px-3 text-base text-ink"
              value={awakeH ?? ""}
              onChange={(e) => setAwakeH(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">{en.start.awakePlaceholder}</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-sm text-dim">{en.start.awakeHint}</span>
          </label>

          {compare && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-medium">{en.start.predictionLabel}</legend>
              {en.start.predictionButtons.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={prediction === i}
                  onClick={() => setPrediction(i as Prediction)}
                  className={`min-h-12 rounded-lg border px-4 py-3 text-left text-base ${
                    prediction === i ? "border-accent bg-accent text-black" : "border-line bg-panel text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          )}

          <div className="flex flex-col gap-2">
            {FLAGS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={flags[f]}
                onClick={() => setFlags((v) => ({ ...v, [f]: !v[f] }))}
                className={`flex min-h-12 items-center justify-between rounded-lg border px-4 py-3 text-left text-base ${
                  flags[f] ? "border-accent text-ink" : "border-line text-dim"
                }`}
              >
                <span>{en.start.flags[f]}</span>
                <span
                  aria-hidden
                  className={`ml-3 h-5 w-5 shrink-0 rounded-full border ${
                    flags[f] ? "border-accent bg-accent" : "border-faint"
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm text-dim">{en.start.dnd}</p>
            <Btn tone="primary" disabled={!canStart} onClick={start} className="text-lg">
              {en.start.startButton}
            </Btn>
          </div>
        </>
      )}

      <footer className="mt-auto flex flex-col gap-3 border-t border-line pt-5 text-sm leading-relaxed text-dim">
        <p>{en.start.notice}</p>
        <p className="text-ink">{en.start.limit}</p>
      </footer>
    </Page>
  );
}
