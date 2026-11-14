"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { en } from "@/copy/en";
import { MIN_N, bucketStats, predictionStats, toCsv, usable } from "@/lib/room";
import { KEYS } from "@/storage/local";
import type { Summary } from "@/storage/upload";
import { Btn, Mark, Page } from "../ui";
import { useIsClient } from "@/lib/client";

const CACHE_MS = 2 * 60 * 1000; // raise to 5 minutes if Firestore reads pass half the daily quota
const BAR_FULL_PCT = 30; // bars run from 0 to a 30% change
const barWidth = (mean: number) => Math.min(100, (Math.max(0, mean) / BAR_FULL_PCT) * 100);

type Mode = "phone" | "screen" | "admin";

function readCache(): Summary[] | null {
  try {
    const raw = localStorage.getItem(KEYS.roomcache);
    if (!raw) return null;
    const c = JSON.parse(raw) as { at: number; rows: Summary[] };
    return Date.now() - c.at < CACHE_MS ? c.rows : null;
  } catch (err) {
    console.warn("room cache unreadable", err);
    return null;
  }
}

function writeCache(rows: Summary[]) {
  try {
    localStorage.setItem(KEYS.roomcache, JSON.stringify({ at: Date.now(), rows }));
  } catch (err) {
    console.warn("room cache not written", err);
  }
}

