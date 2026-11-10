// Afgeschermd beheer (/beheer, /ops). Inloggen met BEHEER_KEY uit de omgevingsvariabelen (Vercel); de cookie bevat
// een hash van die sleutel, niet de sleutel zelf. Zonder BEHEER_KEY kan niemand erin. Zelfde opzet als Runtools.
import { createHash, timingSafeEqual } from "node:crypto";

export const BEHEER_COOKIE = "bold_beheer";

export function beheerToken(key: string): string {
  return createHash("sha256").update(`boldanalytics:${key}`).digest("hex");
}

/** Klopt de cookie (of de ingevulde sleutel)? */
export function isBeheerToken(token: string | undefined): boolean {
  const key = process.env.BEHEER_KEY;
  if (!key || !token) return false;
  const a = Buffer.from(beheerToken(key));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
