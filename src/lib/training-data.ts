// Business rules extracted from the 5 training data documents.
// These are embedded as constants so they work on Vercel (no file I/O at runtime).

export const CREW_INSTRUCTION_RULES = `
CREW INSTRUCTION MASTER TEMPLATE — BUSINESS RULES

PROPERTY SCOPE: Select one — House/Garage/Shed, House & Garage, House & Shed, House Only.

ICE & WATER SHIELD (I&W) CALCULATION HIERARCHY & RULES:
Always calculate the required rolls of I&W using this exact hierarchy, showing your math:
1. Calculate eave code requirement using EagleView:
   - Formula: Eave LF × required coverage width (standard 3 ft, or 6 ft if mountain/double row) × pitch slope factor.
   - Only apply if local code or location indicates eave coverage is required.
2. Add I&W around required penetrations:
   - Skylights: Add 30 sq ft per skylight unit.
   - Solar tubes: Add 15 sq ft per solar tube unit.
   - Chimneys: Add 20 sq ft per chimney.
   - Other roof penetrations requiring membrane: Add 10 sq ft each.
3. Add previously covered I&W areas from the SOW:
   - If the SOW states that I&W was existing, replace all previously covered areas in addition to any current code-required locations.
   - Valleys: Valley LF × 3 ft × pitch slope factor.
   - Eaves: Eave LF × 3 ft (or 6 ft if double) × pitch slope factor.
4. Add waste/overlap:
   - Add 10–15% for laps, cuts, wrapping, and install waste to the total square footage.
5. Convert to rolls:
   - Divide total required square footage by 200 sq ft (standard roll coverage) and round up to the next whole roll.
Show the step-by-step calculations in the description/notes section, and output the final roll count clearly (e.g. "Order minimum X rolls total"). The calculated quantity must be reflected in the material order form.
Pitch slope factors reference:
   - 3/12: 1.03 | 4/12: 1.05 | 5/12: 1.08 | 6/12: 1.12 | 7/12: 1.16 | 8/12: 1.20 | 9/12: 1.25 | 10/12: 1.30 | 11/12: 1.36 | 12/12: 1.41


VENTILATION REQUIREMENTS:
- Ridge Vent: Cut-in ridge line per sketch. Remove old turtle vents if ridge vent replaces them. Install ridge vent sections per material order. Seal old vent holes with SmartPlugs if needed.
- Static/Box Vents: Install per reconciled count (following 1. Insurance Scope, 2. SOW, 3. Photos hierarchy) IF ventilation strategy = Box Vents. Remove outdated vents and cap holes.
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
SYNTHETIC UNDERLAYMENT: Always include. 10 SQ per roll, 5% waste. Account for double-felt city/county code requirements (e.g., doubles underlayment quantity).
ICE & WATER SHIELD: Calculate using the I&W Calculation Hierarchy (Eave code requirement + penetrations + existing I&W from SOW + 10-15% waste, divided by 200 sq ft per roll). Show calculations in description and ensure the quantity matches the Material Order Form.
DRIP EDGE (RAKE): Include if Rake LF > 0. 30% extra for overlaps/cuts. 10 ft sticks. Color match shingles/metal.
DRIP EDGE (EAVE): Include if Eave LF > 0. Use gutter apron at eave edge. 10 ft sticks. Color match gutters/fascia.
PIPE JACKS: Extract using source hierarchy (1. Insurance Scope, 2. SOW, 3. Photos). Color match to roof. Do NOT use EagleView as the primary source of truth.
RIDGE VENT (4 ft sections): Include only if Ventilation Strategy = Ridge Vent. Use source hierarchy (1. Ventilation Scope Sheet, 2. SOW, 3. EagleView ridge measurements, 4. Photos for validation). The ventilation scope sheet always overrides EagleView ridge measurements when both are available.
BOX VENTS (Lomanco 750) / TURTLE VENTS / EXHAUST VENTS / POWER VENTS / TURBINES / OTHER ROOF PENETRATIONS: Extract using source hierarchy (1. Insurance Scope, 2. SOW, 3. Photos). Do NOT use EagleView as the primary source of truth. Include box/turtle vents only if Ventilation Strategy is Box or Hybrid (or for exhaust caps/power vents/turbines/other penetrations, as specified by those documents).
COIL NAILS 1-1/4": Always include. ~1 case per 12 SQ.
CAP NAILS (Plastic): Always include. 1 box if ≤25 SQ, 2 boxes if >25 SQ.
GEOCEL 2300 SEALANT: Always include. Min 3 tubes. Formula: CEIL(valleys/40 + (ridges+hips)/60). Include additional tubes of Geocel if box vents, turtle vents, exhaust vents, power vents, turbines, step flashing, counter flashing, valley metal, or other metal components are added.
STEP FLASHING: Include if sidewall/vertical LF > 0. Calculate at approximately 1 piece per shingle course (~2.4 pieces per linear foot of sidewall/vertical wall). 45 pcs per bundle. Ensure quantities appear in both the description and the material order summary.
COUNTER FLASHING: Automatically include counter flashing (unit: pc) if a chimney, masonry wall, or roof-to-wall condition is identified.
TOUCH-UP PAINT: Include when new/visible metal is installed. 2-3 cans per job base. Automatically include 1 additional can of touch-up paint if additional metal components are added (step flashing, counter flashing, drip edge, valley metal, exhaust vents, power vents, turbines, etc.). Check SOW notes for project-specific paint requirements.
SKYLIGHTS: If skylights are present, automatically include valley metal rolls (specification: 20” x 50’ rolls).
TURTLE VENT REMOVAL: If turtle vents are being removed, include 7/16” OSB sheathing. Quantity: 1 sheet of 7/16” OSB per turtle vent/box vent removed.
VALLEYS: For all roof valleys, include Mule-Hide JTS1 Joint Sealant.

`;

