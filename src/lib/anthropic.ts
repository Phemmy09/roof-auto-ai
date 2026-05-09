import Anthropic from '@anthropic-ai/sdk';
import { CREW_INSTRUCTION_RULES, CODE_COMPLIANCE_RULES, INSURANCE_SCOPE_MAPPING, MATERIAL_LOGIC } from './training-data';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

const isPlaceholderKey = () =>
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.includes('your_') ||
  process.env.ANTHROPIC_API_KEY.includes('placeholder');

// Max image size in bytes to send to Claude (1.5 MB base64 ≈ ~1 MB raw image)
// Large site photos are the #1 cause of slow processing — we cap them here
const MAX_IMAGE_BYTES = 1_500_000;

/**
 * Resize image buffer by truncating to MAX_IMAGE_BYTES.
 * Claude can still extract visual information from a compressed/truncated JPEG.
 * For the best speed, images should ideally be compressed before upload.
 */
function capImageBuffer(buffer: Buffer): Buffer {
  if (buffer.length <= MAX_IMAGE_BYTES) return buffer;
  console.warn(`[anthropic] Image truncated from ${(buffer.length / 1024).toFixed(0)}KB to ${(MAX_IMAGE_BYTES / 1024).toFixed(0)}KB for speed`);
  return buffer.subarray(0, MAX_IMAGE_BYTES);
}

/**
 * Single-shot Claude call: extract measurements AND generate crew documents in one pass.
 * Merging both calls cuts total API wait time roughly in half.
 */
export async function processJobWithAI(documents: any[]): Promise<{
  extractedData: any;
  crewInstructions: string[];
  laborItems: string[];
  materialNotes: string[];
}> {
  const emptyExtracted = {
    squares: 0, pitch: 'N/A', ridges: 0, hips: 0, valleys: 0,
    rakes: 0, eaves: 0, pipeBoots: 0, vents: 0,
    insuranceCompany: 'N/A', claimNumber: 'N/A',
    approvedAmount: 'N/A', deductible: 'N/A',
    customerName: 'N/A', address: 'N/A',
    notes: 'No documents found to extract.', contractType: 'N/A',
    shingleProduct: 'N/A', shingleColor: 'N/A',
    hasSkylights: false, skylightCount: 0,
    hasHeatCable: false, hasChimney: false, hasSolarPanels: false,
    ventilationStrategy: 'N/A', sidewallLF: 0,
  };
  const emptyDocs = { crewInstructions: [], laborItems: [], materialNotes: [] };

  if (isPlaceholderKey()) {
    console.warn('[anthropic] API Key is a placeholder — returning mock data.');
    return {
      extractedData: {
        squares: 30, pitch: '6/12', ridges: 40, hips: 20, valleys: 15,
        rakes: 50, eaves: 60, pipeBoots: 2, vents: 4,
        insuranceCompany: 'Mock Insurance Co.', claimNumber: 'CLM-99999',
        approvedAmount: '$12,500', deductible: '$1,000',
        customerName: 'Jane Doe Testing', address: '456 Test Street, Mock City',
        notes: 'Mock extraction — replace API keys with real credentials.',
        contractType: 'Insurance', shingleProduct: 'N/A', shingleColor: 'N/A',
        hasSkylights: false, skylightCount: 0, hasHeatCable: false,
        hasChimney: false, hasSolarPanels: false, ventilationStrategy: 'Ridge', sidewallLF: 0,
      },
      crewInstructions: ['Install per manufacturer specs', 'Take before/after photos'],
      laborItems: ['Standard tear-off'],
      materialNotes: ['Verify shingle color before ordering'],
    };
  }

  if (!documents || documents.length === 0) {
    return { extractedData: emptyExtracted, ...emptyDocs };
  }

  const systemPrompt = `You are an expert roofing project manager and data extractor for Reliable Exteriors Group.

BUSINESS RULES FOR CREW DOCUMENTS:
${CREW_INSTRUCTION_RULES}
${CODE_COMPLIANCE_RULES}
${INSURANCE_SCOPE_MAPPING}
${MATERIAL_LOGIC}`;

  const userPrompt = `Analyze the provided roofing job documents and return ONE JSON object with two sections.

Return ONLY valid JSON — no markdown, no explanation, no code blocks.

{
  "extracted": {
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
  },
  "documents": {
    "crewInstructions": ["instruction 1", "instruction 2"],
    "laborItems": ["labor item 1", "labor item 2"],
    "materialNotes": ["note 1", "note 2"]
  }
}

Rules:
- Eagle View data takes highest priority for measurements
- Use 0 for missing numbers, "N/A" for missing strings
- crewInstructions: specific actionable crew steps (ventilation, I&W, flashing, photos, safety)
- laborItems: billable charges (tear-off layers, story charges, steep slope, skylights, permits)
- materialNotes: color matches, special products, code additions, supplement flags`;

  try {
    const contentBlocks: any[] = [...documents, { type: 'text', text: userPrompt }];

    console.log(`[anthropic] Sending ${documents.length} document(s) to Claude in a single call...`);
    const startTime = Date.now();

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[anthropic] Response received in ${elapsed}s (stop_reason: ${msg.stop_reason})`);

    // Detect truncated output — Claude hit max_tokens before finishing
    if (msg.stop_reason === 'max_tokens') {
      console.warn('[anthropic] WARNING: Response was truncated (max_tokens reached). Output may be incomplete.');
    }

    const rawText = msg.content && msg.content.length > 0 && msg.content[0].type === 'text'
      ? msg.content[0].text
      : '{}';
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr: any) {
      // Trim to last complete closing brace (handles max_tokens truncation)
      console.warn(`[anthropic] JSON parse failed: ${parseErr.message} — attempting repair...`);
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace >= 0) {
        try {
          parsed = JSON.parse(cleaned.substring(0, lastBrace + 1));
          console.log('[anthropic] JSON repair successful (trimmed to last closing brace)');
        } catch {
          console.error('[anthropic] JSON repair failed — returning defaults');
          parsed = { extracted: {}, documents: {} };
        }
      } else {
        console.error('[anthropic] No closing brace found in response — returning defaults');
        parsed = { extracted: {}, documents: {} };
      }
    }

    const extractedData = parsed.extracted || emptyExtracted;
    const docs = parsed.documents || {};

    return {
      extractedData,
      crewInstructions: Array.isArray(docs.crewInstructions) ? docs.crewInstructions : [],
      laborItems: Array.isArray(docs.laborItems) ? docs.laborItems : [],
      materialNotes: Array.isArray(docs.materialNotes) ? docs.materialNotes : [],
    };
  } catch (error: any) {
    console.error('[anthropic] Error:', error?.status, error?.message || error);
    throw new Error(`Claude AI error: ${error?.message || 'Unknown error'}`);
  }
}

// ─── Legacy exports kept for backwards compatibility ───────────────────────

export async function extractJobData(documents: any[]) {
  const result = await processJobWithAI(documents);
  return result.extractedData;
}

export async function generateOutputDocuments(_extractedData: any, _calculatedMaterials: any) {
  // This is now a no-op stub — processJobWithAI handles both in one call
  // Called from process-job route after processJobWithAI, returns empty (already populated)
  return { crewInstructions: [], laborItems: [], materialNotes: [] };
}

export { capImageBuffer };
