export interface FormulaConfig {
  feltCoverage: number;
  iceWaterCoverage: number;
  ridgeCapCoverage: number;
  dripEdgeLength: number;
  coilNailsCoverage: number;
  enableFelt: boolean;
  enableIceWater: boolean;
  enableRidgeCap: boolean;
  enableDripEdge: boolean;
  enableCoilNails: boolean;
}

const DEFAULTS: FormulaConfig = {
  feltCoverage: 10,
  iceWaterCoverage: 60,
  ridgeCapCoverage: 31,
  dripEdgeLength: 10,
  coilNailsCoverage: 12,
  enableFelt: true,
  enableIceWater: true,
  enableRidgeCap: true,
  enableDripEdge: true,
  enableCoilNails: true,
};

export async function calculateAllMaterials(data: any, config?: Partial<FormulaConfig>) {
  const cfg: FormulaConfig = { ...DEFAULTS, ...config };

  const squares   = Number(data.squares)   || 0;
  const valleys   = Number(data.valleys)   || 0;
  const eaves     = Number(data.eaves)     || 0;
  const ridges    = Number(data.ridges)    || 0;
  const hips      = Number(data.hips)      || 0;
  const rakes     = Number(data.rakes)     || 0;
  const pipeBoots = Number(data.pipeBoots) || 0;

  // Field shingles — 10% waste factor (not configurable, pure measurement)
  const shingles = Math.ceil(squares * 1.10);

  // Hip & ridge shingles — 30% waste
  const ridgeCap = cfg.enableRidgeCap
    ? Math.ceil(((ridges + hips) * 1.30) / cfg.ridgeCapCoverage)
    : 0;

  // Starter strip — min 3 bundles, ~113 LF per bundle
  const starterStrip = Math.max(3, Math.ceil((eaves + rakes) / 113));

  // Synthetic underlayment — 5% waste, cfg.feltCoverage SQ per roll
  const felt = cfg.enableFelt
    ? Math.ceil((squares * 1.05) / cfg.feltCoverage)
    : 0;

  // Ice & water shield — LF of eave + valley runs, cfg.iceWaterCoverage LF per roll, 5% waste
  const iceAndWater = cfg.enableIceWater
    ? Math.ceil((eaves + valleys) * 1.05 / cfg.iceWaterCoverage)
    : 0;

  // Drip edge rake — 30% extra for overlaps
  const dripEdgeRake = cfg.enableDripEdge && rakes > 0
    ? Math.ceil((rakes * 1.30) / cfg.dripEdgeLength)
    : 0;

  // Drip edge eave — 30% extra
  const dripEdgeEave = cfg.enableDripEdge && eaves > 0
    ? Math.ceil((eaves * 1.30) / cfg.dripEdgeLength)
    : 0;

  const dripEdge = dripEdgeRake + dripEdgeEave;

  // Pipe jacks — direct count
  const pipeJacks = pipeBoots;

  // Ridge vent sections (4 ft each)
  const ridgeVentSections = ridges > 0 ? Math.ceil(ridges / 4) : 0;

  // Coil nails 1-1/4"
  const coilNails = cfg.enableCoilNails
    ? Math.ceil(squares / cfg.coilNailsCoverage)
    : 0;

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
