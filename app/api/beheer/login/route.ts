import { NextResponse } from "next/server";
import { BEHEER_COOKIE, beheerToken, isBeheerToken } from "@/lib/beheer";

// Inloggen met BEHEER_KEY; daarna onthoudt een cookie het een jaar.
export async function POST(request: Request) {
  const form = await request.formData();
  const token = beheerToken(String(form.get("key") ?? ""));
  const ok = isBeheerToken(token);
  const next = String(form.get("next") ?? "/beheer");
  const safeNext = /^\/(beheer|ops)(\/|$)/.test(next) ? next : "/beheer";
  const res = NextResponse.redirect(new URL(ok ? safeNext : `/beheer/login?fout=1&next=${encodeURIComponent(safeNext)}`, request.url), 303);
  // Lax, niet Strict: anders ben je "uitgelogd" als je /beheer opent via een link.
  if (ok) res.cookies.set(BEHEER_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  return res;
}
