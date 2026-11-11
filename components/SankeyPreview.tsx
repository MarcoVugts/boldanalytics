/* eslint-disable @next/next/no-img-element */
import { FlowSankey } from "./FlowSankey";
import { getFlows } from "@/lib/queries/flows";

/** Live "How the volume flows" Sankey as a card image (cached query, same data as the dashboard).
 *  Falls back to a static image when there is no data (e.g. local builds without MotherDuck). */
export async function SankeyPreview({ fallback }: { fallback: { src: string; alt: string } }) {
  const rows = await getFlows();
  if (!rows.length) return <img src={fallback.src} alt={fallback.alt} className="block aspect-[16/10] w-full bg-[#f8f0e8] object-cover object-top" />;
  return (
    <div className="flex h-full items-center bg-surface-1 p-4 sm:p-5">
      <div className="w-full">
        <FlowSankey rows={rows} preview />
      </div>
    </div>
  );
}
