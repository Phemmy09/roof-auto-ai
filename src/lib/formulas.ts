export interface FormulaConfig {
  // ── Shingles ────────────────────────────────────────────────────────────
  shinglesWasteFactor: number;        // e.g. 0.10 = 10%

  // ── Ridge Cap ───────────────────────────────────────────────────────────
  ridgeCapCoverage: number;           // LF per bundle
  ridgeCapWasteFactor: number;        // e.g. 0.30 = 30%
  enableRidgeCap: boolean;

  // ── Starter Strip ───────────────────────────────────────────────────────
  starterStripMinBundles: number;     // floor, regardless of measurement
  starterStripLFPerBundle: number;    // LF coverage per bundle

  // ── Synthetic Underlayment ──────────────────────────────────────────────
  feltCoverage: number;               // SQ per roll
  feltWasteFactor: number;            // e.g. 0.05 = 5%
  enableFelt: boolean;

  // ── Ice & Water Shield ──────────────────────────────────────────────────
  iceWaterSqFtPerRoll: number;        // product spec — sqft per roll
  iceWaterEaveWidth: number;          // ft of eave coverage width
  iceWaterValleyWidth: number;        // ft of valley coverage (each side)
  iceWaterSkylightSqFt: number;       // sqft added per skylight unit
  iceWaterChimneySqFt: number;        // sqft added for chimney
  iceWaterPipeBootSqFt: number;       // sqft added per pipe penetration
  iceWaterWasteFactor: number;        // overlap/waste e.g. 0.12 = 12%
  enableIceWater: boolean;

  // ── Drip Edge ───────────────────────────────────────────────────────────
  dripEdgeLength: number;             // ft per piece
  dripEdgeOverlapFactor: number;      // e.g. 0.30 = 30%
  enableDripEdge: boolean;

  // ── Ridge Vent ──────────────────────────────────────────────────────────
  ridgeVentSectionLF: number;         // ft per section/piece

  // ── Step Flashing ───────────────────────────────────────────────────────
  stepFlashingPcsPerLF: number;       // pieces per LF of sidewall
  stepFlashingPcsPerBundle: number;   // pieces per bundle

  // ── Valley Metal ────────────────────────────────────────────────────────
  valleyMetalLFPerRoll: number;       // ft per roll (20″ × 50′ standard)

  // ── Coil Nails ──────────────────────────────────────────────────────────
  coilNailsCoverage: number;          // SQ per case
  enableCoilNails: boolean;

  // ── Cap Nails ───────────────────────────────────────────────────────────
  capNailsThreshold: number;          // SQ breakpoint (≤ = small job)
  capNailsSmallJob: number;           // boxes for jobs ≤ threshold
  capNailsLargeJob: number;           // boxes for jobs > threshold

  // ── Geocel 2300 Sealant ─────────────────────────────────────────────────
  sealantMinTubes: number;            // floor regardless of measurements
  sealantValleyLFPerTube: number;     // valley LF per tube
  sealantRidgeHipLFPerTube: number;   // ridge + hip LF per tube

  // ── Mule-Hide JTS1 ──────────────────────────────────────────────────────
  muleHideLFPerTube: number;          // valley LF per tube

  // ── Touch-Up Paint ──────────────────────────────────────────────────────
  touchUpPaintBase: number;           // cans when any metal present
  touchUpPaintAdditional: number;     // extra cans for complex flashing

  // ── OSB Sheathing ───────────────────────────────────────────────────────
  osbSheetsPerVent: number;           // sheets per turtle vent removed
}

