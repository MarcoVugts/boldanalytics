import type { Metadata } from "next";
import Link from "next/link";
import { RecordDay } from "@/components/RecordDay";

export const metadata: Metadata = { title: "Visuals · Tokenized Stocks on Base" };

export default function Visuals() {
  return (
    <div className="space-y-6">
      <RecordDay />
      <p className="text-sm text-ink-3">
        All visuals can be downloaded in full quality on the{" "}
        <Link href="/visualizations" className="underline hover:text-ink-2">Visualizations</Link> page.
      </p>
    </div>
  );
}
