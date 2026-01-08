# S3 Bucket for Radar Data Storage
# Replaces Supabase storage for CSV files and binary firmware files

resource "aws_s3_bucket" "radar_data" {
  bucket = "${var.project_name}-radar-data-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "${var.project_name}-radar-data"
    Description = "Storage for radar CSV data and OTA firmware binaries"
  }
}

# Enable versioning for firmware files
resource "aws_s3_bucket_versioning" "radar_data" {
  bucket = aws_s3_bucket.radar_data.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Encryption at rest
resource "aws_s3_bucket_server_side_encryption_configuration" "radar_data" {
  bucket = aws_s3_bucket.radar_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "radar_data" {
  bucket = aws_s3_bucket.radar_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle policy for CSV data archival
resource "aws_s3_bucket_lifecycle_configuration" "radar_data" {
  bucket = aws_s3_bucket.radar_data.id

  rule {
    id     = "archive-old-csv-data"
    status = "Enabled"

    filter {
      prefix = "radar-readings/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER_IR"
    }

    transition {
      days          = 180
      storage_class = "DEEP_ARCHIVE"
    }
  }

  rule {
    id     = "cleanup-old-firmware"
    status = "Enabled"

    filter {
      prefix = "binary-files/"
    }

    # Keep firmware versions for 1 year, then delete
    expiration {
      days = 365
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CORS configuration for direct uploads (if needed in future)
resource "aws_s3_bucket_cors_configuration" "radar_data" {
  bucket = aws_s3_bucket.radar_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://${var.project_name}.dar.win", "https://io.dar.win"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