export const DEFAULTS: FormulaConfig = {
  shinglesWasteFactor: 0.10,

  ridgeCapCoverage: 31,
  ridgeCapWasteFactor: 0.30,
  enableRidgeCap: true,

  starterStripMinBundles: 3,
  starterStripLFPerBundle: 113,

  feltCoverage: 10,
  feltWasteFactor: 0.05,
  enableFelt: true,

  iceWaterSqFtPerRoll: 200,
  iceWaterEaveWidth: 3,
  iceWaterValleyWidth: 3,
  iceWaterSkylightSqFt: 30,
  iceWaterChimneySqFt: 20,
  iceWaterPipeBootSqFt: 10,
  iceWaterWasteFactor: 0.12,
  enableIceWater: true,

  dripEdgeLength: 10,
  dripEdgeOverlapFactor: 0.30,
  enableDripEdge: true,

  ridgeVentSectionLF: 4,

  stepFlashingPcsPerLF: 2.4,
  stepFlashingPcsPerBundle: 45,

  valleyMetalLFPerRoll: 50,

  coilNailsCoverage: 12,
  enableCoilNails: true,

  capNailsThreshold: 25,
  capNailsSmallJob: 1,
  capNailsLargeJob: 2,

  sealantMinTubes: 3,
  sealantValleyLFPerTube: 40,
  sealantRidgeHipLFPerTube: 60,

  muleHideLFPerTube: 40,

  touchUpPaintBase: 2,
  touchUpPaintAdditional: 1,

  osbSheetsPerVent: 1,
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

  // Field shingles
  const shingles = Math.ceil(squares * (1 + cfg.shinglesWasteFactor));

  // Hip & ridge shingles
  const ridgeCap = cfg.enableRidgeCap
    ? Math.ceil(((ridges + hips) * (1 + cfg.ridgeCapWasteFactor)) / cfg.ridgeCapCoverage)
    : 0;

  // Starter strip
  const starterStrip = Math.max(
    cfg.starterStripMinBundles,
    Math.ceil((eaves + rakes) / cfg.starterStripLFPerBundle),
  );

  // Synthetic underlayment
  const felt = cfg.enableFelt
    ? Math.ceil((squares * (1 + cfg.feltWasteFactor)) / cfg.feltCoverage)
    : 0;

  // Pitch factor
  let pitchFactor = 1.0;
  const pitchStr = String(data.pitch || '');
  const pitchMatch = pitchStr.match(/(\d+)\/12/);
  if (pitchMatch) {
    const pitchVal = parseInt(pitchMatch[1]);
    const multipliers: Record<number, number> = {
      3: 1.03, 4: 1.05, 5: 1.08, 6: 1.12, 7: 1.16,
      8: 1.20, 9: 1.25, 10: 1.30, 11: 1.36, 12: 1.41,
    };
    pitchFactor = multipliers[pitchVal] || (pitchVal > 12 ? 1.45 : 1.0);
  }

  // Ice & Water Shield — 5-step hierarchy
  const notesText = String(data.notes || '').toLowerCase();
  const hasEaveRequirement = /eave|mountain/i.test(notesText) || /ice\s*&\s*water|i&w/i.test(notesText);
  const eaveSqFt  = hasEaveRequirement ? eaves * cfg.iceWaterEaveWidth * pitchFactor : 0;
  const valleySqFt = valleys * cfg.iceWaterValleyWidth * pitchFactor;

  const skylightCount = (data.hasSkylights || (Number(data.skylightCount) || 0) > 0)
    ? (Number(data.skylightCount) || 1) : 0;
  const skylightSqFt         = skylightCount * cfg.iceWaterSkylightSqFt;
  const chimneySqFt           = data.hasChimney ? cfg.iceWaterChimneySqFt : 0;
  const otherPenetrationSqFt  = pipeBoots * cfg.iceWaterPipeBootSqFt;

  const totalIWSqFt = eaveSqFt + valleySqFt + skylightSqFt + chimneySqFt + otherPenetrationSqFt;
  const iceAndWater = cfg.enableIceWater && totalIWSqFt > 0
    ? Math.ceil((totalIWSqFt * (1 + cfg.iceWaterWasteFactor)) / cfg.iceWaterSqFtPerRoll)
    : 0;

  // Drip edge
  const dripEdgeRake = cfg.enableDripEdge && rakes > 0
    ? Math.ceil((rakes * (1 + cfg.dripEdgeOverlapFactor)) / cfg.dripEdgeLength)
    : 0;
  const dripEdgeEave = cfg.enableDripEdge && eaves > 0
    ? Math.ceil((eaves * (1 + cfg.dripEdgeOverlapFactor)) / cfg.dripEdgeLength)
    : 0;
  const dripEdge = dripEdgeRake + dripEdgeEave;

  // Pipe jacks — direct 1:1 count
  const pipeJacks = pipeBoots;

  // Ridge vent sections
  const ridgeVentSections =
    (ventStrategy === 'Ridge' || ventStrategy === 'Hybrid') && ridges > 0
      ? Math.ceil(ridges / cfg.ridgeVentSectionLF)
      : 0;

  // Box vents
  const boxVents =
    ventStrategy === 'Box' || ventStrategy === 'Hybrid'
      ? Number(data.vents) || 0
      : 0;

  // Step flashing
  const stepFlashingPcs = sidewallLF > 0
    ? Math.ceil(sidewallLF * cfg.stepFlashingPcsPerLF) : 0;
  const stepFlashing = stepFlashingPcs > 0
    ? Math.ceil(stepFlashingPcs / cfg.stepFlashingPcsPerBundle) : 0;

  // Counter flashing / L-flashing
  const counterFlashing = (data.hasChimney || data.hasMasonryWall || data.hasRoofToWall) ? 1 : 0;

  // Valley metal
  const valleyMetal = valleys > 0
    ? Math.max(1, Math.ceil(valleys / cfg.valleyMetalLFPerRoll)) : 0;

  // OSB sheathing — 1 sheet per vent removed only when fully switching to Ridge.
  // Hybrid keeps existing box vents, so no patching is needed unless explicitly stated.
  const ventsRemoved = ventStrategy === 'Ridge'
    ? (Number(data.vents) || Number(data.insuranceVents) || 0)
    : 0;
  const osbSheathing = ventsRemoved * cfg.osbSheetsPerVent;

  // Mule-Hide JTS1
  const muleHideSealant = valleys > 0
    ? Math.max(1, Math.ceil(valleys / cfg.muleHideLFPerTube)) : 0;

  // Touch-up paint
  let touchUpPaint = 0;
  const hasMetal =
    dripEdgeRake > 0 || dripEdgeEave > 0 || stepFlashing > 0 ||
    pipeJacks > 0 || boxVents > 0 || ridgeVentSections > 0 ||
    counterFlashing > 0 || valleyMetal > 0;

  if (hasMetal) {
    touchUpPaint = cfg.touchUpPaintBase;
    if (stepFlashing > 0 || counterFlashing > 0 || valleyMetal > 0) {
      touchUpPaint += cfg.touchUpPaintAdditional;
    }
  }

  // Coil nails
  const coilNails = cfg.enableCoilNails
    ? Math.ceil(squares / cfg.coilNailsCoverage)
    : 0;

  // Cap nails
  const capNails = squares <= cfg.capNailsThreshold
    ? cfg.capNailsSmallJob : cfg.capNailsLargeJob;

  // Geocel 2300 sealant
  let sealant = Math.max(
    cfg.sealantMinTubes,
    Math.ceil(valleys / cfg.sealantValleyLFPerTube + (ridges + hips) / cfg.sealantRidgeHipLFPerTube),
  );
  if (counterFlashing > 0) sealant += counterFlashing;
  if (boxVents > 0)        sealant += Math.ceil(boxVents / 2);
  if (stepFlashing > 0)    sealant += stepFlashing;
  if (valleyMetal > 0)     sealant += valleyMetal;

  return {
    shingles, felt, iceAndWater, ridgeCap,
    dripEdge, dripEdgeRake, dripEdgeEave,
    coilNails, starterStrip, pipeJacks,
    ridgeVentSections, boxVents,
    stepFlashing, stepFlashingPcs,
    counterFlashing, valleyMetal, osbSheathing,
    muleHideSealant, touchUpPaint, capNails, sealant,
  };
}
