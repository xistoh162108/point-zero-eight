"use client";

import { useMemo, useState } from "react";
import { en } from "@/copy/en";
import { KEYS } from "@/storage/local";
import { Btn, Mark, Page } from "../ui";
import { useIsClient } from "@/lib/client";

// Team use: hands the per-trial records on this phone to the analyst. They never go to the server.
export default function ExportPage() {
  const mounted = useIsClient();
  const [copied, setCopied] = useState(false);
  const json = useMemo(() => {
    if (!mounted) return null;
    try {
      return localStorage.getItem(KEYS.sessions) ?? "[]";
    } catch (err) {
      console.warn("storage blocked", err);
      return "[]";
    }
  }, [mounted]);

  if (json === null) return <Page>{null}</Page>;

  let count = 0;
  try {
    count = (JSON.parse(json) as unknown[]).length;
  } catch (err) {
    console.warn("stored sessions are not valid JSON", err);
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch (err) {
      console.warn("clipboard unavailable", err);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pze-sessions-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page>
      <Mark />
      <h1 className="text-2xl font-semibold">{en.exportPage.title}</h1>
      <p className="text-dim">{en.exportPage.count(count)}</p>
      <div className="flex flex-col gap-3">
        <Btn tone="primary" onClick={download}>
          {en.exportPage.download}
        </Btn>
        <Btn onClick={copy}>{copied ? en.exportPage.copied : en.exportPage.copy}</Btn>
      </div>
      <textarea
        readOnly
        value={json}
        className="h-80 w-full rounded-lg border border-line bg-panel p-3 font-mono text-xs text-dim"
      />
    </Page>
  );
}
