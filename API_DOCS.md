# Binary Files API Documentation

## Overview

The Binary Files API provides endpoints for uploading, listing, and downloading binary firmware files (OTA updates) to/from AWS S3. The API automatically extracts version information and project names from ESP32 OTA binary files.

**Base URL:** `http://your-domain.com/api/bin-files`

---

## Endpoints

### 1. Upload Binary File

Upload a binary file to AWS S3 with automatic metadata extraction.

**Endpoint:** `POST /api/bin-files/upload`

**Headers:**
```
Content-Type: application/octet-stream
x-filename: optional-filename.bin (optional)
```

**Query Parameters:**
- `filename` (optional): Custom filename to use instead of header
- `disableOTAParser` (optional): Set to `true` to disable version/project extraction

**Request Body:** Binary file data

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "fileName": "Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin",
    "filePath": "uploads/Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin",
    "size": 1202304,
    "version": "1.0.5",
    "projectName": "Transmitter_AP"
  }
}
```

**Example (cURL):**
```bash
curl -X POST http://localhost:3000/api/bin-files/upload \
  -H "Content-Type: application/octet-stream" \
  -H "x-filename: firmware.bin" \
  --data-binary @firmware.bin
```

**Example (PowerShell):**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/bin-files/upload" `
  -Method POST `
  -InFile "firmware.bin" `
  -Headers @{"Content-Type"="application/octet-stream"}
```

**Example (ESP32/Arduino):**
```cpp
HTTPClient http;
File file = SPIFFS.open("/firmware.bin", "r");

http.begin("http://your-server.com/api/bin-files/upload");
http.addHeader("Content-Type", "application/octet-stream");
http.addHeader("x-filename", "esp32-firmware.bin");

int httpCode = http.sendRequest("POST", &file, file.size());
String response = http.getString();
http.end();
file.close();
```

---

### 2. Get Latest File

Get metadata of the most recently uploaded binary file.

**Endpoint:** `GET /api/bin-files?latest=true`

**Query Parameters:**
- `latest=true` (required): Get the latest file
- `download=true` (optional): Download the file instead of returning metadata

**Response (Metadata):**
```json
{
  "success": true,
  "data": {
    "name": "Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin",
    "path": "uploads/Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin",
    "size": 1202304,
    "created_at": "2025-12-21T09:35:40.044Z",
    "updated_at": "2025-12-21T09:35:40.044Z",
    "version": "1.0.5",
    "projectName": "Transmitter_AP"
  }
}
```

**Response (Download):** Binary file data with headers:
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="..."
Content-Length: 1202304
```

**Example (Get Metadata):**
```bash
curl "http://localhost:3000/api/bin-files?latest=true"
```

**Example (Download):**
```bash
curl "http://localhost:3000/api/bin-files?latest=true&download=true" -o latest.bin
```

**Example (ESP32 OTA Update):**
```cpp
// Get latest firmware info
HTTPClient http;
http.begin("http://your-server.com/api/bin-files?latest=true");
int httpCode = http.GET();

if (httpCode == 200) {
  String payload = http.getString();
  // Parse JSON to check version
  
  // Download and update
  t_httpUpdate_return ret = httpUpdate.update(
    "http://your-server.com/api/bin-files?latest=true&download=true"
  );
}
```

---

### 3. List All Files

List all uploaded binary files with pagination and metadata.

**Endpoint:** `GET /api/bin-files`

**Query Parameters:**
- `limit` (optional): Number of files to return (default: 50, max: 100)
- `offset` (optional): Number of files to skip for pagination (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin",
      "path": "uploads/Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin",
      "size": 1202304,
      "created_at": "2025-12-21T09:35:40.044Z",
      "updated_at": "2025-12-21T09:35:40.044Z",
      "version": "1.0.5",
      "projectName": "Transmitter_AP"
    },
    {
      "name": "Transmitter_AP_2025-12-21T09-25-42-610Z.bin",
      "path": "uploads/Transmitter_AP_2025-12-21T09-25-42-610Z.bin",
      "size": 1202304,
      "created_at": "2025-12-21T09:25:45.739Z",
      "updated_at": "2025-12-21T09:25:45.739Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 2
  }
}
```

**Example:**
```bash
# Get first 10 files
curl "http://localhost:3000/api/bin-files?limit=10&offset=0"

