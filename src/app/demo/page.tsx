"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { en } from "@/copy/en";
import { runBlock } from "@/engine/pvt";
import type { Aborted } from "@/engine/types";
import { FT_PER_S_AT_65MPH } from "@/scoring/constants";
import { metrics, type Metrics } from "@/scoring/metrics";
import { Btn, Mark, Page } from "../ui";

const LENGTH_S = 30;

type View =
  | { kind: "intro" }
  | { kind: "running" }
  | { kind: "done"; m: Metrics }
  | { kind: "aborted"; reason: Exclude<Aborted, null> };

// 30-second try-out for judges. Nothing is stored and nothing is uploaded.
export default function DemoPage() {
  const elRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const ctlRef = useRef<AbortController | null>(null);
  const [view, setView] = useState<View>({ kind: "intro" });

  useEffect(() => () => ctlRef.current?.abort(), []);

  const start = async () => {
    const el = elRef.current;
    const bar = barRef.current;
    if (!el || !bar) return;
    const ctl = new AbortController();
    ctlRef.current = ctl;
    bar.style.width = "0%";
    setView({ kind: "running" });
    const block = await runBlock({
      el,
      lengthS: LENGTH_S,
      practice: 2,
      labels: { tooEarly: en.test.tooEarly, missed: en.test.missed, practice: en.test.practice, begin: en.demo.begin },
      onProgress: (ms) => {
        bar.style.width = `${(100 * ms) / (LENGTH_S * 1000)}%`;
      },
      signal: ctl.signal,
    });
    if (ctl.signal.aborted) return;
    if (block.aborted) setView({ kind: "aborted", reason: block.aborted });
    else setView({ kind: "done", m: metrics(block.trials, LENGTH_S * 1000) });
  };

  return (
    <>
      <div ref={elRef} className="pvt" data-state="idle" />
      <div ref={barRef} className="fixed left-0 top-0 z-[45] h-[3px] bg-accent" style={{ width: "0%" }} />

      {view.kind !== "running" && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-black">
          <Page>
            <Mark />
            {view.kind === "intro" && (
              <>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight">{en.demo.intro}</h1>
                <Btn tone="primary" className="text-lg" onClick={start}>
                  {en.demo.start}
                </Btn>
              </>
            )}

            {view.kind === "aborted" && (
              <>
                <p className="text-balance text-xl leading-relaxed">{en.test.aborted[view.reason]}</p>
                <Btn tone="primary" onClick={start}>
                  {en.demo.again}
                </Btn>
              </>
            )}

            {view.kind === "done" && (
              <>
                <p className="text-balance text-2xl font-medium leading-snug">
                  {view.m.fastestMs === null || view.m.slowestMs === null
                    ? en.demo.resultTypicalOnly(view.m.typicalRtMs)
                    : en.demo.result(
                        view.m.typicalRtMs,
                        view.m.fastestMs,
                        view.m.slowestMs,
                        ((view.m.slowestMs - view.m.fastestMs) / 1000) * FT_PER_S_AT_65MPH,
                      )}
                </p>
                <p className="text-dim">{en.demo.note}</p>
                <p className="text-sm leading-relaxed text-dim">{en.start.limit}</p>
                <div className="flex flex-col gap-3">
                  <Link
                    href="/room"
                    className="flex min-h-12 items-center justify-center rounded-lg bg-accent px-4 py-3 text-lg font-medium text-black"
                  >
                    {en.demo.seeRoom}
                  </Link>
                  <Btn onClick={start}>{en.demo.again}</Btn>
                </div>
              </>
            )}
          </Page>
        </div>
      )}
    </>
  );
}
