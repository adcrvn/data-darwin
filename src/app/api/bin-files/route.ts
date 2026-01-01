import { NextRequest, NextResponse } from 'next/server';
import {
  getLatestBinFile,
  getBinFileByName,
  listBinFiles
} from '@/lib/storage/bin-storage';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get('name');
    const latest = searchParams.get('latest') === 'true';
    const download = searchParams.get('download') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get latest file, optionally matching a device name
    if (latest) {
      let latestFile = null;
      if (fileName) {
        // Find the most recent file for the specified device (Transmitter_AP or Receiver_ST)
        // Files are sorted by created_at DESC, so first match is the latest
        const allFiles = await listBinFiles(100, 0);
        latestFile = allFiles.find(f => {
          // Prefer exact projectName match (more reliable)
          if (f.projectName?.toLowerCase() === fileName.toLowerCase()) {
            return true;
          }
          // Fallback: check if filename starts with the device name
          return f.name.toLowerCase().startsWith(fileName.toLowerCase() + '_');
        });
      } else {
        latestFile = await getLatestBinFile();
      }

      if (!latestFile) {
        return NextResponse.json(
          { error: fileName ? `No firmware found for device: ${fileName}` : 'No files found' },
          { status: 404 }
        );
      }

      // If download is requested, fetch and return the file
      if (download) {
        const fileData = await getBinFileByName(latestFile.name);
        if (!fileData) {
          return NextResponse.json(
            { error: 'File not found' },
            { status: 404 }
          );
        }
        return new NextResponse(Buffer.from(fileData), {
          headers: {
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${latestFile.name}"`,
            'Content-Length': fileData.length.toString(),
          },
        });
      }

      // Return metadata only
      return NextResponse.json({
        success: true,
        data: latestFile,
      });
    }

    // Get specific file by name or partial name
    if (fileName) {
      // Try exact match first
      let fileData = await getBinFileByName(fileName);
      let resolvedName = fileName;

      // If not found, try partial match (most recent file containing the string)
      if (!fileData) {
        const allFiles = await listBinFiles(100, 0); // Increase limit if needed
        // Find most recent file whose name includes the search string (case-insensitive)
        const match = allFiles.find(f => f.name.toLowerCase().includes(fileName.toLowerCase()));
        if (match) {
          fileData = await getBinFileByName(match.name);
          resolvedName = match.name;
        }
      }

      if (!fileData) {
        return NextResponse.json(
          { error: 'File not found' },
          { status: 404 }
        );
      }

      return new NextResponse(Buffer.from(fileData), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${resolvedName}"`,
          'Content-Length': fileData.length.toString(),
        },
      });
    }

    // List all files (default)
    const files = await listBinFiles(limit, offset);

    return NextResponse.json({
      success: true,
      data: files,
      pagination: {
        limit,
        offset,
        count: files.length,
      },
    });

  } catch (error) {
    console.error('Retrieval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to retrieve file(s)',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
