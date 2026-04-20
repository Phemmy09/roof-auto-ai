import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

export async function extractJobData(documents: any[]) {
  // Gracefully fallback to mock data if the user has a placeholder or empty API Key
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_') || process.env.ANTHROPIC_API_KEY.includes('placeholder')) {
    console.warn("Anthropic API Key is a placeholder. Returning mock data.");
    return {
      squares: 30,
      pitch: "6/12",
      ridges: 40,
      hips: 20,
      valleys: 15,
      rakes: 50,
      eaves: 60,
      pipeBoots: 2,
      vents: 4,
      insuranceCompany: "Mock Insurance Co.",
      claimNumber: "CLM-99999",
      approvedAmount: "$12,500",
      deductible: "$1,000",
      customerName: "Jane Doe Testing",
      address: "456 Test Street, Mock City",
      notes: "Mock extraction — replace API keys with real credentials to get live data."
    };
  }

  // If no documents were provided (empty array), still return mock data
  if (!documents || documents.length === 0) {
    console.warn("No document content blocks received. Returning default mock data.");
    return {
      squares: 0, pitch: "N/A", ridges: 0, hips: 0, valleys: 0,
      rakes: 0, eaves: 0, pipeBoots: 0, vents: 0,
      insuranceCompany: "N/A", claimNumber: "N/A",
      approvedAmount: "N/A", deductible: "N/A",
      customerName: "N/A", address: "N/A",
      notes: "No documents found to extract."
    };
  }

  try {
    // Build content blocks — documents already arrive in correct Anthropic format from the route
    const contentBlocks: any[] = [...documents];

    contentBlocks.push({
      type: 'text',
      text: `You are analyzing roofing job documents. The documents may include Eagle View reports (PDFs with roof measurements and diagrams), insurance scope documents, signed contracts, city permits, and job site photos.

Extract all relevant data and return ONLY a valid JSON object matching this exact structure. If a field is not found, use 0 for numbers and "N/A" for strings. Do NOT wrap in markdown code blocks:

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
  "notes": string
}

IMPORTANT: For images showing roof diagrams or measurements, extract any visible numbers. For PDFs with tables, extract from structured data. Eagle View data takes highest priority.`
    });

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      system: "You are an expert data extractor for roofing contractors. You analyze Eagle View reports, insurance scopes, contracts, permits, and site photos to extract roof measurements and material data. You can read tables, diagrams, and images. Prioritize Eagle View data when available. Always return valid JSON only — no markdown formatting.",
      messages: [ { role: 'user', content: contentBlocks } ]
    });

    const responseContent = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    // Clean any accidental markdown wrapping
    const cleaned = responseContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error: any) {
    console.error("Error calling Anthropic:", error?.message || error);
    // Return empty data rather than crashing the whole pipeline
    return {
      squares: 0, pitch: "N/A", ridges: 0, hips: 0, valleys: 0,
      rakes: 0, eaves: 0, pipeBoots: 0, vents: 0,
      insuranceCompany: "N/A", claimNumber: "N/A",
      approvedAmount: "N/A", deductible: "N/A",
      customerName: "N/A", address: "N/A",
      notes: `Extraction error: ${error?.message || 'Unknown error'}`
    };
  }
}
