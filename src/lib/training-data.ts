// Business rules extracted from the 5 training data documents.
// These are embedded as constants so they work on Vercel (no file I/O at runtime).

export const CREW_INSTRUCTION_RULES = `
CREW INSTRUCTION MASTER TEMPLATE — BUSINESS RULES

PROPERTY SCOPE: Select one — House/Garage/Shed, House & Garage, House & Shed, House Only.

ICE & WATER SHIELD (I&W) RULES:
- Code standard (Denver/Colorado metro): Install I&W in all valleys only, unless local code differs.
- Mountain regions often require I&W at eaves (24-36 inches).
- Some cities require I&W around penetrations (pipe jacks, vents, solar tubes).
- Insurance jobs: Install I&W only if it existed previously, unless insurance explicitly approves new.
- Retail/IPW: "Install one full row of I&W" is standard; some jobs require TWO full rows.
- If code says valleys → install valleys. If contract/IPW says "1 full row" → install 1 row.
- If insurance says replace only if existing → follow that. Always document with photos.

VENTILATION REQUIREMENTS:
- Ridge Vent: Cut-in ridge line per sketch. Remove old turtle vents if ridge vent replaces them. Install ridge vent sections per material order. Seal old vent holes with SmartPlugs if needed.
- Static/Box Vents: Install per EagleView count IF ventilation strategy = Box Vents. Remove outdated vents and cap holes.
- Intake Ventilation: Cut-in and install Deck-Air intake where required. If attic lacks soffit ventilation, intake venting is required when ridge vents are added.
- If ridge vent is included in scope, remove box/turtle vents unless scope says otherwise.

FLASHING REQUIREMENTS:
- Install step flashing at all walls. Install headwall flashing at vertical transitions.
- Drip edge must extend 2 inches back onto decking. Minimum 2-inch overlap at seams (Denver).
- Photograph all flashing during tear-off and installation.
- Do not replace chimney flashing if siding is brittle/unsafe unless specifically approved.
- Seal valley shingles with Mule-Hide JTS1 if specified.

TEAR-OFF & DECKING:
- Tear off all layers of shingles. Photograph back of shingle if Class 4 verification is required.
- Replace damaged decking as needed. Use OSB or plywood path across grass/flowers if homeowner requests.

ACCESSORY COMPONENTS:
- Satellite dish: Reset unless scope says discard.
- Solar panels: Remove and discard water solar panels; drain liquid; remove supporting wood structure; cap remaining solar water lines; flash around solar tube(s).
- HVAC/Swamp Cooler: Install I&W beneath and downslope of swamp coolers.
- Skylights: Flash with step flashing and valley metal per manufacturer spec.
- Heat Cable: R&R (remove & reset) heat cable if specified.

DOCUMENTATION REQUIREMENTS (Insurance):
- Take photos of flashing and starter shingles during tear-off AND installation.
- Take photos of catch-all system and tarps installed around the home.
- Take mid-roof photos (insurance mandatory).
- Upload all photos to CompanyCam.

MID-ROOF PHOTO CHECKLIST (Insurance + City Code):
- Dry-in (underlayment installed), Roof valley materials installed, Starter course, Metal flashing, Nail pattern (6 nails per shingle), Shingle wrapper showing Class 4/approved shingle.

SAFETY & SITE PROTECTION:
- Use catch-all system and tarps around home.
- Lay plywood over grass, flowers, or walkways when required.
- Leave ladder for 2nd story when required for inspector.
`;

export const CODE_COMPLIANCE_RULES = `
CITY/COUNTY CODE COMPLIANCE GUIDE — BUSINESS RULES

RULE PRIORITY HIERARCHY (always follow this order):
1. 2025 County Roofing Requirements (HIGHEST PRIORITY — never overridden)
2. Customer Contract
3. Insurance Scope (LOWEST — insurance never overrides code)

KEY PRINCIPLE: All projects must comply with local building codes regardless of what insurance does or does not include. Code-required materials must be ordered even if insurance does not list or pay for them.

CORE CODE ELEMENTS TO CHECK:
- Permit requirement (does this city/county require a permit?)
- Mid-roof inspection requirement (must underlayment be inspected before shingles?)
- Ice & Water Shield placement (valleys, eaves, penetrations — varies by jurisdiction)
- Drip edge requirements (eaves and/or rakes — some areas require both)
- Ventilation requirements (ridge vents vs. box vents per local code)
- Decking replacement standards
- Flashing requirements (step flashing, headwall flashing, chimney flashing)

BUSINESS RULES:
- Crew instructions must include all required code-driven installation steps.
- Material lists must include all code-required materials even if insurance does not cover them.
- Missing code-required items must be added to scope and flagged as supplement opportunities.
- Customer contract exclusions cannot remove any element required by code.
- If city requires mid-roof inspection → include mid-roof photos in crew instructions.
`;

