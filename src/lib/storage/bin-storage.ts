import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { generateOTAFilename, parseOTAMetadata } from '../utils/ota-parser';

// S3 client configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "smarthome-radar-radar-data-802738533039";

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
 * Upload a binary file to S3 storage
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

    const filePath = `binary-files/uploads/${fileName}`;

    // Convert to Buffer if needed
    const buffer = fileBuffer instanceof ArrayBuffer
      ? Buffer.from(fileBuffer)
      : Buffer.from(fileBuffer);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
      Body: buffer,
      ContentType: 'application/octet-stream',
    });

    await s3Client.send(command);

    return {
      success: true,
      filePath,
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
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'binary-files/uploads/',
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return null;
    }

    // Sort by LastModified descending
    const sortedFiles = response.Contents
      .filter(obj => obj.Key && obj.Key !== 'binary-files/uploads/') // Filter out the folder itself
      .sort((a, b) => {
        const timeA = a.LastModified?.getTime() || 0;
        const timeB = b.LastModified?.getTime() || 0;
        return timeB - timeA;
      });

    if (sortedFiles.length === 0) {
      return null;
    }

    const file = sortedFiles[0];
    const fileName = file.Key?.split('/').pop() || '';
    const filenameMetadata = parseFilenameMetadata(fileName);

    return {
      name: fileName,
      path: file.Key || '',
      size: file.Size || 0,
      created_at: file.LastModified?.toISOString() || new Date().toISOString(),
      updated_at: file.LastModified?.toISOString() || new Date().toISOString(),
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
    const filePath = fileName.startsWith('binary-files/uploads/')
      ? fileName
      : `binary-files/uploads/${fileName}`;

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      return null;
    }

    // Convert stream to Uint8Array
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
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
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'binary-files/uploads/',
    });

    const response = await s3Client.send(command);

    if (!response.Contents || response.Contents.length === 0) {
      return [];
    }

    // Filter out the folder itself and sort by LastModified descending
    const sortedFiles = response.Contents
      .filter(obj => obj.Key && obj.Key !== 'binary-files/uploads/')
      .sort((a, b) => {
        const timeA = a.LastModified?.getTime() || 0;
        const timeB = b.LastModified?.getTime() || 0;
        return timeB - timeA;
      });

    // Apply offset and limit
    const paginatedFiles = sortedFiles.slice(offset, offset + limit);

    return paginatedFiles.map(file => {
      const fileName = file.Key?.split('/').pop() || '';
      const filenameMetadata = parseFilenameMetadata(fileName);

      return {
        name: fileName,
        path: file.Key || '',
        size: file.Size || 0,
        created_at: file.LastModified?.toISOString() || new Date().toISOString(),
        updated_at: file.LastModified?.toISOString() || new Date().toISOString(),
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
    const filePath = fileName.startsWith('binary-files/uploads/')
      ? fileName
      : `binary-files/uploads/${fileName}`;

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filePath,
    });

    await s3Client.send(command);

    return true;
  } catch (error) {
    console.error('Error deleting bin file:', error);
    throw error;
  }
}
