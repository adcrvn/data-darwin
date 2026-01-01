import { supabase } from './supabase-storage';
import { generateOTAFilename, parseOTAMetadata } from '../utils/ota-parser';

const BIN_BUCKET = 'binary-files';

// Type for Supabase storage file object
interface FileObject {
  name: string;
  id: string | null;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, any> | null;
}

export interface BinFileMetadata {
  name: string;
  path: string;
  size: number;
  created_at: string;
  updated_at: string;
  version?: string;
  projectName?: string;
}

/**
 * Upload a binary file to Supabase storage
 */
export async function uploadBinFile(
  fileBuffer: Uint8Array | ArrayBuffer,
  originalName?: string,
  useOTAParser: boolean = true
): Promise<{ success: boolean; filePath: string; fileName: string; metadata?: any }> {
  try {
    let fileName: string;
    let otaMetadata = null;

    // Try to extract OTA metadata if enabled
    if (useOTAParser) {
      otaMetadata = parseOTAMetadata(fileBuffer);
      fileName = generateOTAFilename(fileBuffer, originalName);
    } else {
      // Fallback to simple timestamp-based naming
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fileName = originalName 
        ? `${timestamp}_${originalName}`
        : `${timestamp}.bin`;
    }
    
    const filePath = `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BIN_BUCKET)
      .upload(filePath, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    return {
      success: true,
      filePath: data.path,
      fileName,
      metadata: otaMetadata,
    };
  } catch (error) {
    console.error('Error uploading bin file:', error);
    throw error;
  }
}

/**
 * Parse metadata from filename
 * Extracts version and project name from OTA-generated filenames
 */
function parseFilenameMetadata(fileName: string): { version?: string; projectName?: string } {
  const metadata: { version?: string; projectName?: string } = {};
  
  // Try to extract version (format: v1.0.5)
  const versionMatch = fileName.match(/v(\d+\.\d+\.\d+)/);
  if (versionMatch) {
    metadata.version = versionMatch[1];
  }
  
  // Try to extract project name (before version or timestamp)
  const projectMatch = fileName.match(/^([^_]+)_v\d+\.\d+\.\d+/);
  if (projectMatch) {
    metadata.projectName = projectMatch[1];
  }
  
  return metadata;
}

/**
 * Get the latest uploaded binary file
 */
export async function getLatestBinFile(): Promise<BinFileMetadata | null> {
  try {
    const { data, error } = await supabase.storage
      .from(BIN_BUCKET)
      .list('uploads', {
        limit: 1,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return null;
    }

    const file = data[0];
    const filenameMetadata = parseFilenameMetadata(file.name);
    
    return {
      name: file.name,
      path: `uploads/${file.name}`,
      size: file.metadata?.size || 0,
      created_at: file.created_at,
      updated_at: file.updated_at,
      ...filenameMetadata,
    };
  } catch (error) {
    console.error('Error getting latest bin file:', error);
    throw error;
  }
}

/**
 * Get a binary file by name
 */
export async function getBinFileByName(fileName: string): Promise<Uint8Array | null> {
  try {
    const filePath = fileName.startsWith('uploads/') 
      ? fileName 
      : `uploads/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BIN_BUCKET)
      .download(filePath);

    if (error) {
      throw new Error(`Download failed: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return new Uint8Array(await data.arrayBuffer());
  } catch (error) {
    console.error('Error downloading bin file:', error);
    throw error;
  }
}

/**
 * List all binary files
 */
export async function listBinFiles(
  limit: number = 50,
  offset: number = 0
): Promise<BinFileMetadata[]> {
  try {
    const { data, error } = await supabase.storage
      .from(BIN_BUCKET)
      .list('uploads', {
        limit,
        offset,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    return (data || []).map((file: FileObject) => {
      const filenameMetadata = parseFilenameMetadata(file.name);
      
      return {
        name: file.name,
        path: `uploads/${file.name}`,
        size: file.metadata?.size || 0,
        created_at: file.created_at,
        updated_at: file.updated_at,
        ...filenameMetadata,
      };
    });
  } catch (error) {
    console.error('Error listing bin files:', error);
    throw error;
  }
}

/**
 * Delete a binary file
 */
export async function deleteBinFile(fileName: string): Promise<boolean> {
  try {
    const filePath = fileName.startsWith('uploads/') 
      ? fileName 
      : `uploads/${fileName}`;

    const { error } = await supabase.storage
      .from(BIN_BUCKET)
      .remove([filePath]);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting bin file:', error);
    throw error;
  }
}
