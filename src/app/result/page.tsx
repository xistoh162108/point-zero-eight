"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { en } from "@/copy/en";
import type { Session } from "@/engine/types";
import { useIsClient } from "@/lib/client";
import { AWAKE_MAX_H, AWAKE_STEPS, awakeBand, awakePos, expectedPct, rulerPos, usualRangePct } from "@/lib/ruler";
import { metrics } from "@/scoring/metrics";
import type { Verdict } from "@/scoring/verdict";
import { getSessions, storageOk } from "@/storage/local";
import { baselineClassUsed, flush } from "@/storage/upload";
import { Mark, Page, linkClass } from "../ui";

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
  clear: { icon: "▲", box: "border-alert bg-[#1a0d09]", tone: "text-alert" },
  signs: { icon: "◆", box: "border-accent bg-[#17130a]", tone: "text-accent" },
  none: { icon: "○", box: "border-line bg-panel", tone: "text-dim" },
};

const SAME_MS = 15; // below this the road card says "about the same"
const label = "text-xs font-semibold uppercase tracking-[0.12em]";

// A label under or over a marker: centered on it, but kept inside the scale near the ends.
function anchor(pos: number): { left?: string; right?: string; transform?: string } {
  if (pos < 20) return { left: "0" };
  if (pos > 80) return { right: "0" };
  return { left: `${pos}%`, transform: "translateX(-50%)" };
}

