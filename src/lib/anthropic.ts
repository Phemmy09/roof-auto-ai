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
      customerName: "Jane Doe Testing",
      address: "456 Test Street, Mock City"
    };
  }

  try {
    const contentBlocks: any[] = documents.map(doc => {
      if (doc.type === 'document') {
        return { type: 'document', source: { type: 'base64', media_type: doc.mediaType, data: doc.data } };
      } else if (doc.type === 'image') {
        return { type: 'image', source: { type: 'base64', media_type: doc.mediaType, data: doc.data } };
      } else if (doc.type === 'text') {
        return { type: 'text', text: doc.text };
      }
    }).filter(Boolean);

    contentBlocks.push({
      type: 'text',
      text: `Extract details from these provided documents and return ONLY a JSON object exactly matching this structure (no markdown tags or explanation):
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
}`
    });

    const msg = await anthropic.beta.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      betas: ["pdfs-2024-09-25"], // Required for PDF support
      max_tokens: 2000,
      temperature: 0,
      system: "You are an expert data extractor for roofing contractors. You extract materials, dimensions, and damages from document text (Eagle View, Insurance, Contracts, Permits). Prioritize Eagle View data when available. Return ONLY raw JSON without markdown blocks.",
      messages: [ { role: 'user', content: contentBlocks } ]
    });

    const responseContent = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    const cleaned = responseContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Error calling Anthropic:", error);
    throw new Error("Failed to extract data via Anthropic.");
  }
}
