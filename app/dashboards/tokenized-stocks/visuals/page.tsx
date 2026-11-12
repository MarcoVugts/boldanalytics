import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RecordDay } from "@/components/RecordDay";
import { NetworkGrowthCard } from "@/components/NetworkGrowthCard";

export const metadata: Metadata = { title: "Visuals · Tokenized Stocks on Base" };

export default function Visuals() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-96 rounded-lg border border-border bg-surface-1" />}>
        <NetworkGrowthCard />
      </Suspense>
      <RecordDay />
      <p className="text-sm text-ink-3">
        All visuals can be downloaded in full quality on the{" "}
        <Link href="/visualizations" className="underline hover:text-ink-2">Visualizations</Link> page.
      </p>
    </div>
  );
}
