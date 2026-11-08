"use client";

import { useState } from "react";

/** Copy a fresh plain-text snapshot of /ops (from /api/ops-export) to paste into a chat. */
export function OpsExport() {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");
  const [text, setText] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/ops-export", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.text();
  }

  async function copy() {
    setState("busy");
    try {
      const t = await load();
      setText(t);
      await navigator.clipboard.writeText(t);
      setState("copied");
    } catch {
      // Clipboard can be blocked (e.g. some mobile browsers): show the text to copy by hand.
      setState("error");
    }
  }

  async function download() {
    const t = text ?? (await load());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([t], { type: "text/plain" }));
    a.download = `boldanalytics-ops-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.txt`;
    a.click();
  }

  const btn = "rounded-md border border-border px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-1 hover:text-ink disabled:opacity-50";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={copy} disabled={state === "busy"} className={btn}>
          {state === "busy" ? "Copying…" : state === "copied" ? "✓ Copied" : "Copy for Claude"}
        </button>
        <button onClick={download} className={btn}>↓ Download .txt</button>
        <a href="/api/ops-export" target="_blank" className="text-sm text-ink-3 underline">open as text</a>
      </div>
      {state === "error" && text && (
        <textarea readOnly value={text} className="h-48 w-full rounded-md border border-border bg-surface-1 p-2 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}
