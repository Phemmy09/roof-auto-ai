import { NextResponse } from 'next/server';
import { generatePDFBuffer } from '@/lib/pdf';
import { sendJobPDF } from '@/lib/email';

export const maxDuration = 60;

function setCors(response: NextResponse, requestOrigin?: string) {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
  const origin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

export async function OPTIONS(request: Request) {
  return setCors(NextResponse.json({}), request.headers.get('origin') || undefined);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin') || undefined;
  try {
    const {
      customerName,
      address,
      email,
      extractedData,
      calculatedMaterials,
      crewInstructions,
      laborItems,
      materialNotes,
    } = await request.json();

    const pdfBuffer = await generatePDFBuffer(
      { ...(extractedData || {}), customerName, address },
      calculatedMaterials,
      crewInstructions || [],
      laborItems || [],
      materialNotes || [],
    );

    let emailSent = false;
    if (email) {
      const result = await sendJobPDF(email, pdfBuffer, customerName || 'Customer');
      emailSent = result.success;
      if (!result.success) {
        console.warn('[generate-pdf] Email failed:', result.error);
      }
    }

    return setCors(
      NextResponse.json({ success: true, pdfBase64: pdfBuffer.toString('base64'), emailSent }),
      origin,
    );
  } catch (error: any) {
    console.error('[generate-pdf] Error:', error.message);
    return setCors(
      NextResponse.json({ error: error.message || 'Failed to generate PDF.' }, { status: 500 }),
      origin,
    );
  }
}
