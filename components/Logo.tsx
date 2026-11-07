/** Horizontal logo; swaps to the cream version in dark mode (unless forceLight, used in exports). */
export function Logo({ height = 28, forceLight = false }: { height?: number; forceLight?: boolean }) {
  const ratio = 687.38 / 100; // viewBox of logo-horizontal.svg (scripts/build-brand.mjs), keeps layout stable before load
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo-horizontal.svg" alt="Bold Analytics" height={height} width={Math.round(height * ratio)} style={{ height, width: "auto" }} />
  );
  if (forceLight) return img;
  return (
    <picture>
      <source srcSet="/brand/logo-horizontal-on-dark.svg" media="(prefers-color-scheme: dark)" />
      {img}
    </picture>
  );
}
