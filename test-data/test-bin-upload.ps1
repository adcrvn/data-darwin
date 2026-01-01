# Binary File Upload API Test Script
# Run this from the test-data directory

$BaseUrl = "http://localhost:3000"
$UploadApi = "$BaseUrl/api/bin-files/upload"
$GetApi = "$BaseUrl/api/bin-files"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Binary File Upload API Test" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Upload a bin file
Write-Host "Test 1: Uploading ota_sample.bin..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $UploadApi `
        -Method POST `
        -InFile "ota_sample.bin" `
        -Headers @{
            "Content-Type" = "application/octet-stream"
            "x-filename" = "ota-firmware.bin"
        }
    
    $uploadResult = $response.Content | ConvertFrom-Json
    $uploadResult | ConvertTo-Json -Depth 5
    Write-Host "✓ Upload successful" -ForegroundColor Green
    $uploadedFileName = $uploadResult.data.fileName
    Write-Host "Uploaded filename: $uploadedFileName" -ForegroundColor Cyan
} catch {
    Write-Host "✗ Upload failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Upload the same file again (different timestamp)
Write-Host "Test 2: Uploading ota_sample.bin again (testing unique naming)..." -ForegroundColor Yellow
try {
    Start-Sleep -Seconds 1  # Wait to ensure different timestamp
    $response = Invoke-WebRequest -Uri "$UploadApi`?filename=ota-firmware-v2.bin" `
        -Method POST `
        -InFile "ota_sample.bin" `
        -Headers @{"Content-Type" = "application/octet-stream"}
    
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
    Write-Host "✓ Upload successful" -ForegroundColor Green
} catch {
    Write-Host "✗ Upload failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Get latest file metadata
Write-Host "Test 3: Getting latest file metadata..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$GetApi`?latest=true"
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
    Write-Host "✓ Retrieved metadata" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: List all files
Write-Host "Test 4: Listing all files (limit 10)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$GetApi`?limit=10"
    $listResult = $response.Content | ConvertFrom-Json
    $listResult | ConvertTo-Json -Depth 5
    Write-Host "✓ Listed $($listResult.data.Count) files" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Download latest file
Write-Host "Test 5: Downloading latest file..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "$GetApi`?latest=true&download=true" `
        -OutFile "downloaded_latest.bin"
    
    if (Test-Path "downloaded_latest.bin") {
        $fileInfo = Get-Item "downloaded_latest.bin"
        Write-Host "✓ File downloaded successfully" -ForegroundColor Green
        Write-Host "  Name: $($fileInfo.Name)" -ForegroundColor Gray
        Write-Host "  Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
    }
} catch {
    Write-Host "✗ Download failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: Download by specific filename (if we got one from Test 1)
if ($uploadedFileName) {
    Write-Host "Test 6: Downloading by filename: $uploadedFileName..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "$GetApi`?name=$uploadedFileName" `
            -OutFile "downloaded_$uploadedFileName"
        
        if (Test-Path "downloaded_$uploadedFileName") {
            $fileInfo = Get-Item "downloaded_$uploadedFileName"
            Write-Host "✓ File downloaded successfully" -ForegroundColor Green
            Write-Host "  Name: $($fileInfo.Name)" -ForegroundColor Gray
            Write-Host "  Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
        }
    } catch {
        Write-Host "✗ Download failed: $_" -ForegroundColor Red
    }
    Write-Host ""
}

# Test 7: List with pagination
Write-Host "Test 7: Testing pagination (limit=2, offset=0)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$GetApi`?limit=2&offset=0"
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
    Write-Host "✓ Pagination working" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "All tests completed!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
