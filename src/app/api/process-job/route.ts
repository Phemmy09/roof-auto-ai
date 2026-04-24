import { NextResponse } from 'next/server';
import { extractJobData, generateOutputDocuments } from '@/lib/anthropic';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePDFBuffer } from '@/lib/pdf';
import { sendJobPDF } from '@/lib/email';
import { calculateAllMaterials } from '@/lib/formulas';

export const maxDuration = 300;

function setCors(response: NextResponse, requestOrigin?: string) {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export async function OPTIONS(request: Request) {
  return setCors(NextResponse.json({}), request.headers.get('origin') || undefined);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin') || undefined;

  try {
    const payload = await request.json();
    const customerName = payload.customerName as string || 'Test Customer';
    const address = payload.address as string || '123 Test St';
    const email = payload.email as string || 'test@example.com';
    const notes = payload.notes as string || '';
    const uploadedFiles = payload.uploadedFiles as any[] || [];

    const blobUrls: string[] = [];
    const documentContents: any[] = [];
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'roof-documents';
    const isMock = !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project');

    // Download all files in parallel
    await Promise.all(uploadedFiles.map(async (file) => {
      let buffer: Buffer | null = null;

      if (!isMock) {
        try {
          const { data, error } = await supabaseAdmin.storage.from(bucket).download(file.path);
          if (data) {
            buffer = Buffer.from(await data.arrayBuffer());
          } else {
            console.error("Storage download failed:", error);
          }
          const { data: pubData } = supabaseAdmin.storage.from(bucket).getPublicUrl(file.path);
          blobUrls.push(pubData.publicUrl);
        } catch (e) {
          console.error("Supabase Storage error:", e);
        }
      } else {
        blobUrls.push('https://mock-storage.link/' + file.name);
      }

      if (isMock || !buffer) return;

      const mime = file.mimeType || '';
      if (mime === 'application/pdf') {
        documentContents.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } });
      } else if (mime.startsWith('image/')) {
        const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
        documentContents.push({ type: 'image', source: { type: 'base64', media_type: normalizedMime, data: buffer.toString('base64') } });
      } else if (mime === 'text/plain') {
        documentContents.push({ type: 'text', text: buffer.toString('utf-8') });
      } else if (mime.includes('wordprocessingml') || mime === 'application/msword' || mime.includes('officedocument')) {
        const textContent = buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
        if (textContent.length > 50) {
          documentContents.push({ type: 'text', text: `[Content from Word document: ${file.name}]\n${textContent}` });
        }
      }
    }));

    // Step 1: Extract measurements from documents
    const extractedData = await extractJobData(documentContents);
    const data = extractedData || {};
    const calculatedMaterials = await calculateAllMaterials(data);

    // Step 2: Generate three output documents using business rules
    const outputDocs = await generateOutputDocuments(data, calculatedMaterials);

    let jobId = 'mock-job-id-' + Date.now();

    if (!isMock) {
      const { data: job, error: jobError } = await supabaseAdmin
        .from('jobs')
        .insert([{
          customer_name: customerName,
          address,
          email,
          notes,
          extracted_data: data,
          calculated_materials: calculatedMaterials,
        }])
        .select()
        .single();

      if (jobError) console.error("Error creating job in Supabase:", jobError);
      if (job) jobId = job.id;

      const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
      supabaseAdmin.from('jobs').delete().lt('created_at', tenMinsAgo).then(({ error }) => {
        if (error) console.error("Auto Cleanup Failed:", error);
      });
    }

    const pdfBuffer = await generatePDFBuffer(
      { ...data, customerName, address },
      calculatedMaterials,
      outputDocs.crewInstructions,
      outputDocs.laborItems,
      outputDocs.materialNotes
    );
    const emailResult = await sendJobPDF(email, pdfBuffer, customerName);

    return setCors(NextResponse.json({
      success: true,
      jobId,
      extractedData: data,
      calculatedMaterials,
      crewInstructions: outputDocs.crewInstructions,
      laborItems: outputDocs.laborItems,
      materialNotes: outputDocs.materialNotes,
      emailSent: emailResult.success,
      pdfBase64: pdfBuffer.toString('base64')
    }), origin);

  } catch (error: any) {
    console.error("Process Job Error:", error);
    return setCors(NextResponse.json({ error: error.message || "An error occurred." }, { status: 500 }), origin);
  }
}
