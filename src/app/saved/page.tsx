"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { en } from "@/copy/en";
import { getSessions, storageOk } from "@/storage/local";
import { flush } from "@/storage/upload";
import { Btn, Mark, Page, linkClass } from "../ui";
import { useMounted } from "../useMounted";

function message(): string | null {
  if (!storageOk()) return null;
  const sessions = getSessions();
  const baselines = sessions.filter((s) => s.mode === "baseline");
  const last = baselines[baselines.length - 1];
  if (!last) return null;
  if (last.justWoke) return en.saved.justWoke;
  const usable = baselines.filter((s) => !s.justWoke && s.hzClass === last.hzClass);
  if (usable.length >= 2) return en.saved.second;
  if (last.baselineClass === "late") return en.saved.late;
  return en.saved.first(last.metrics.meanRtMs, last.metrics.fastestMs);
}

export default function SavedPage() {
  const mounted = useMounted();
  const state = useMemo(() => (mounted ? { text: message() } : null), [mounted]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    flush().catch((err) => console.warn("flush failed", err));
  }, []);

  if (!state) return <Page>{null}</Page>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch (err) {
      console.warn("clipboard unavailable", err);
    }
  };

  return (
    <Page>
      <Mark />
      {state.text === null ? (
        <>
          <p className="text-xl">{en.saved.none}</p>
          <Link href="/" className={linkClass}>
            {en.saved.toStart}
          </Link>
        </>
      ) : (
        <>
          <p className="text-2xl font-medium leading-snug">{state.text}</p>
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-4">
            <p>{en.saved.sameBrowser}</p>
            <Btn onClick={copy}>{copied ? en.saved.copied : en.saved.copyLink}</Btn>
          </div>
        </>
      )}
    </Page>
  );
}
