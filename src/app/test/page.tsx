"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { en } from "@/copy/en";
import { runBlock } from "@/engine/pvt";
import { measureRefresh } from "@/engine/refresh";
import type { Aborted, HzClass, Session } from "@/engine/types";
import { baselineClassOf } from "@/lib/time";
import { metrics } from "@/scoring/metrics";
import { score, type Result } from "@/scoring/verdict";
import {
  addSession,
  baselinesFor,
  compareCooldownMin,
  decideMode,
  detectOs,
  getDevice,
  getPending,
  getSessions,
  storageOk,
} from "@/storage/local";
import { enqueue } from "@/storage/upload";
import { Btn } from "../ui";

const LOW_HZ = 50;

type View =
  | { kind: "prep" }
  | { kind: "lowhz" }
  | { kind: "mismatch" }
  | { kind: "running" }
  | { kind: "overtime" }
  | { kind: "aborted"; reason: Exclude<Aborted, null> }
  | { kind: "saveFailed" };

export default function TestPage() {
  const router = useRouter();
  const elRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<AbortController | null>(null);
  const overtimeChoice = useRef<((keep: boolean) => void) | null>(null);
  // The view changes only between blocks. During a block React state is never touched:
  // the engine writes the number and the progress bar straight to the DOM.
  const [view, setView] = useState<View>({ kind: "prep" });

  const run = useCallback(
    async (allowLow: boolean) => {
      ctlRef.current?.abort();
      const ctl = new AbortController();
      ctlRef.current = ctl;
      const alive = () => !ctl.signal.aborted;

      const pending = storageOk() ? getPending() : null;
      if (!pending) {
        router.replace("/");
        return;
      }
      const device = getDevice();

      const { hz } = await measureRefresh(60);
      if (!alive()) return;
      if (hz < LOW_HZ && !allowLow) {
        setView({ kind: "lowhz" });
        return;
      }
      const hzClass: HzClass = hz < LOW_HZ ? "low" : "normal";
      const otherClass: HzClass = hzClass === "low" ? "normal" : "low";

      const sessions = getSessions();
      const lengthS = device.team ? 180 : 90;
      const now = new Date();
      const bases = baselinesFor(sessions, hzClass, lengthS);
      const mode = decideMode(now, sessions, hzClass) === "compare" && bases.length > 0 ? "compare" : "baseline";

      // A daytime record exists, but only under the other screen timing: do not compare across them.
      if (bases.length === 0 && baselinesFor(sessions, otherClass, lengthS).length > 0) {
        setView({ kind: "mismatch" });
        return;
      }
      if (mode === "compare" && (pending.prediction === null || compareCooldownMin(now, sessions) > 0)) {
        router.replace("/");
        return;
      }

      const el = elRef.current;
      const bar = barRef.current;
      if (!el || !bar) return;
      const labels = {
        tooEarly: en.test.tooEarly,
        missed: en.test.missed,
        practice: en.test.practice,
        begin: en.test.begin(lengthS),
      };
      const progress = (totalMs: number) => (ms: number) => {
        bar.style.width = `${(100 * ms) / totalMs}%`;
      };

      bar.style.width = "0%";
      setView({ kind: "running" });
      const block = await runBlock({
        el,
        lengthS,
        practice: 5,
        labels,
        onProgress: progress(lengthS * 1000),
        signal: ctl.signal,
      });
      if (!alive()) return;
      if (block.aborted) {
        setView({ kind: "aborted", reason: block.aborted });
        return;
      }

      let trials = block.trials;
      let overtime: Session["overtime"] = "none";
      let result: Result | null = null;
      let finalLengthS: 90 | 180 = lengthS;

      if (mode === "compare") {
        const baseTrials = bases.map((b) => b.trials);
        result = score(baseTrials, trials, device.team, false);
        if (!device.team && result.overtimeOffered) {
          setView({ kind: "overtime" });
          const keep = await new Promise<boolean>((resolve) => {
            overtimeChoice.current = resolve;
          });
          if (!alive()) return;
          overtime = "declined";
          if (keep) {
            bar.style.width = "0%";
            setView({ kind: "running" });
            const more = await runBlock({
              el,
              lengthS: 90,
              offsetMs: 90000,
              labels,
              onProgress: progress(90000),
              signal: ctl.signal,
            });
            if (!alive()) return;
            // An interrupted overtime keeps the valid first 90 seconds and counts as "stop here".
            if (!more.aborted) {
              const offset = trials.length;
              trials = [...trials, ...more.trials.map((t, j) => ({ ...t, i: offset + j }))];
              result = score(baseTrials, trials, false, true);
              overtime = "taken";
              finalLengthS = 180;
            }
          }
        }
      }

      const session: Session = {
        v: 1,
        id: crypto.randomUUID(),
        startedAt: block.startedAt,
        localHour: now.getHours(),
        mode,
        baselineClass: mode === "baseline" ? baselineClassOf(now.getHours()) : null,
        lengthS: finalLengthS,
        overtime,
        team: device.team,
        awakeH: pending.awakeH,
        prediction: mode === "compare" ? pending.prediction : null,
        caffeine: pending.caffeine,
        alcohol: pending.alcohol,
        justWoke: pending.justWoke,
        refreshHz: block.refreshHz,
        hzClass,
        os: detectOs(navigator.userAgent),
        trials,
        metrics: metrics(trials, finalLengthS * 1000),
        result,
        uploaded: false,
      };
      if (!addSession(session)) {
        setView({ kind: "saveFailed" });
        return;
      }
      enqueue(session);
      router.replace(mode === "baseline" ? "/saved" : "/result");
    },
    [router],
  );

  useEffect(() => {
    // Start on the next frame: under React strict mode the first mount is torn down at once.
    const id = requestAnimationFrame(() => run(false));
    return () => {
      cancelAnimationFrame(id);
      ctlRef.current?.abort();
    };
  }, [run]);

  const retry = (allowLow: boolean) => {
    setView({ kind: "prep" });
    run(allowLow);
  };

  const chooseOvertime = (keep: boolean) => {
    overtimeChoice.current?.(keep);
    overtimeChoice.current = null;
  };

  return (
    <>
      <div ref={elRef} className="pvt" data-state="idle" />
      <div ref={barRef} className="fixed left-0 top-0 z-[45] h-[3px] bg-accent" style={{ width: "0%" }} />

      {view.kind !== "running" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black px-6 text-center">
          {view.kind === "prep" && <p className="text-xl text-dim">{en.test.preparing}</p>}

          {view.kind === "lowhz" && (
            <>
              <p className="max-w-sm text-balance text-xl leading-relaxed">{en.test.lowPower}</p>
              <div className="flex w-full max-w-sm flex-col gap-3">
                <Btn tone="primary" onClick={() => retry(false)}>
                  {en.test.retry}
                </Btn>
                <Btn onClick={() => retry(true)}>{en.test.continueAnyway}</Btn>
              </div>
            </>
          )}

          {view.kind === "mismatch" && (
            <>
              <p className="max-w-sm text-balance text-xl leading-relaxed">{en.test.hzMismatch}</p>
              <Btn tone="primary" className="w-full max-w-sm" onClick={() => retry(false)}>
                {en.test.retry}
              </Btn>
            </>
          )}

          {view.kind === "overtime" && (
            <>
              <p className="max-w-sm text-balance text-xl leading-relaxed">{en.test.overtime}</p>
              <div className="flex w-full max-w-sm flex-col gap-3">
                <Btn tone="primary" onClick={() => chooseOvertime(true)}>
                  {en.test.keepGoing}
                </Btn>
                <Btn onClick={() => chooseOvertime(false)}>{en.test.stopHere}</Btn>
              </div>
            </>
          )}

          {view.kind === "aborted" && (
            <>
              <p className="max-w-sm text-balance text-xl leading-relaxed">{en.test.aborted[view.reason]}</p>
              <Btn tone="primary" className="w-full max-w-sm" onClick={() => retry(true)}>
                {en.test.startOver}
              </Btn>
            </>
          )}

          {view.kind === "saveFailed" && <p className="max-w-sm text-balance text-xl leading-relaxed text-alert">{en.test.saveFailed}</p>}
        </div>
      )}
    </>
  );
}