export const INSURANCE_SCOPE_MAPPING = `
INSURANCE SCOPE MAPPING — BUSINESS RULES

INSURANCE LINE ITEM CODES AND TASKS:
- RFG 220 (Remove shingles/laminated = Tear-off): Full tear-off to decking. Verify layers match EagleView.
- RFG 221 (Install shingles/laminated): Install shingles per manufacturer. Check Class 4 wrapper.
- RFG IWS (Ice & Water Shield): Install only if code requires or contract specifies. Document tear-off + install. Can be excluded by contract.
- RFG DRP (Drip Edge, R&R): Install at eaves + rakes. Code requires in Denver metro.
- RFG STP (Step Flashing): Install at all walls. Replace only when damaged unless insurance pays.
- RFG H00 (Ridge Vent): Cut-in ridge line. Remove turtle vents unless excluded.
- RFG BOX (Static/Turtle Vent): Install box vents only if ridge vent not used.
- RFG PJ3 (Pipe Jack 1-3"): Replace pipe jacks. Color match to roof.
- RFG PJ4 (Pipe Jack 4-6"): Install large pipe jack. Color match.
- RFG CAP (Exhaust Cap): Replace caps.
- RFG DMO (Detach & Reset): Remove and reset gutters/satellite. Check contract exclusions.
- RFG GUT (Replace gutters): Install per sketch. Many contracts exclude gutters.
- RFG CHM (Chimney flashing): Step & counter flash chimney. Only if siding condition allows.
- RFG DCK (Replace decking): Replace rotten decking. Insurance must approve. Flag as supplement.

CONTRACT EXCLUSION RULES:
- If contract excludes gutters → ignore all insurance gutter items.
- If contract excludes skylights → ignore insurance skylight items.
- If contract excludes solar panels → remove & reset only, no replacement.
- If code requires drip edge → include regardless of insurance coverage.
- If I&W existed → replace same areas unless contract specifies more.
- If no I&W existed → install only if contract or code requires.
- If ridge vent included → remove box/turtle vents unless scope says otherwise.
- If insurance includes item not in contract (e.g., paint) → ignore it.
- If city requires mid-roof inspection → ensure mid-roof photos included in crew instructions.

LABOR ITEMS (common charges to crew):
- Tear-off (per layer, per square)
- Second story charge (if roof is on 2nd story or higher)
- Steep slope charge (if pitch > 8/12)
- Skylight replacement (per unit)
- Chimney flashing (per chimney)
- Gutter replacement (if in scope)
- Satellite dish reset
- Heat cable R&R
- Solar panel removal
- Permit fee (if required by city)
- Mid-roof inspection fee (if required by city)
- Decking replacement (per sheet, if found during tear-off)
`;

export const MATERIAL_LOGIC = `
MATERIAL LOGIC — INCLUSION CONDITIONS AND NOTES

SHINGLES (Field): Always included. Add 10% waste. Class 4 IR preferred. 3 bundles per square.
HIP & RIDGE SHINGLES: Include if Ridge LF + Hip LF > 0. Use 30% extra for waste/short runs. ~31 LF per bundle.
STARTER STRIP: Always include. Min 3 bundles. ~113 LF per bundle.
SYNTHETIC UNDERLAYMENT: Always include. 10 SQ per roll, 5% waste.
ICE & WATER SHIELD: Include if climate/code requires. 6 ft coverage at eaves, 3 ft in valleys. Roll ~200 SF. 5% waste.
DRIP EDGE (RAKE): Include if Rake LF > 0. 30% extra for overlaps/cuts. 10 ft sticks. Color match shingles/metal.
DRIP EDGE (EAVE): Include if Eave LF > 0. Use gutter apron at eave edge. 10 ft sticks. Color match gutters/fascia.
PIPE JACKS: Count from EagleView pipeBoots field. Color match to roof.
RIDGE VENT (4 ft sections): Include only if Ventilation Strategy = Ridge Vent. Not used with box vents.
BOX VENTS (Lomanco 750): Include only if Ventilation Strategy = Box Vents.
COIL NAILS 1-1/4": Always include. ~1 case per 12 SQ.
CAP NAILS (Plastic): Always include. 1 box if ≤25 SQ, 2 boxes if >25 SQ.
GEOCEL 2300 SEALANT: Always include. Min 3 tubes. Formula: CEIL(valleys/40 + (ridges+hips)/60).
STEP FLASHING: Include if sidewall/vertical LF > 0. ~2.64 pieces per vertical LF. 45 pcs per bundle.
TOUCH-UP PAINT: Include when new/visible metal is installed. 2-3 cans per job.
`;
