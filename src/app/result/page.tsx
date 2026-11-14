"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { en } from "@/copy/en";
import type { Session } from "@/engine/types";
import { awakeLine, distanceLine, predictionLine } from "@/scoring/lines";
import type { Verdict } from "@/scoring/verdict";
import { getSessions, storageOk } from "@/storage/local";
import { baselineClassUsed, flush } from "@/storage/upload";
import { Mark, Page, linkClass } from "../ui";
import { useIsClient } from "@/lib/client";

interface Loaded {
  session: Session | null;
  lateBaseline: boolean;
}

function load(): Loaded {
  if (!storageOk()) return { session: null, lateBaseline: false };
  const sessions = getSessions();
  const compares = sessions.filter((s) => s.mode === "compare" && s.result !== null);
  const session = compares[compares.length - 1] ?? null;
  const cls = session ? baselineClassUsed(session, sessions) : null;
  return { session, lateBaseline: cls === "evening" || cls === "late" };
}

// The verdict is told three ways at once: color, icon and words.
const VERDICT_LOOK: Record<Verdict, { icon: string; box: string; tone: string }> = {
  clear: { icon: "▲", box: "border-alert", tone: "text-alert" },
  signs: { icon: "◆", box: "border-accent", tone: "text-accent" },
  none: { icon: "○", box: "border-line", tone: "text-dim" },
};

export default function ResultPage() {
  const mounted = useIsClient();
  const loaded = useMemo(() => (mounted ? load() : null), [mounted]);

  useEffect(() => {
    flush().catch((err) => console.warn("flush failed", err));
  }, []);

  if (!loaded) return <Page>{null}</Page>;
  const s = loaded.session;
  if (!s || !s.result) {
    return (
      <Page>
        <Mark />
        <p className="text-xl">{en.result.none}</p>
        <Link href="/" className={linkClass}>
          {en.saved.toStart}
        </Link>
      </Page>
    );
  }

  const r = s.result;
  const lines = predictionLine(s.prediction ?? 0, r.verdict, r.speedDeltaPct);
  const look = VERDICT_LOOK[r.verdict];
  const awake = awakeLine(s.awakeH);
  const notes = [
    s.caffeine ? en.result.caffeine : null,
    s.alcohol ? en.result.alcohol : null,
    loaded.lateBaseline ? en.result.lateBaseline : null,
  ].filter((n): n is string => n !== null);

  return (
    <Page>
      <Mark />

      <section className="flex flex-col gap-1">
        {s.prediction !== null && <p className="text-lg text-dim">{lines.expected}</p>}
        <p className="text-3xl font-semibold leading-tight tracking-tight">{lines.measured}</p>
      </section>

      <section className={`flex gap-3 rounded-lg border-2 bg-panel p-4 ${look.box}`}>
        <span aria-hidden className={`text-xl leading-7 ${look.tone}`}>
          {look.icon}
        </span>
        <p className="text-lg leading-7">{en.result.verdict[r.verdict]}</p>
      </section>

      <p className="text-lg leading-relaxed">{distanceLine(r.rtDeltaMs)}</p>

      {awake && (
        <section className="flex flex-col gap-2 border-l-2 border-line pl-4">
          <p className="leading-relaxed">{awake}</p>
          <p className="text-sm text-dim">{en.result.awakeTag}</p>
        </section>
      )}

      <p className="text-sm leading-relaxed text-dim">{en.result.nature}</p>

      {notes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li key={n} className="rounded-lg border border-line p-3 text-sm leading-relaxed">
              {n}
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/room"
        className="flex min-h-12 items-center justify-center rounded-lg bg-accent px-4 py-3 text-lg font-medium text-black"
      >
        {en.result.seeRoom}
      </Link>
    </Page>
  );
}
