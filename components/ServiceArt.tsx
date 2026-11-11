// Illustrations for "What we build" on the homepage. Pure SVG in the theme colours (CSS variables), so they follow
// light/dark mode and contain no real numbers: they show the kind of work, not a specific dataset.
const C = {
  bg: "var(--surface-0)",
  card: "var(--surface-1)",
  line: "var(--border)",
  grid: "var(--grid)",
  ink: "var(--text-primary)",
  ink3: "var(--text-muted)",
  s1: "var(--series-1)",
  s2: "var(--series-2)",
  good: "var(--good)",
};
const seq = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)"];

const Svg = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <svg viewBox="0 0 320 200" role="img" aria-label={label} className="block h-full w-full">
    <rect width="320" height="200" fill={C.bg} />
    {children}
  </svg>
);

export function DashboardArt() {
  // browser window with KPI tiles, an area chart and a bar chart
  const area = "M0 70 C20 64 30 52 50 55 S80 40 100 44 S130 26 150 30 S180 14 200 12";
  return (
    <Svg label="Illustration of a live dashboard">
      <g transform="translate(24 18)">
        <rect width="272" height="182" rx="8" fill={C.card} stroke={C.line} />
        <path d="M0 8a8 8 0 0 1 8-8h256a8 8 0 0 1 8 8v12H0z" fill={C.grid} />
        {[10, 19, 28].map((x) => <circle key={x} cx={x} cy="10" r="2.6" fill={C.line} />)}
        <rect x="88" y="4.5" width="96" height="11" rx="5.5" fill={C.card} />
        <rect x="96" y="8.5" width="52" height="3" rx="1.5" fill={C.line} />
        <rect x="222" y="5" width="40" height="10" rx="5" fill={C.card} />
        <circle cx="230" cy="10" r="2.2" fill={C.good}>
          <animate attributeName="opacity" values="1;.25;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <rect x="236" y="8.5" width="20" height="3" rx="1.5" fill={C.ink3} />
        {/* KPI tiles */}
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${12 + i * 85} 30)`}>
            <rect width="78" height="34" rx="4" fill={C.bg} stroke={C.line} />
            <rect x="7" y="7" width="26" height="3" rx="1.5" fill={C.ink3} opacity=".6" />
            <rect x="7" y="16" width={[38, 30, 44][i]} height="8" rx="2" fill={C.ink} />
            <path d={["M50 26 l6-4 6 2 6-7 6 3", "M50 24 l6 1 6-5 6 2 6-6", "M50 27 l6-2 6-4 6 1 6-8"][i]} fill="none" stroke={i === 2 ? C.s2 : C.s1} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        {/* area chart */}
        <g transform="translate(12 74)">
          <rect width="163" height="96" rx="4" fill={C.bg} stroke={C.line} />
          <rect x="8" y="8" width="44" height="3" rx="1.5" fill={C.ink3} opacity=".6" />
          {[30, 50, 70].map((y) => <line key={y} x1="8" x2="155" y1={y} y2={y} stroke={C.grid} />)}
          <g transform="translate(8 14) scale(.735 1)">
            <path d={`${area} L200 74 L0 74Z`} fill={C.s1} opacity=".18" />
            <path d={area} fill="none" stroke={C.s1} strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          </g>
          <circle cx="155" cy="23" r="3" fill={C.s1} stroke={C.bg} strokeWidth="1.5" />
        </g>
        {/* bar chart */}
        <g transform="translate(182 74)">
          <rect width="78" height="96" rx="4" fill={C.bg} stroke={C.line} />
          <rect x="8" y="8" width="30" height="3" rx="1.5" fill={C.ink3} opacity=".6" />
          {[34, 48, 40, 60, 52, 70].map((h, i) => (
            <rect key={i} x={9 + i * 11} y={86 - h} width="7" height={h} rx="1.5" fill={i === 5 ? C.s2 : seq[1 + (i % 3)]} />
          ))}
        </g>
      </g>
    </Svg>
  );
}

export function VisualizationArt() {
  // flow diagram with ribbons between two columns, dots travelling along them
  const L = [28, 78, 132]; // left node centres
  const R = [22, 62, 104, 152];
  const rib = (a: number, b: number, w: number) =>
    `M60 ${a - w / 2} C160 ${a - w / 2} 160 ${b - w / 2} 260 ${b - w / 2} L260 ${b + w / 2} C160 ${b + w / 2} 160 ${a + w / 2} 60 ${a + w / 2}Z`;
  const links: [number, number, number, string][] = [
    [0, 0, 22, C.s1], [0, 2, 12, C.s1], [1, 1, 18, C.s2], [1, 3, 14, C.s2], [2, 2, 16, seq[3]], [2, 3, 12, seq[3]], [0, 1, 8, C.s1],
  ];
  return (
    <Svg label="Illustration of a flow visualization">
      <g transform="translate(0 12)">
        {links.map(([a, b, w, c], i) => <path key={i} d={rib(L[a], R[b], w)} fill={c} opacity=".22" />)}
        {links.map(([a, b, , c], i) => (
          <circle key={`d${i}`} r="2.4" fill={c}>
            <animateMotion dur={`${3 + (i % 3)}s`} begin={`${-i * 0.7}s`} repeatCount="indefinite" path={`M60 ${L[a]} C160 ${L[a]} 160 ${R[b]} 260 ${R[b]}`} />
          </circle>
        ))}
        {L.map((y, i) => <rect key={i} x="52" y={y - [17, 16, 14][i]} width="8" height={[34, 32, 28][i]} rx="2" fill={[C.s1, C.s2, seq[3]][i]} />)}
        {R.map((y, i) => <rect key={i} x="260" y={y - [11, 13, 16, 13][i]} width="8" height={[22, 26, 32, 26][i]} rx="2" fill={C.ink} opacity=".8" />)}
        {L.map((y, i) => <rect key={`l${i}`} x="16" y={y - 2} width={[28, 22, 26][i]} height="4" rx="2" fill={C.ink3} opacity=".7" />)}
        {R.map((y, i) => <rect key={`r${i}`} x="276" y={y - 2} width={[24, 30, 20, 26][i]} height="4" rx="2" fill={C.ink3} opacity=".7" />)}
      </g>
    </Svg>
  );
}

export function ReportArt() {
  // two report pages: text lines, a highlighted number, a donut and bars
  const lines = (x: number, y: number, ws: number[]) => ws.map((w, i) => <rect key={i} x={x} y={y + i * 8} width={w} height="3.2" rx="1.6" fill={C.line} />);
  return (
    <Svg label="Illustration of a research report">
      <g transform="translate(150 24) rotate(6)">
        <rect width="120" height="160" rx="5" fill={C.card} stroke={C.line} />
        {lines(14, 18, [80, 92, 70])}
        <rect x="14" y="50" width="92" height="50" rx="3" fill={C.bg} />
        <path d="M20 92 L36 80 L52 84 L68 66 L84 70 L100 56" fill="none" stroke={C.s1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {lines(14, 112, [92, 86, 60])}
      </g>
      <g transform="translate(56 18) rotate(-4)">
        <rect width="128" height="168" rx="5" fill={C.card} stroke={C.line} />
        <rect x="14" y="16" width="62" height="7" rx="2" fill={C.ink} />
        <rect x="14" y="28" width="40" height="3.2" rx="1.6" fill={C.ink3} opacity=".6" />
        <text x="14" y="62" fontFamily="var(--font-brand), sans-serif" fontWeight="800" fontSize="19" fill={C.s2}>+42%</text>
        {lines(14, 72, [70, 54])}
        <g transform="translate(103 52)">
          <circle r="13" fill="none" stroke={C.grid} strokeWidth="6" />
          <circle r="13" fill="none" stroke={C.s1} strokeWidth="6" strokeDasharray="50 82" transform="rotate(-90)" />
          <circle r="13" fill="none" stroke={C.s2} strokeWidth="6" strokeDasharray="18 82" strokeDashoffset="-50" transform="rotate(-90)" />
        </g>
        {[30, 44, 24, 52, 38].map((w, i) => (
          <g key={i} transform={`translate(14 ${96 + i * 11})`}>
            <rect width="100" height="6" rx="3" fill={C.bg} />
            <rect width={w * 1.8} height="6" rx="3" fill={seq[i]} />
          </g>
        ))}
      </g>
    </Svg>
  );
}