// Measured scale: how far from daytime you. Gray band = usual range, triangle = expected, dot = measured.
function Ruler(props: { speedDeltaPct: number; prediction: 0 | 1 | 2 | null; rangePct: number }) {
  const { speedDeltaPct, prediction, rangePct } = props;
  const m = rulerPos(speedDeltaPct);
  const e = prediction === null ? null : rulerPos(expectedPct(prediction)).pos;
  const bandLeft = rulerPos(-rangePct).pos;
  const bandRight = rulerPos(rangePct).pos;
  const measuredText =
    (m.off === "left" ? en.result.ruler.offLeft : "") +
    en.result.ruler.measured(speedDeltaPct) +
    (m.off === "right" ? en.result.ruler.offRight : "");

  return (
    <figure
      role="img"
      aria-label={en.result.ruler.aria(rangePct, prediction === null ? 0 : expectedPct(prediction), speedDeltaPct)}
      className="flex flex-col gap-2"
    >
      <div className="relative h-[92px]">
        {e !== null && (
          <>
            <span className="absolute top-0 whitespace-nowrap text-xs text-dim" style={anchor(e)}>
              {en.result.ruler.expected}
            </span>
            <span
              className="absolute top-5 h-0 w-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-ink"
              style={{ left: `${e}%` }}
            />
          </>
        )}
        <div className="absolute inset-x-0 top-9 h-5 overflow-hidden rounded-full border border-line bg-[#161616]">
          <div
            className="absolute inset-y-0 bg-[#4a463e]"
            style={{ left: `${bandLeft}%`, width: `${bandRight - bandLeft}%` }}
          />
        </div>
        {e !== null && (
          <>
            <span className="absolute top-[30px] h-8 w-0.5 -translate-x-1/2 bg-ink" style={{ left: `${e}%` }} />
            <span
              className="absolute top-[45px] h-0.5"
              style={{
                left: `${Math.min(e, m.pos)}%`,
                width: `${Math.abs(m.pos - e)}%`,
                background: "repeating-linear-gradient(90deg, #ffb000 0 6px, transparent 6px 11px)",
              }}
            />
          </>
        )}
        <span
          className="absolute top-[35px] h-[22px] w-[22px] -translate-x-1/2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(255,176,0,0.22)]"
          style={{ left: `clamp(11px, ${m.pos}%, calc(100% - 11px))` }}
        />
        <span
          className="absolute top-[68px] whitespace-nowrap text-[13px] font-semibold text-accent"
          style={anchor(m.pos)}
        >
          {measuredText}
        </span>
      </div>
      <div className="relative h-4 text-[11px] text-mute max-[360px]:text-[10px]">
        {en.result.ruler.ticks.map((t, i) => (
          <span key={t} className="absolute whitespace-nowrap" style={anchor(i * 25)}>
            {t}
          </span>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-dim">
        <span className="h-3 w-5 rounded-sm bg-[#4a463e]" />
        {en.result.ruler.usualRange}
      </p>
    </figure>
  );
}

// Reference scale: the position comes from the hours entered and nothing else.
function AwakeAxis({ awakeH }: { awakeH: number }) {
  const pos = awakePos(awakeH);
  const edges = [0, ...AWAKE_STEPS, AWAKE_MAX_H];
  const fills = ["bg-[#1c1c1c]", "bg-[#2a3550]", "bg-[#3e5687]", "bg-[#6688c6]"];
  return (
    <figure role="img" aria-label={en.result.ref.aria(awakeH)}>
      <div className="relative h-[70px]">
        <span className="absolute top-0 whitespace-nowrap text-xs font-semibold text-ref" style={anchor(pos)}>
          {en.result.ref.hours(awakeH)}
        </span>
        <span
          className="absolute top-[18px] h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[8px] border-x-transparent border-t-ref"
          style={{ left: `clamp(6px, ${pos}%, calc(100% - 6px))` }}
        />
        <div className="absolute inset-x-0 top-[30px] flex h-3.5 gap-0.5 overflow-hidden rounded-full">
          {fills.map((f, i) => (
            <div key={f} className={f} style={{ width: `${((edges[i + 1] - edges[i]) / AWAKE_MAX_H) * 100}%` }} />
          ))}
        </div>
        {en.result.ref.ticks.map((t, i) => (
          <span
            key={t}
            className="absolute top-[52px] whitespace-nowrap text-[11px] text-mute"
            style={
              i === 0
                ? { left: "0" }
                : i === edges.length - 1
                  ? { right: "0" }
                  : { left: `${(edges[i] / AWAKE_MAX_H) * 100}%`, transform: "translateX(-50%)" }
            }
          >
            {t}
          </span>
        ))}
      </div>
    </figure>
  );
}

export default function ResultPage() {
  const isClient = useIsClient();
  const loaded = useMemo(() => (isClient ? load() : null), [isClient]);

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
  const look = VERDICT_LOOK[r.verdict];
  const time = new Date(s.startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const rangePct = usualRangePct(r.finalLengthS, s.team ? 180 : 90, r.k);
  const nowTypicalMs = metrics(s.trials, r.finalLengthS * 1000).typicalRtMs;
  const band = awakeBand(s.awakeH);
  const notes = [
    s.caffeine ? en.result.caffeine : null,
    s.alcohol ? en.result.alcohol : null,
    loaded.lateBaseline ? en.result.lateBaseline : null,
  ].filter((n): n is string => n !== null);

  return (
    <Page>
      <div className="flex items-center justify-between">
        <Mark />
        <span className="text-[13px] text-dim">{en.result.when(time, s.awakeH)}</span>
      </div>

      {/* Measured: everything here comes from this test and the daytime record. No blood alcohol number. */}
      <section aria-labelledby="measured-label" className="flex flex-col gap-[18px]">
        <p id="measured-label" className={`${label} text-dim`}>
          {en.result.measuredLabel}
        </p>

        <div className="flex flex-col gap-1.5">
          {s.prediction !== null && <p className="text-[17px] text-dim">{en.result.expected(s.prediction)}</p>}
          <h1 className="text-[34px] font-bold leading-[1.12] tracking-tight">{en.result.headline(r.speedDeltaPct)}</h1>
        </div>

        <Ruler speedDeltaPct={r.speedDeltaPct} prediction={s.prediction} rangePct={rangePct} />

        <div className={`flex gap-3 rounded-xl border-[1.5px] p-4 ${look.box}`}>
          <span aria-hidden className={`text-lg leading-6 ${look.tone}`}>
            {look.icon}
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-[17px] font-semibold leading-snug">{en.result.verdict[r.verdict]}</p>
            {r.verdict !== "none" && (
              <p className="text-[15px] leading-normal text-[#d9d5cc]">{en.result.cannotClear}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5">
            <span className="text-xs text-dim">{en.result.typicalLabel}</span>
            <span className="text-[22px] font-semibold leading-tight">{en.result.seconds(nowTypicalMs)}</span>
            <span className="text-xs text-dim">{en.result.typicalDaytime(nowTypicalMs - r.rtDeltaMs)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-line bg-panel p-3.5">
            <span className="text-xs text-dim">{en.result.roadLabel}</span>
            {r.rtDeltaMs < SAME_MS ? (
              <>
                <span className="text-[17px] font-semibold leading-tight">{en.result.roadSame}</span>
                <span className="text-xs text-dim">{en.result.roadSameSub}</span>
              </>
            ) : (
              <>
                <span className="text-[22px] font-semibold leading-tight">{en.result.roadValue(r.distanceFt)}</span>
                <span className="text-xs text-dim">{en.result.roadSub}</span>
              </>
            )}
          </div>
        </div>

        {notes.length > 0 && (
          <ul className="flex flex-col gap-1.5 text-[13px] leading-normal text-dim">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </section>

      <div role="separator" className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-mute">{en.result.divider}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Reference: other people's studies, placed by the hours entered. The test result plays no part. */}
      <section
        aria-labelledby="reference-label"
        className="flex flex-col gap-4 rounded-2xl border border-dashed border-[#3a3833] bg-[#0b0b0b] p-5"
      >
        <div className="flex flex-col gap-1.5">
          <p id="reference-label" className={`${label} text-ref`}>
            {en.result.ref.label}
          </p>
          <h2 className="text-xl font-semibold leading-[1.3]">{en.result.ref.title}</h2>
          <p className="text-sm leading-normal text-dim">{en.result.ref.intro}</p>
        </div>

        <AwakeAxis awakeH={s.awakeH} />

        {band === -1 ? (
          <p className="text-sm text-dim">{en.result.ref.below17}</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm leading-[1.45]">
            {en.result.ref.rows.map((row, i) => (
              <li
                key={row.from}
                className={`flex gap-2.5 ${i === band ? "-mx-2.5 rounded-lg bg-[#141a26] px-2.5 py-2 text-ink" : "text-dim"}`}
              >
                <span className={`w-[46px] flex-none ${i === band ? "font-semibold text-ref" : "text-[#c9c5bc]"}`}>
                  {row.from}
                </span>
                <span>{row.text}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs leading-normal text-mute">{en.result.ref.tail}</p>
      </section>

      <p className="text-xs leading-normal text-mute">{en.result.nature}</p>

      <Link
        href="/room"
        className="flex min-h-[52px] items-center justify-center rounded-xl bg-accent px-4 py-3 text-[17px] font-semibold text-black"
      >
        {en.result.seeRoom}
      </Link>
    </Page>
  );
}
