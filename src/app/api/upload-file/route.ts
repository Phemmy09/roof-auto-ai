import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'roof-documents';
    const isMock = !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project');

    if (isMock) {
      return NextResponse.json({ path: `jobs/mock_${file.name}` });
    }

    const path = `jobs/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_')}`;
    const arrayBuffer = await file.arrayBuffer();

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false });

    if (error) {
      console.error('Storage upload error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ path: data.path });
  } catch (error: any) {
    console.error('upload-file error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
