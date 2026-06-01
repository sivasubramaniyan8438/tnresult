/**
 * Pre-computes SVG path data for all 234 TN ACs from the topojson source.
 * Runs once at module load on the server — the result is JSON-serialized
 * down to the client component for rendering. No d3 or topojson code in
 * the client bundle.
 *
 * Source: baskicanvas/tamilnadu-assembly-constituency-maps · 234 features
 * with AC_NO matching official ECI numbering 1..234.
 */
import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";

export type AcShape = {
  acId: number;
  /** Pre-rendered SVG path d-attribute, in viewport units */
  d: string;
  /** Centroid for label placement */
  cx: number;
  cy: number;
};

export type TnMapData = {
  shapes: AcShape[];
  width: number;
  height: number;
};

let _cache: TnMapData | null = null;

export function loadTnMap(): TnMapData {
  if (_cache) return _cache;

  const filePath = path.join(process.cwd(), "data", "tn-ac.topo.json");
  const topo = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const objectName = Object.keys(topo.objects)[0];
  const fc = topojson.feature(
    topo,
    topo.objects[objectName],
  ) as unknown as FeatureCollection<Geometry, { AC_NO: number }>;

  const W = 800;
  const H = 1000; // TN is taller than it is wide

  // Mercator projection fitted to the TN extent inside our viewport
  const projection = geoMercator().fitSize([W, H], fc);
  const pathGen = geoPath(projection);

  const shapes: AcShape[] = [];
  for (const feature of fc.features) {
    const acId = (feature.properties as { AC_NO?: number })?.AC_NO;
    if (!acId) continue;
    const d = pathGen(feature);
    if (!d) continue;
    const centroid = pathGen.centroid(feature);
    shapes.push({
      acId,
      d,
      cx: Number.isFinite(centroid[0]) ? centroid[0] : 0,
      cy: Number.isFinite(centroid[1]) ? centroid[1] : 0,
    });
  }

  shapes.sort((a, b) => a.acId - b.acId);
  _cache = { shapes, width: W, height: H };
  return _cache;
}
