import Anthropic from '@anthropic-ai/sdk';
import { CREW_INSTRUCTION_RULES, CODE_COMPLIANCE_RULES, INSURANCE_SCOPE_MAPPING, MATERIAL_LOGIC } from './training-data';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

const isPlaceholderKey = () =>
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.includes('your_') ||
  process.env.ANTHROPIC_API_KEY.includes('placeholder');

export async function extractJobData(documents: any[]) {
  if (isPlaceholderKey()) {
    console.warn("Anthropic API Key is a placeholder. Returning mock data.");
    return {
      squares: 30, pitch: "6/12", ridges: 40, hips: 20, valleys: 15,
      rakes: 50, eaves: 60, pipeBoots: 2, vents: 4,
      insuranceCompany: "Mock Insurance Co.", claimNumber: "CLM-99999",
      approvedAmount: "$12,500", deductible: "$1,000",
      customerName: "Jane Doe Testing", address: "456 Test Street, Mock City",
      notes: "Mock extraction - replace API keys with real credentials to get live data.",
      contractType: "Insurance",
    };
  }

  if (!documents || documents.length === 0) {
    console.warn("No document content blocks received. Returning default mock data.");
    return {
      squares: 0, pitch: "N/A", ridges: 0, hips: 0, valleys: 0,
      rakes: 0, eaves: 0, pipeBoots: 0, vents: 0,
      insuranceCompany: "N/A", claimNumber: "N/A",
      approvedAmount: "N/A", deductible: "N/A",
      customerName: "N/A", address: "N/A",
      notes: "No documents found to extract.", contractType: "N/A",
    };
  }

  try {
    const contentBlocks: any[] = [...documents];
    contentBlocks.push({
      type: 'text',
      text: `You are analyzing roofing job documents. Extract all relevant data and return ONLY a valid JSON object. Do NOT wrap in markdown code blocks.

Return this exact structure (use 0 for missing numbers, "N/A" for missing strings):
{
  "squares": number,
  "pitch": string,
  "ridges": number,
  "hips": number,
  "valleys": number,
  "rakes": number,
  "eaves": number,
  "pipeBoots": number,
  "vents": number,
  "insuranceCompany": string,
  "claimNumber": string,
  "approvedAmount": string,
  "deductible": string,
  "customerName": string,
  "address": string,
  "notes": string,
  "contractType": "Insurance" | "Retail",
  "shingleProduct": string,
  "shingleColor": string,
  "hasSkylights": boolean,
  "skylightCount": number,
  "hasHeatCable": boolean,
  "hasChimney": boolean,
  "hasSolarPanels": boolean,
  "ventilationStrategy": "Ridge" | "Box" | "Hybrid" | "N/A",
  "sidewallLF": number
}

Eagle View data takes highest priority for measurements. Extract shingle product/color from the contract. Determine contract type from whether an insurance scope/claim number is present.`
    });

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: 0,
      system: "You are an expert data extractor for roofing contractors. You analyze Eagle View reports, insurance scopes, contracts, permits, and site photos to extract roof measurements and material data. Prioritize Eagle View data when available. Always return valid JSON only — no markdown formatting.",
      messages: [{ role: 'user', content: contentBlocks }]
    });

    const responseContent = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const cleaned = responseContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: any) {
    console.error("Error calling Anthropic (extractJobData):", error?.message || error);
    return {
      squares: 0, pitch: "N/A", ridges: 0, hips: 0, valleys: 0,
      rakes: 0, eaves: 0, pipeBoots: 0, vents: 0,
      insuranceCompany: "N/A", claimNumber: "N/A",
      approvedAmount: "N/A", deductible: "N/A",
      customerName: "N/A", address: "N/A",
      notes: `Extraction error: ${error?.message || 'Unknown error'}`,
      contractType: "N/A",
    };
  }
}

