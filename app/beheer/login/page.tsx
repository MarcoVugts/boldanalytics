import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Beheer", robots: { index: false, follow: false } };

type Params = Promise<{ fout?: string; next?: string }>;

export default function Login({ searchParams }: { searchParams: Params }) {
  return (
    <Suspense>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({ searchParams }: { searchParams: Params }) {
  const { fout, next } = await searchParams;
  return (
    <div className="mx-auto mt-16 max-w-sm space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Beheer</h1>
      <form method="post" action="/api/beheer/login" className="space-y-3">
        <input type="hidden" name="next" value={next ?? "/beheer"} />
        <input
          type="password"
          name="key"
          autoFocus
          autoComplete="current-password"
          placeholder="Sleutel"
          className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
        />
        <button className="w-full rounded-md bg-ink px-3 py-2 text-sm font-semibold text-surface-0">Inloggen</button>
      </form>
      {fout && <p className="text-sm text-critical">Onjuiste sleutel.</p>}
    </div>
  );
}
