import { NextRequest, NextResponse } from 'next/server';
import { uploadBinFile } from '@/lib/storage/bin-storage';

// Upload binary file endpoint
export async function POST(request: NextRequest) {
  try {
    // Get the binary data from request body
    const arrayBuffer = await request.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: 'Empty file received' },
        { status: 400 }
      );
    }

    // Get optional filename from query params or header
    const filename = request.nextUrl.searchParams.get('filename') || 
                    request.headers.get('x-filename') ||
                    undefined;

    // Check if OTA parsing should be disabled
    const disableOTAParser = request.nextUrl.searchParams.get('disableOTAParser') === 'true';

    // Upload to Supabase
    const result = await uploadBinFile(buffer, filename, !disableOTAParser);

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileName: result.fileName,
        filePath: result.filePath,
        size: buffer.length,
        version: result.metadata?.version,
        projectName: result.metadata?.projectName,
      },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
