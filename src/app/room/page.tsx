"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { en } from "@/copy/en";
import { MIN_N, bucketStats, predictionStats, toCsv, usable } from "@/lib/room";
import { KEYS } from "@/storage/local";
import type { Summary } from "@/storage/upload";
import { Btn, Mark, Page, linkClass } from "../ui";
import { useMounted } from "../useMounted";

const CACHE_MS = 2 * 60 * 1000; // raise to 5 minutes if Firestore reads pass half the daily quota
const BAR_FULL_PCT = 25; // a bar is full width at a 25% change

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
  const mounted = useMounted();
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

  return (
    <Page wide={big}>
      <Mark />
      <h1 className={`font-semibold leading-tight tracking-tight ${big ? "text-6xl" : "text-3xl"}`}>{en.room.title}</h1>

      {failed && <p className="rounded-lg border border-line p-4 text-dim">{en.room.offline}</p>}
      {!rows && !failed && <p className="text-dim">{en.room.loading}</p>}

      {rows && (
        <>
          <section className={`flex flex-col ${big ? "gap-10 text-3xl" : "gap-5 text-lg"}`}>
            {buckets.map((b) => {
              const label = en.room.bucketLabel[b.bucket];
              if (b.n < MIN_N) {
                return (
                  <p key={b.bucket} className="text-dim">
                    {en.room.collecting(label, b.n)}
                  </p>
                );
              }
              const width = Math.min(100, (Math.abs(b.mean) / BAR_FULL_PCT) * 100);
              return (
                <div key={b.bucket} className="flex flex-col gap-2">
                  <p className="leading-snug">{en.room.bucketLine(label, b.n, b.mean, b.ciLow, b.ciHigh)}</p>
                  <div className={`w-full rounded bg-panel ${big ? "h-8" : "h-3"}`}>
                    <div
                      className={`h-full rounded ${b.mean < 0 ? "bg-dim" : "bg-accent"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          <section className={`flex flex-col border-t border-line pt-5 ${big ? "gap-5 text-3xl" : "gap-3 text-lg"}`}>
            <h2 className={`text-dim ${big ? "text-2xl" : "text-sm"}`}>{en.room.predictionTitle}</h2>
            {predictions.map((p) => (
              <p key={p.prediction} className={`leading-snug ${p.prediction === 0 && p.n >= MIN_N ? "text-ink" : "text-dim"}`}>
                {p.n < MIN_N
                  ? en.room.predictionCollecting(p.prediction, p.n)
                  : en.room.predictionLine(p.prediction, p.n, p.mean)}
              </p>
            ))}
          </section>

          <p className={`leading-relaxed text-dim ${big ? "text-xl" : "text-sm"}`}>{en.room.footnote}</p>

          {mode === "admin" && (
            <section className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
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

      {mode !== "screen" && (
        <div className="mt-auto flex items-center justify-between gap-4">
          <Btn onClick={() => fetchOnce()}>{en.room.refresh}</Btn>
          <Link href="/" className={linkClass}>
            {en.room.back}
          </Link>
        </div>
      )}
    </Page>
  );
}
