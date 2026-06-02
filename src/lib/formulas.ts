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

  const squares      = Number(data.squares)      || 0;
  const valleys      = Number(data.valleys)      || 0;
  const eaves        = Number(data.eaves)        || 0;
  const ridges       = Number(data.ridges)       || 0;
  const hips         = Number(data.hips)         || 0;
  const rakes        = Number(data.rakes)        || 0;
  const pipeBoots    = Number(data.pipeBoots)    || 0;
  const sidewallLF   = Number(data.sidewallLF)   || 0;
  const ventStrategy = String(data.ventilationStrategy || 'N/A');

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

  // Ridge vent sections (4 ft each) — only when scope specifies Ridge or Hybrid strategy
  const ridgeVentSections =
    (ventStrategy === 'Ridge' || ventStrategy === 'Hybrid') && ridges > 0
      ? Math.ceil(ridges / 4)
      : 0;

  // Box vents — count from extracted vents field, only when scope specifies Box or Hybrid
  const boxVents =
    ventStrategy === 'Box' || ventStrategy === 'Hybrid'
      ? Number(data.vents) || 0
      : 0;

  // Step flashing — calculate pieces at 1 piece per course (exposure of 5 inches = 2.4 pieces per LF of sidewall), then bundles of 45 pcs
  const stepFlashingPcs = sidewallLF > 0 ? Math.ceil(sidewallLF * 2.4) : 0;
  const stepFlashing = Math.ceil(stepFlashingPcs / 45);

  // Counter flashing / L-flashing — 1 set if hasChimney, hasMasonryWall, or hasRoofToWall is true
  const counterFlashing = (data.hasChimney || data.hasMasonryWall || data.hasRoofToWall) ? 1 : 0;

  // Skylights & Valley metal — automatically include valley metal rolls (20" x 50' rolls) if skylights present
  const hasSkylights = !!data.hasSkylights || (Number(data.skylightCount) || 0) > 0;
  const valleyMetal = hasSkylights ? 1 : 0;

  // Turtle Vent Removal & OSB Sheathing — 1 sheet of 7/16" OSB per turtle vent removed
  const ventsRemoved = (ventStrategy === 'Ridge' || ventStrategy === 'Hybrid')
    ? (Number(data.vents) || Number(data.insuranceVents) || 0)
    : 0;
  const osbSheathing = ventsRemoved;

  // Valleys & Mule-Hide JTS1 Joint Sealant — include for all roof valleys
  const muleHideSealant = valleys > 0 ? Math.max(1, Math.ceil(valleys / 40)) : 0;

  // Touch-up paint — 2 cans base if metal is present, +1 additional can if step flashing, counter flashing, or valley metal are added
  let touchUpPaint = 0;
  const hasMetal =
    dripEdgeRake > 0 ||
    dripEdgeEave > 0 ||
    stepFlashing > 0 ||
    pipeJacks > 0 ||
    boxVents > 0 ||
    ridgeVentSections > 0 ||
    counterFlashing > 0 ||
    valleyMetal > 0;

  if (hasMetal) {
    touchUpPaint = 2; // base
    if (stepFlashing > 0 || counterFlashing > 0 || valleyMetal > 0) {
      touchUpPaint += 1; // +1 additional can
    }
  }

  // Coil nails 1-1/4"
  const coilNails = cfg.enableCoilNails
    ? Math.ceil(squares / cfg.coilNailsCoverage)
    : 0;

  // Cap nails (plastic) — 1 box ≤25 SQ, 2 boxes >25 SQ
  const capNails = squares <= 25 ? 1 : 2;

  // Geocel 2300 sealant — min 3 tubes. Include additional tubes if box vents, step flashing, counter flashing, or valley metal are added.
  let sealant = Math.max(3, Math.ceil(valleys / 40 + (ridges + hips) / 60));
  if (counterFlashing > 0) {
    sealant += counterFlashing * 1;
  }
  if (boxVents > 0) {
    sealant += Math.ceil(boxVents / 2);
  }
  if (stepFlashing > 0) {
    sealant += stepFlashing * 1;
  }
  if (valleyMetal > 0) {
    sealant += valleyMetal * 1;
  }

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
    boxVents,
    stepFlashing,
    stepFlashingPcs,
    counterFlashing,
    valleyMetal,
    osbSheathing,
    muleHideSealant,
    touchUpPaint,
    capNails,
    sealant,
  };
}

