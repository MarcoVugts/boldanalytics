/* eslint-disable @next/next/no-img-element */
const RATIO = 693.08 / 100; // viewBox of logo-horizontal.svg (scripts/build-brand.mjs), keeps layout stable before load

/** Horizontal logo. Renders both colour variants and lets CSS show the one for the active theme
 *  (device setting or the visitor's choice). forceLight is used for exported share images. */
export function Logo({ height = 28, forceLight = false }: { height?: number; forceLight?: boolean }) {
  const props = { height, width: Math.round(height * RATIO), style: { height, width: "auto" } };
  if (forceLight) return <img src="/brand/logo-horizontal.svg" alt="Bold Analytics" {...props} />;
  return (
    <>
      <img className="logo-light" src="/brand/logo-horizontal.svg" alt="Bold Analytics" {...props} />
      <img className="logo-dark" src="/brand/logo-horizontal-on-dark.svg" alt="Bold Analytics" {...props} />
    </>
  );
}

/** Stacked logo (icon + "BOLD / ANALYTICS" on two lines), same theme switching. Used in the header on small screens. */
export function LogoStacked({ height = 38 }: { height?: number }) {
  const props = { height, width: Math.round((height * 615.42) / 200), style: { height, width: "auto" } };
  return (
    <>
      <img className="logo-light" src="/brand/logo-stacked.svg" alt="Bold Analytics" {...props} />
      <img className="logo-dark" src="/brand/logo-stacked-on-dark.svg" alt="Bold Analytics" {...props} />
    </>
  );
}
