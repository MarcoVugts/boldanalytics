import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getDaily, getOverview } from "@/lib/queries/trades";
import { num, usd } from "@/lib/format";

export const alt = "Tokenized Stocks on Base: DEX volume, traders and flows, by Bold Analytics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link preview for X / social: title, headline numbers and a mini daily-volume chart.
export default async function Image() {
  const [o, daily, logoSvg, heavy, semi] = await Promise.all([
    getOverview(),
    getDaily(),
    readFile(join(process.cwd(), "public/brand/logo-horizontal.svg")),
    readFile(join(process.cwd(), "assets/fonts/Montserrat-ExtraBold.woff")),
    readFile(join(process.cwd(), "assets/fonts/Montserrat-SemiBold.woff")),
  ]);
  const logo = `data:image/svg+xml;base64,${logoSvg.toString("base64")}`;
  const days = daily.slice(-30);
  const max = Math.max(1, ...days.map((d) => d.volume_usd));
  const stats = o?.last_day
    ? [
        ["DEX volume", usd(o.volume_usd)],
        ["Swaps", num(o.trades)],
        ["Traders", num(o.wallets)],
      ]
    : [];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        background: "#f8f0e8", color: "#1e2a32", padding: "56px 64px", fontFamily: "Montserrat" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26 }}>
          <img src={logo} height={44} width={Math.round(44 * 6.9308)} alt="" />
          <span style={{ color: "#79807f" }}>Data story</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.05 }}>Tokenized Stocks on Base</div>
          <div style={{ fontSize: 30, color: "#4b565d", marginTop: 16 }}>Who trades them, how much, and through which apps</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 48 }}>
            {stats.map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, color: "#79807f" }}>{label}</span>
                <span style={{ fontSize: 44, fontWeight: 800 }}>{value}</span>
              </div>
            ))}
          </div>
          {days.length > 1 && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110 }}>
              {days.map((d) => (
                <div key={d.day} style={{ width: 10, height: Math.max(4, (d.volume_usd / max) * 110), background: "#4678ae", borderRadius: 3 }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: "#79807f" }}>
          <span>boldanalytics.io</span>
          <span>{o?.last_day ? `Data via Dune · through ${o.last_day} UTC` : "Data via Dune"}</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: heavy, weight: 800, style: "normal" },
        { name: "Montserrat", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
