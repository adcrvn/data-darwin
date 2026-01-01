/**
 * OTA Binary File Parser
 * Extracts version and metadata from OTA firmware files
 */

export interface OTAMetadata {
  version: string | null;
  projectName: string | null;
}

/**
 * Extract version string from OTA binary file
 * Typically located at offset 48-64 in ESP32 OTA binaries
 */
export function extractOTAVersion(buffer: Uint8Array | ArrayBuffer): string | null {
  try {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    
    // Check if file is large enough
    if (bytes.length < 64) {
      console.log('File too small for version extraction:', bytes.length);
      return null;
    }

    // Extract version string (typically at offset 48-64)
    const versionBytes = bytes.slice(48, 64);
    const versionString = new TextDecoder('ascii').decode(versionBytes);
    console.log('Version string extracted:', versionString);
    
    // Extract version number (format: x.x.x)
    const versionMatch = versionString.match(/(\d+\.\d+\.\d+)/);
    console.log('Version match:', versionMatch);
    
    return versionMatch ? versionMatch[1] : null;
  } catch (error) {
    console.error('Error extracting OTA version:', error);
    return null;
  }
}

/**
 * Extract project name from OTA binary file
 * Typically located at offset 64-95 in ESP32 OTA binaries
 */
export function extractOTAProjectName(buffer: Uint8Array | ArrayBuffer): string | null {
  try {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    
    // Check if file is large enough
    if (bytes.length < 96) {
      return null;
    }

    // Extract project name (typically at offset 64-95)
    const nameBytes = bytes.slice(64, 96);
    const nameString = new TextDecoder('ascii').decode(nameBytes);
    
    // Remove null terminators and clean up
    const cleanName = nameString.replace(/\0/g, '').trim();
    
    return cleanName || null;
  } catch (error) {
    console.error('Error extracting OTA project name:', error);
    return null;
  }
}

/**
 * Extract all metadata from OTA binary file
 */
export function parseOTAMetadata(buffer: Uint8Array | ArrayBuffer): OTAMetadata {
  return {
    version: extractOTAVersion(buffer),
    projectName: extractOTAProjectName(buffer),
  };
}

/**
 * Generate filename for OTA binary based on metadata
 */
export function generateOTAFilename(
  buffer: Uint8Array | ArrayBuffer,
  originalName?: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const metadata = parseOTAMetadata(buffer);
  
  // Build filename components
  const parts: string[] = [];
  
  // Add project name if available
  if (metadata.projectName) {
    parts.push(metadata.projectName.replace(/[^a-zA-Z0-9_-]/g, '_'));
  }
  
  // Add version if available
  if (metadata.version) {
    parts.push(`v${metadata.version}`);
  }
  
  // Add timestamp
  parts.push(timestamp);
  
  // Add original name if provided and no metadata found
  if (originalName && parts.length === 1) {
    parts.push(originalName.replace(/\.bin$/, ''));
  }
  
  return `${parts.join('_')}.bin`;
}