export async function generateOutputDocuments(extractedData: any, calculatedMaterials: any): Promise<{
  crewInstructions: string[];
  laborItems: string[];
  materialNotes: string[];
}> {
  const fallback = { crewInstructions: [], laborItems: [], materialNotes: [] };

  if (isPlaceholderKey()) return fallback;

  try {
    const systemPrompt = `You are an expert roofing project manager (PM) for Reliable Exteriors Group. You generate three production documents for roofing crews based on job details and business rules.

BUSINESS RULES:
${CREW_INSTRUCTION_RULES}

${CODE_COMPLIANCE_RULES}

${INSURANCE_SCOPE_MAPPING}

${MATERIAL_LOGIC}`;

    const jobSummary = `
JOB DETAILS:
- Customer: ${extractedData.customerName || 'N/A'}
- Address: ${extractedData.address || 'N/A'}
- Contract Type: ${extractedData.contractType || 'N/A'}
- Insurance Company: ${extractedData.insuranceCompany || 'N/A'}
- Claim Number: ${extractedData.claimNumber || 'N/A'}
- Pitch: ${extractedData.pitch || 'N/A'}
- Squares: ${extractedData.squares || 0}
- Ridges: ${extractedData.ridges || 0} ft
- Hips: ${extractedData.hips || 0} ft
- Valleys: ${extractedData.valleys || 0} ft
- Rakes: ${extractedData.rakes || 0} ft
- Eaves: ${extractedData.eaves || 0} ft
- Pipe Boots: ${extractedData.pipeBoots || 0}
- Vents: ${extractedData.vents || 0}
- Shingle Product: ${extractedData.shingleProduct || 'N/A'}
- Shingle Color: ${extractedData.shingleColor || 'N/A'}
- Ventilation Strategy: ${extractedData.ventilationStrategy || 'N/A'}
- Has Skylights: ${extractedData.hasSkylights || false} (Count: ${extractedData.skylightCount || 0})
- Has Heat Cable: ${extractedData.hasHeatCable || false}
- Has Chimney: ${extractedData.hasChimney || false}
- Has Solar Panels: ${extractedData.hasSolarPanels || false}
- Sidewall LF: ${extractedData.sidewallLF || 0}
- Job Notes: ${extractedData.notes || 'None'}

CALCULATED MATERIALS:
- Field Shingles: ${calculatedMaterials.shingles} SQ (with 10% waste)
- Hip & Ridge: ${calculatedMaterials.ridgeCap} bundles
- Starter Strip: ${calculatedMaterials.starterStrip} bundles
- Underlayment: ${calculatedMaterials.felt} rolls
- Ice & Water: ${calculatedMaterials.iceAndWater} rolls
- Drip Edge Rake: ${calculatedMaterials.dripEdgeRake} pcs
- Drip Edge Eave: ${calculatedMaterials.dripEdgeEave} pcs
- Pipe Jacks: ${calculatedMaterials.pipeJacks}
- Ridge Vent: ${calculatedMaterials.ridgeVentSections} sections
- Coil Nails: ${calculatedMaterials.coilNails} cases
- Cap Nails: ${calculatedMaterials.capNails} boxes
- Geocel Sealant: ${calculatedMaterials.sealant} tubes

Based on the job details and your business rules, generate the three production documents. Return ONLY valid JSON, no markdown:

{
  "crewInstructions": [
    "Specific instruction 1",
    "Specific instruction 2"
  ],
  "laborItems": [
    "Labor charge item 1",
    "Labor charge item 2"
  ],
  "materialNotes": [
    "Material note 1",
    "Material note 2"
  ]
}

crewInstructions: Specific, actionable steps for the crew (ventilation, I&W, flashing, photos, accessories, safety).
laborItems: Billable labor charges (tear-off layers, story charges, steep slope, skylights, permits, etc.).
materialNotes: Color matches, special products, code-required additions, supplement flags.`;

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: jobSummary }]
    });

    const responseContent = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const cleaned = responseContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      crewInstructions: Array.isArray(parsed.crewInstructions) ? parsed.crewInstructions : [],
      laborItems: Array.isArray(parsed.laborItems) ? parsed.laborItems : [],
      materialNotes: Array.isArray(parsed.materialNotes) ? parsed.materialNotes : [],
    };
  } catch (error: any) {
    console.error("Error calling Anthropic (generateOutputDocuments):", error?.message || error);
    return fallback;
  }
}
