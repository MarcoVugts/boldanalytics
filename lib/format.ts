const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export const usd = (v: number) => "$" + compact.format(v);
export const num = (v: number) => compact.format(v);
export const int = (v: number) => whole.format(v);
export const bytes = (v: number) =>
  v > 1e9 ? `${(v / 1e9).toFixed(2)} GB` : v > 1e6 ? `${(v / 1e6).toFixed(1)} MB` : `${(v / 1e3).toFixed(0)} kB`;
