# Pre-Deployment Checklist

Complete these steps **before** running `terraform apply` to ensure a successful deployment.

## ✅ 1. Supabase Configuration

### Create Storage Buckets

Your application requires two Supabase storage buckets. Create them manually in the Supabase dashboard:

1. **Go to Supabase Dashboard** → Your Project → Storage

2. **Create `radar-readings` bucket:**
   - Name: `radar-readings`
   - Public: **No** (Private)
   - File size limit: 50 MB (default)
   - Allowed MIME types: `text/csv`

3. **Create `binary-files` bucket:**
   - Name: `binary-files`
   - Public: **No** (Private)
   - File size limit: 50 MB
   - Allowed MIME types: `application/octet-stream`

### Set Bucket Policies (Optional but Recommended)

For `radar-readings`:
```sql
-- Allow authenticated uploads
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'radar-readings');

-- Allow service role full access
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'radar-readings');
```

For `binary-files`:
```sql
-- Allow service role full access
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'binary-files');
```

## ✅ 2. Database Setup

### Run Prisma Migrations

Your Supabase PostgreSQL database needs the schema created:

```bash
cd terraform/scripts
./run-migrations.sh
```

This will:
- Read your `.env` file for `DATABASE_URL`
- Run `npx prisma migrate deploy`
- Create the `radar_readings` table with all indexes

**Verify migration:**
```bash
# Check that table exists
psql $DATABASE_URL -c "\dt"

# Should show: radar_readings table
```

## ✅ 3. Environment Variables

### Create and Configure `.env` File

```bash
# Copy example
cp .env.example .env

# Edit with your values
vim .env
```

**Required variables:**
```bash
# Supabase Database
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase API
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Update after getting ALB DNS
```

### Store in AWS SSM Parameter Store

```bash
cd terraform/scripts
./setup-ssm-parameters.sh
```

**Verify parameters were created:**
```bash
aws ssm get-parameters-by-path \
  --path /smarthome-radar \
  --region us-east-1 \
  --query 'Parameters[].Name'
```

## ✅ 4. AWS Backend Setup

### Create S3 Bucket and DynamoDB Table

```bash
cd terraform/scripts
./setup-backend.sh
```

This creates:
- S3 bucket: `smarthome-radar-terraform-state`
- DynamoDB table: `smarthome-radar-terraform-locks`

**Verify:**
```bash
aws s3 ls | grep smarthome-radar-terraform-state
aws dynamodb list-tables | grep smarthome-radar-terraform-locks
```

## ✅ 5. Build and Push Initial Docker Image

**IMPORTANT:** You must push an image to ECR **before** the ASG can successfully launch instances.

### Option A: Push AFTER `terraform apply`

1. Run `terraform apply` (instances will fail to start initially)
2. Note the ECR repository URL from outputs
3. Build and push:
   ```bash
   cd terraform/scripts
   ./build-and-push.sh latest
   ```
4. Trigger instance refresh:
   ```bash
   aws autoscaling start-instance-refresh \
     --auto-scaling-group-name smarthome-radar-asg \
     --preferences '{"MinHealthyPercentage": 0}' \
     --region us-east-1
   ```

### Option B: Create ECR Manually First (Recommended)

1. Create ECR repository manually:
   ```bash
   aws ecr create-repository \
     --repository-name smarthome-radar-api \
     --region us-east-1
   ```

2. Build and push image:
   ```bash
   # Get account ID
   ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
   REGION="us-east-1"

   # Login to ECR
   aws ecr get-login-password --region $REGION | \
     docker login --username AWS --password-stdin \
     $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

   # Build and push
   cd ../..  # Back to project root
   docker build -t smarthome-radar-api:latest .
   docker tag smarthome-radar-api:latest \
     $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/smarthome-radar-api:latest
   docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/smarthome-radar-api:latest
   ```

3. Run `terraform apply` (will find existing ECR repo and image)

## ✅ 6. AWS Credentials

Ensure AWS CLI is configured:

```bash
aws configure

# Verify
aws sts get-caller-identity
```

Should return your account ID and user/role.

## 📋 Complete Checklist

Before running `terraform apply`, verify:

- [ ] Supabase `radar-readings` bucket created
- [ ] Supabase `binary-files` bucket created
- [ ] Database migrations run (`./run-migrations.sh`)
- [ ] `.env` file created and configured
- [ ] SSM parameters created (`./setup-ssm-parameters.sh`)
- [ ] Terraform backend created (`./setup-backend.sh`)
- [ ] AWS credentials configured
- [ ] Docker image built and ready (or ECR repo created)

## 🚀 Ready to Deploy

Once all items are checked:

```bash
cd terraform

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Deploy!
terraform apply
```

## 🔍 Post-Deployment Verification

After `terraform apply` succeeds:

1. **Get ALB DNS:**
   ```bash
   terraform output alb_dns_name
   ```

2. **Update `.env` and SSM:**
   ```bash
   # Update NEXT_PUBLIC_APP_URL in .env
   NEXT_PUBLIC_APP_URL="http://<alb-dns-name>"

   # Re-run SSM setup
   cd scripts
   ./setup-ssm-parameters.sh

   # Refresh instances to pick up new value
   aws autoscaling start-instance-refresh \
     --auto-scaling-group-name smarthome-radar-asg \
     --preferences '{"MinHealthyPercentage": 0}' \
     --region us-east-1
   ```

3. **Test health endpoint:**
   ```bash
   curl http://<alb-dns-name>/api/healthz
   ```

4. **Test radar data upload:**
   ```bash
   curl -X POST http://<alb-dns-name>/api/radar-data \
     -H "Content-Type: application/octet-stream" \
     --data-binary @test-data/sample_packet_minimal.bin
   ```

5. **Check CloudWatch Logs:**
   ```bash
   aws logs tail /aws/ec2/smarthome-radar --follow
   ```

## ⚠️ Common Issues

### Issue: Instances unhealthy in target group

**Cause:** Docker image not pushed to ECR yet

**Solution:**
```bash
cd terraform/scripts
./build-and-push.sh latest
```

### Issue: Container fails to start

**Cause:** Missing SSM parameters or incorrect DATABASE_URL

**Solution:**
```bash
# Verify SSM parameters
aws ssm get-parameters-by-path --path /smarthome-radar --region us-east-1

# Check instance logs
aws logs tail /aws/ec2/smarthome-radar --follow
```

### Issue: Database connection error

**Cause:** Supabase connection pooler or migrations not run

**Solution:**
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Re-run migrations
cd terraform/scripts
./run-migrations.sh
```

### Issue: Supabase storage errors

**Cause:** Buckets not created

**Solution:** Create buckets manually in Supabase dashboard (see step 1 above)