export default function RoomPage() {
  const mounted = useIsClient();
  const mode = useMemo<Mode | null>(() => {
    if (!mounted) return null;
    const q = new URLSearchParams(window.location.search);
    return q.get("screen") === "1" ? "screen" : q.get("admin") === "1" ? "admin" : "phone";
  }, [mounted]);
  // Phones reuse a read for two minutes to stay inside the free Firestore quota.
  const cached = useMemo(() => (mode === "phone" ? readCache() : null), [mode]);
  const [fetched, setFetched] = useState<Summary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const rows = fetched ?? cached;

  const fetchOnce = useCallback(async () => {
    try {
      const fb = await import("@/lib/firebase");
      const fresh = await fb.fetchRows();
      writeCache(fresh);
      setFetched(fresh);
      setFailed(false);
    } catch (err) {
      console.warn("room read failed", err);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (!mode) return;
    if (mode !== "screen") {
      if (cached) return;
      const id = setTimeout(fetchOnce, 0);
      return () => clearTimeout(id);
    }
    // Only the team's big screen subscribes live.
    let stop: (() => void) | undefined;
    let cancelled = false;
    import("@/lib/firebase")
      .then((fb) => {
        if (cancelled) return;
        stop = fb.watchRows(setFetched, (err) => {
          console.warn("room subscription failed", err);
          setFailed(true);
        });
      })
      .catch((err) => {
        console.warn("room subscription failed", err);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [mode, cached, fetchOnce]);

  if (!mode) return <Page>{null}</Page>;
  const big = mode === "screen";
  const buckets = rows ? bucketStats(rows) : [];
  const predictions = rows ? predictionStats(rows) : [];

  const download = () => {
    if (!rows) return;
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "room.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const label = "text-xs font-semibold uppercase tracking-[0.12em] text-dim";
  const card = "rounded-xl border border-line bg-panel";

  return (
    // The big screen shows the same layout, only enlarged.
    <div className="flex flex-1 flex-col" style={big ? { zoom: 1.7 } : undefined}>
      <Page>
        <Mark />

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold leading-[1.15] tracking-tight">{en.room.title}</h1>
          <p className="text-[15px] leading-normal text-dim">{en.room.subtitle}</p>
        </div>

        {failed && <p className="rounded-lg border border-line p-4 text-dim">{en.room.offline}</p>}
        {!rows && !failed && <p className="text-dim">{en.room.loading}</p>}

        {rows && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div className={`${card} flex flex-col gap-0.5 p-3.5`}>
                <span className="text-[28px] font-bold leading-tight">{rows.filter((r) => r.kind === "baseline").length}</span>
                <span className="text-[13px] text-dim">{en.room.daytimeRecords}</span>
              </div>
              <div className={`${card} flex flex-col gap-0.5 p-3.5`}>
                <span className="text-[28px] font-bold leading-tight">{rows.filter(usable).length}</span>
                <span className="text-[13px] text-dim">{en.room.nightTests}</span>
              </div>
            </div>

            <section aria-labelledby="by-time" className="flex flex-col gap-3.5">
              <h2 id="by-time" className={label}>
                {en.room.byTime}
              </h2>
              {buckets.map((b) => (
                <div key={b.bucket} className="flex flex-col gap-2">
                  <div className="flex justify-between gap-3 text-[15px]">
                    <span>{en.room.bucketLabel[b.bucket]}</span>
                    {b.n >= MIN_N ? (
                      <span className="font-semibold">{en.room.change(b.mean)}</span>
                    ) : (
                      <span className="text-dim">{en.room.collectingShort}</span>
                    )}
                  </div>
                  {b.n >= MIN_N ? (
                    <>
                      <div className="h-2.5 rounded-full bg-[#1c1c1c]">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${barWidth(b.mean)}%` }} />
                      </div>
                      <span className="text-xs text-mute">{en.room.bucketDetail(b.n, b.ciLow, b.ciHigh)}</span>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5" role="img" aria-label={en.room.dotsAria(b.n)}>
                      {Array.from({ length: MIN_N }, (_, i) => (
                        <span
                          key={i}
                          className={`h-3.5 w-3.5 rounded-full ${i < b.n ? "bg-accent" : "border-[1.5px] border-[#4a4740]"}`}
                        />
                      ))}
                      <span className="ml-1.5 text-xs text-mute">{en.room.moreToShow(MIN_N - b.n)}</span>
                    </div>
                  )}
                </div>
              ))}
            </section>

            <section aria-labelledby="expected-vs" className={`${card} flex flex-col gap-3.5 rounded-2xl p-5`}>
              <h2 id="expected-vs" className="text-xl font-semibold leading-[1.3]">
                {en.room.predictionTitle}
              </h2>
              {predictions.map((p) => {
                const shown = p.n >= MIN_N;
                const lead = p.prediction === 0;
                const w = shown ? barWidth(p.mean) : 0;
                return (
                  <div key={p.prediction} className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                      <span>{en.room.said(p.prediction)}</span>
                      {shown ? (
                        <span className={`font-semibold ${lead ? "text-accent" : ""}`}>{en.room.measuredChange(p.mean)}</span>
                      ) : (
                        <span className="text-dim">{en.room.collectingSoFar(p.n)}</span>
                      )}
                    </div>
                    {shown ? (
                      <>
                        <div className="relative h-[22px]">
                          <span className="absolute inset-x-0 top-[9px] h-1 rounded-full bg-[#262626]" />
                          <span className="absolute left-0 top-[3px] h-4 w-0.5 bg-ink" />
                          <span
                            className={`absolute left-0 top-[9px] h-1 ${lead ? "bg-accent" : "bg-[#c9c5bc]"}`}
                            style={{ width: `${w}%` }}
                          />
                          <span
                            className={`absolute top-1 h-3.5 w-3.5 -translate-x-1/2 rounded-full ${lead ? "bg-accent" : "bg-[#c9c5bc]"}`}
                            style={{ left: `clamp(7px, ${w}%, calc(100% - 7px))` }}
                          />
                        </div>
                        <span className="text-xs text-mute">{en.room.tests(p.n)}</span>
                      </>
                    ) : (
                      <div className="h-1 rounded-full bg-[#262626]" />
                    )}
                  </div>
                );
              })}
              <p className="text-xs leading-normal text-mute">{en.room.predictionNote}</p>
            </section>

            <p className="text-xs leading-normal text-mute">{en.room.footnote}</p>

            {mode === "admin" && (
              <section className={`${card} flex flex-col gap-3 p-4`}>
                <p>
                  {en.room.adminCounts(
                    rows.filter((r) => r.kind === "baseline").length,
                    rows.filter((r) => r.kind === "compare").length,
                    rows.filter(usable).length,
                  )}
                </p>
                <Btn onClick={download}>{en.room.downloadCsv}</Btn>
              </section>
            )}
          </>
        )}

        {!big && (
          <div className="mt-auto flex gap-2.5">
            <Btn className="flex-1" onClick={() => fetchOnce()}>
              {en.room.refresh}
            </Btn>
            <Link
              href="/result"
              className="flex min-h-12 flex-1 items-center justify-center rounded-lg border border-line px-4 py-3 text-base text-ink"
            >
              {en.room.myResult}
            </Link>
          </div>
        )}
      </Page>
    </div>
  );
}