# Get next 10 files
curl "http://localhost:3000/api/bin-files?limit=10&offset=10"
```

---

### 4. Download File by Name

Download a specific binary file by its filename.

**Endpoint:** `GET /api/bin-files?name=FILENAME`

**Query Parameters:**
- `name` (required): The filename to download (can be with or without `uploads/` prefix)

**Response:** Binary file data with headers:
```
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="..."
Content-Length: 1202304
```

**Example:**
```bash
curl "http://localhost:3000/api/bin-files?name=Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin" -o firmware.bin
```

**Example (PowerShell):**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/bin-files?name=Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin" `
  -OutFile "firmware.bin"
```

---

## OTA Binary Format

The API automatically extracts metadata from ESP32 OTA binary files:

### Version String
- **Location:** Bytes 48-64
- **Format:** ASCII string (e.g., "1.0.5")
- **Pattern:** Matches `\d+\.\d+\.\d+` (e.g., 1.0.5, 2.3.1)

### Project Name
- **Location:** Bytes 64-96
- **Format:** ASCII string (e.g., "Transmitter_AP")
- **Cleaning:** Null terminators and whitespace are removed

### Filename Generation
Files are automatically named using this pattern:
```
{ProjectName}_v{Version}_{Timestamp}.bin
```

Examples:
- `Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin`
- `MyDevice_v2.1.0_2025-12-21T10-15-30-456Z.bin`

If metadata extraction fails, the filename defaults to:
```
{Timestamp}_{OriginalName}.bin
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Empty file received"
}
```

### 404 Not Found
```json
{
  "error": "No files found"
}
```

or

```json
{
  "error": "File not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to upload file",
  "details": "Upload failed: ..."
}
```

---

## Storage Structure

Files are stored in Supabase Storage with the following structure:

```
binary-files/              # Bucket name
└── uploads/               # Upload directory
    ├── Transmitter_AP_v1.0.5_2025-12-21T09-35-38-733Z.bin
    ├── Transmitter_AP_v1.0.4_2025-12-20T15-22-10-123Z.bin
    └── ...
```

---

## Environment Variables

Required environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

---

## Rate Limits & File Size

- **Max File Size:** Determined by Supabase Storage bucket settings (recommended: 50MB)
- **Allowed MIME Type:** `application/octet-stream`
- **Rate Limits:** Depends on your hosting provider (Vercel, etc.)

---

## Security Considerations

1. **Service Role Key:** Keep `SUPABASE_SERVICE_ROLE_KEY` secret - never expose in client-side code
2. **Bucket Access:** Configure Supabase bucket as private
3. **Authentication:** Consider adding authentication middleware for production use
4. **File Validation:** Only `.bin` files are recommended; add additional validation as needed

---

## Testing

### PowerShell Test Script
Run the included test script:
```powershell
cd test-data
.\test-bin-upload.ps1
```

### Manual Testing
```powershell
# Upload
Invoke-WebRequest -Uri "http://localhost:3000/api/bin-files/upload" `
  -Method POST -InFile "firmware.bin" `
  -Headers @{"Content-Type"="application/octet-stream"}

# List
Invoke-WebRequest -Uri "http://localhost:3000/api/bin-files?limit=5"

# Get Latest
Invoke-WebRequest -Uri "http://localhost:3000/api/bin-files?latest=true"

# Download Latest
Invoke-WebRequest -Uri "http://localhost:3000/api/bin-files?latest=true&download=true" `
  -OutFile "latest.bin"
```

---

## Implementation Details

### Files Created
- `src/lib/utils/ota-parser.ts` - OTA binary metadata parser
- `src/lib/storage/bin-storage.ts` - Storage utility functions
- `src/app/api/bin-files/upload/route.ts` - Upload endpoint
- `src/app/api/bin-files/route.ts` - Download/list endpoint

### Dependencies
- `@supabase/supabase-js` - Supabase client
- Next.js App Router - API routes

---

## Support

For issues or questions:
1. Check Supabase Storage bucket configuration
2. Verify environment variables are set correctly
3. Check server logs for detailed error messages
4. Ensure Node.js version >= 20.9.0
