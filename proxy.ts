import { NextResponse, type NextRequest } from "next/server";
import { BEHEER_COOKIE, isBeheerToken } from "@/lib/beheer";

// Beheer afschermen: /beheer (behalve het inlogformulier), /ops en de ops-export alleen met de beheercookie.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/beheer/login") return NextResponse.next();
  if (isBeheerToken(request.cookies.get(BEHEER_COOKIE)?.value)) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = request.nextUrl.clone();
  url.pathname = "/beheer/login";
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

// Vaste waarden (Next leest dit bij het bouwen).
export const config = {
  matcher: ["/beheer", "/beheer/:path*", "/ops", "/ops/:path*", "/api/ops-export"],
};
