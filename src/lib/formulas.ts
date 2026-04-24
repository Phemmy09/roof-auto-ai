export async function calculateAllMaterials(data: any) {
  const squares    = Number(data.squares)   || 0;
  const valleys    = Number(data.valleys)   || 0;
  const eaves      = Number(data.eaves)     || 0;
  const ridges     = Number(data.ridges)    || 0;
  const hips       = Number(data.hips)      || 0;
  const rakes      = Number(data.rakes)     || 0;
  const pipeBoots  = Number(data.pipeBoots) || 0;

  // Field shingles — 10% waste factor
  const shingles = Math.ceil(squares * 1.10);

  // Hip & ridge shingles — 30% waste, ~31 LF per bundle
  const ridgeCap = Math.ceil(((ridges + hips) * 1.30) / 31);

  // Starter strip — min 3 bundles, ~113 LF per bundle
  const starterStrip = Math.max(3, Math.ceil((eaves + rakes) / 113));

  // Synthetic underlayment — 10 SQ per roll, 5% waste
  const felt = Math.ceil((squares * 1.05) / 10);

  // Ice & water shield — 6 ft coverage at eaves + 3 ft in valleys, ~200 SF roll, 5% waste
  const iceAndWater = Math.ceil(((eaves * 6) + (valleys * 3)) * 1.05 / 200);

  // Drip edge rake — 30% extra for overlaps, 10 ft sticks
  const dripEdgeRake = rakes > 0 ? Math.ceil((rakes * 1.30) / 10) : 0;

  // Drip edge eave — 30% extra, 10 ft sticks
  const dripEdgeEave = eaves > 0 ? Math.ceil((eaves * 1.30) / 10) : 0;

  // Combined drip edge (backward compat)
  const dripEdge = dripEdgeRake + dripEdgeEave;

  // Pipe jacks — direct count from EagleView
  const pipeJacks = pipeBoots;

  // Ridge vent sections (4 ft each) — only if ridge exists
  const ridgeVentSections = ridges > 0 ? Math.ceil(ridges / 4) : 0;

  // Coil nails 1-1/4" — 1 case per 12 SQ
  const coilNails = Math.ceil(squares / 12);

  // Cap nails (plastic) — 1 box ≤25 SQ, 2 boxes >25 SQ
  const capNails = squares <= 25 ? 1 : 2;

  // Geocel 2300 sealant — min 3 tubes
  const sealant = Math.max(3, Math.ceil(valleys / 40 + (ridges + hips) / 60));

  return {
    shingles,
    felt,
    iceAndWater,
    ridgeCap,
    dripEdge,
    dripEdgeRake,
    dripEdgeEave,
    coilNails,
    starterStrip,
    pipeJacks,
    ridgeVentSections,
    capNails,
    sealant,
  };
}
