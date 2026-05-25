import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json({ error: 'filename is required' }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'roof-documents';
    
    // Check for dummy config
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return NextResponse.json({ 
        signedUrl: 'mock-url', 
        token: 'mock-token', 
        path: `jobs/mock_${filename}` 
      });
    }

    // Sanitize filename: keep alphanumeric, dots, dashes, underscores
    const safeName = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `jobs/${Date.now()}_${safeName}`;
    
    // Retry loop for transient Supabase socket errors
    let lastError: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUploadUrl(path);

        if (error) {
          lastError = error;
          // Retry on socket/fetch errors, fail fast on permission/auth errors
          if (error.message?.includes('fetch failed') || error.message?.includes('socket')) {
            console.warn(`[get-upload-url] Attempt ${attempt}/${MAX_RETRIES} failed (socket error) — retrying...`);
            await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
            continue;
          }
          // Non-retryable error
          console.error('[get-upload-url] Supabase error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Success — return the signed URL
        return NextResponse.json({ 
          signedUrl: data.signedUrl,
          token: data.token,
          path: data.path,
        });
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[get-upload-url] Attempt ${attempt}/${MAX_RETRIES} exception — retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    console.error('[get-upload-url] All retries failed:', lastError?.message);

    // As a resilient fallback for development, return a mock URL if Supabase is offline/paused
    if (process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
      console.warn('[get-upload-url] Resilient fallback: Returning mock URL for local/development run.');
      return NextResponse.json({ 
        signedUrl: 'mock-url', 
        token: 'mock-token', 
        path: `jobs/mock_${filename}` 
      });
    }

    return NextResponse.json({ error: lastError?.message || 'Upload URL generation failed after retries' }, { status: 500 });
  } catch (error: any) {
    console.error('[get-upload-url] Unexpected error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
