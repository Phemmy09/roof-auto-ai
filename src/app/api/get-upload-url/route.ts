import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { filename } = await request.json();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'roof-documents';
    
    // Check for dummy config
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return NextResponse.json({ 
        signedUrl: 'mock-url', 
        token: 'mock-token', 
        path: `jobs/mock_${filename}` 
      });
    }

    const path = `jobs/${Date.now()}_${filename.replace(/[^a-z0-9.]/gi, '_')}`;
    
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
       console.error("Error creating signed url", error);
       return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      signedUrl: data.signedUrl, 
      token: data.token, 
      path: data.path 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
