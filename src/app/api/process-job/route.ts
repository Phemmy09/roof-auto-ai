import { NextResponse } from 'next/server';
import { extractJobData } from '@/lib/anthropic';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePDFBuffer } from '@/lib/pdf';
import { sendJobPDF } from '@/lib/email';
import { calculateAllMaterials } from '@/lib/formulas';

export const maxDuration = 60;

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
    const formData = await request.formData();
    const customerName = formData.get('customerName') as string || 'Test Customer';
    const address = formData.get('address') as string || '123 Test St';
    const email = formData.get('email') as string || 'test@example.com';
    const notes = formData.get('notes') as string || '';
    const files = formData.getAll('files') as File[];
    
    const MAX_SIZE = 10 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return setCors(NextResponse.json({ error: `File ${file.name} exceeds 10MB limit.` }, { status: 400 }), origin);
      }
    }

    const blobUrls: string[] = [];
    const documentContents: any[] = [];
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'roof-documents';
    
    // Check if using placeholder URL to bypass throwing network errors
    const isMock = !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project');

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filename = `jobs/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
      
      if (!isMock) {
        try {
          const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(filename, buffer, { contentType: file.type });
          if (!uploadError) {
             const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filename);
             blobUrls.push(data.publicUrl);
          }
        } catch (e) {
          console.error("Supabase Storage error:", e);
        }
      } else {
        blobUrls.push('https://mock-storage.link/' + filename);
      }

      if (file.type === 'application/pdf') {
        documentContents.push({ type: 'document', mediaType: 'application/pdf', data: buffer.toString('base64') });
      } else if (file.type.startsWith('image/')) {
        documentContents.push({ type: 'image', mediaType: file.type === 'image/jpg' ? 'image/jpeg' : file.type, data: buffer.toString('base64') });
      } else if (file.type === 'text/plain') {
        documentContents.push({ type: 'text', text: buffer.toString('utf-8') });
      }
    }

    const extractedData = await extractJobData(documentContents);
    const data = extractedData || {};
    const calculatedMaterials = await calculateAllMaterials(data);

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
          blob_urls: blobUrls
        }])
        .select()
        .single();

      if (jobError) console.error("Error creating job in Supabase:", jobError);
      if (job) jobId = job.id;

      // Dynamic 10-Minute TTL Auto-Cleanup strategy
      const tenMinsAgo = new Date(Date.now() - 10 * 60000).toISOString();
      supabaseAdmin.from('jobs').delete().lt('created_at', tenMinsAgo).then(({ error }) => {
         if (error) console.error("Auto Cleanup Failed:", error);
      });
    }

    const pdfBuffer = await generatePDFBuffer({ ...data, customerName, address }, calculatedMaterials);
    const emailResult = await sendJobPDF(email, pdfBuffer, customerName);

    return setCors(NextResponse.json({ 
       success: true, 
       jobId,
       extractedData: data, 
       calculatedMaterials,
       emailSent: emailResult.success,
       pdfBase64: pdfBuffer.toString('base64')
    }), origin);

  } catch (error: any) {
    console.error("Process Job Error:", error);
    return setCors(NextResponse.json({ error: error.message || "An error occurred." }, { status: 500 }), origin);
  }
}
