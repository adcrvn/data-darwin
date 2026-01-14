# RDS PostgreSQL Deployment Guide

This guide walks through deploying AWS RDS PostgreSQL for the SmartHome Radar API.

## Prerequisites

- AWS CLI configured with credentials
- Terraform >= 1.5.0 installed
- Completed VPC and IAM module deployment
- Database password ready (strong password recommended)

## Quick Start

### 1. Set Database Password

**Option A: Environment Variable (Recommended for CI/CD)**

```bash
export TF_VAR_db_master_password="YourSecurePassword123!"
```

**Option B: terraform.tfvars (Not recommended - use for testing only)**

```hcl
# terraform/terraform.tfvars
db_master_password = "YourSecurePassword123!"
```

**Option C: AWS Secrets Manager (Best for Production)**

```bash
# Store password in Secrets Manager
aws secretsmanager create-secret \
  --name smarthome-radar-db-password \
  --secret-string "YourSecurePassword123!"

# Reference in Terraform (requires additional configuration)
# See: https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/secretsmanager_secret_version
```

### 2. Review Configuration

Edit `terraform/variables.tf` or create `terraform.tfvars`:

```hcl
# Development Configuration
db_instance_class           = "db.t3.micro"
db_allocated_storage        = 20
db_multi_az                 = false
db_deletion_protection      = false
db_skip_final_snapshot      = true
db_backup_retention_period  = 1

# Production Configuration (Recommended)
# db_instance_class           = "db.t3.small"
# db_allocated_storage        = 50
# db_multi_az                 = true
# db_deletion_protection      = true
# db_skip_final_snapshot      = false
# db_backup_retention_period  = 7
# db_performance_insights_enabled = true
# db_monitoring_interval      = 60
```

### 3. Deploy Infrastructure

```bash
cd terraform

# Initialize (if not already done)
terraform init

# Preview changes
terraform plan -var="db_master_password=$TF_VAR_db_master_password"

# Deploy
terraform apply -var="db_master_password=$TF_VAR_db_master_password"
```

### 4. Get Database Connection Details

```bash
# Get connection endpoints
terraform output db_instance_endpoint
terraform output db_instance_address

# Get full connection strings (sensitive - won't show by default)
terraform output -raw database_url
terraform output -raw direct_url
```

### 5. Update SSM Parameters

Update the SSM parameters with the RDS connection strings:

```bash
# Get the connection strings
DATABASE_URL=$(terraform output -raw database_url)
DIRECT_URL=$(terraform output -raw direct_url)

# Update SSM parameters
aws ssm put-parameter \
  --name "/smarthome-radar/prod/DATABASE_URL" \
  --value "$DATABASE_URL" \
  --type "SecureString" \
  --overwrite

aws ssm put-parameter \
  --name "/smarthome-radar/prod/DIRECT_URL" \
  --value "$DIRECT_URL" \
  --type "SecureString" \
  --overwrite
```

### 6. Run Database Migrations

**Option A: From Local Machine**

```bash
# Navigate to project root
cd /path/to/data-darwin

# Update .env file with RDS credentials
DATABASE_URL=$(cd terraform && terraform output -raw database_url)
DIRECT_URL=$(cd terraform && terraform output -raw direct_url)

# Update .env
echo "DATABASE_URL=\"$DATABASE_URL\"" >> .env
echo "DIRECT_URL=\"$DIRECT_URL\"" >> .env

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

**Option B: From EC2 Instance (After Deployment)**

```bash
# SSH into EC2 instance (use Systems Manager Session Manager)
aws ssm start-session --target i-xxxxxxxxxxxxx

# Inside EC2 instance
cd /app
npx prisma migrate deploy
```

**Option C: Using Migration Script**

```bash
cd terraform
./scripts/run-migrations.sh
```

### 7. Verify Database Connection

```bash
# Get RDS endpoint
DB_ENDPOINT=$(cd terraform && terraform output -raw db_instance_address)

# Test connection from EC2 instance
aws ssm start-session --target i-xxxxxxxxxxxxx

# Inside EC2 instance
psql -h $DB_ENDPOINT -U postgres -d smarthome_api -c "SELECT version();"
```

### 8. Refresh EC2 Instances

After updating SSM parameters, refresh EC2 instances to pick up new environment variables:

```bash
cd terraform
./scripts/refresh-instances.sh
```

Wait for instances to become healthy (~5 minutes).

## Configuration Options

### Development Environment

```hcl
# Minimal cost configuration
db_instance_class           = "db.t3.micro"      # ~$13/month
db_allocated_storage        = 20                 # 20 GB
db_multi_az                 = false              # Single AZ
db_deletion_protection      = false              # Can delete easily
db_skip_final_snapshot      = true               # No snapshot on destroy
db_backup_retention_period  = 1                  # 1 day backups
db_performance_insights_enabled = false          # Disabled
db_monitoring_interval      = 0                  # No enhanced monitoring
```

**Estimated Monthly Cost**: ~$15-20

### Staging Environment

```hcl
# Balanced configuration
db_instance_class           = "db.t3.small"      # ~$26/month
db_allocated_storage        = 30                 # 30 GB
db_multi_az                 = false              # Single AZ
db_deletion_protection      = true               # Protect from deletion
db_skip_final_snapshot      = false              # Keep final snapshot
db_backup_retention_period  = 3                  # 3 day backups
db_performance_insights_enabled = false          # Disabled
db_monitoring_interval      = 0                  # No enhanced monitoring
```

**Estimated Monthly Cost**: ~$35-45

### Production Environment

```hcl
# High availability configuration
db_instance_class           = "db.t3.medium"     # ~$52/month
db_allocated_storage        = 100                # 100 GB
db_multi_az                 = true               # Multi-AZ (~2x cost)
db_deletion_protection      = true               # Protect from deletion
db_skip_final_snapshot      = false              # Keep final snapshot
db_backup_retention_period  = 7                  # 7 day backups
db_performance_insights_enabled = true           # Enabled
db_monitoring_interval      = 60                 # Enhanced monitoring
db_create_read_replica      = false              # Add if needed
```

**Estimated Monthly Cost**: ~$120-150 (with Multi-AZ)

## Migration from Supabase

If you're currently using Supabase PostgreSQL, follow these steps:

### 1. Export Data from Supabase

```bash
# Get Supabase connection string from dashboard
SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Export schema and data
pg_dump "$SUPABASE_DB_URL" -Fc -f supabase_backup.dump
```

### 2. Import to RDS

```bash
# Get RDS connection string
RDS_DB_URL=$(cd terraform && terraform output -raw direct_url)

# Import data
pg_restore --no-owner --no-acl -d "$RDS_DB_URL" supabase_backup.dump
```

### 3. Alternative: Use Prisma Migrations

```bash
# If you have Prisma schema defined
# This will recreate the schema from scratch

# Point to RDS
export DATABASE_URL=$(cd terraform && terraform output -raw database_url)
export DIRECT_URL=$(cd terraform && terraform output -raw direct_url)

# Run migrations
npx prisma migrate deploy

# Import data only (not schema)
pg_dump "$SUPABASE_DB_URL" --data-only -Fc -f data_only.dump
pg_restore --no-owner --no-acl -d "$DIRECT_URL" data_only.dump
```

### 4. Update Application Configuration

```bash
# Update .env file
DATABASE_URL="<RDS connection string from terraform output>"
DIRECT_URL="<RDS connection string from terraform output>"

# Keep Supabase variables for storage
NEXT_PUBLIC_SUPABASE_URL="<your-supabase-url>"
SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
```

### 5. Test Application

```bash
# Run locally
npm run dev

# Test endpoints
curl -X POST http://localhost:3000/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-data/sample_packet_minimal.bin
```

## Security Best Practices

### Password Management

**DO NOT**:
- ❌ Commit passwords to Git
- ❌ Store passwords in plaintext files
- ❌ Use simple passwords like "password123"

**DO**:
- ✅ Use AWS Secrets Manager or environment variables
- ✅ Use strong passwords (min 16 chars, mixed case, numbers, symbols)
- ✅ Rotate passwords regularly
- ✅ Consider IAM database authentication

### Network Security

- RDS is deployed in private subnets only
- Not publicly accessible (no public IP)
- Only accessible from EC2 instances in allowed security group
- Use SSL/TLS for connections (enforced)

### Encryption

- Storage encryption enabled by default (AES-256)
- Automated backups are encrypted
- Use SSL for connections in transit

```javascript
// Ensure SSL in Prisma connection string
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

## Monitoring and Alerts

### CloudWatch Metrics

Monitor these key metrics:

1. **CPUUtilization** - Target: <70%
2. **FreeStorageSpace** - Alert when <10GB
3. **DatabaseConnections** - Monitor for connection leaks
4. **ReadLatency** / **WriteLatency** - Performance monitoring
5. **FreeableMemory** - Memory pressure

### Set Up Alarms

```bash
# Example: Low storage alarm
aws cloudwatch put-metric-alarm \
  --alarm-name smarthome-radar-db-low-storage \
  --alarm-description "Alert when RDS storage is low" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 10737418240 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=smarthome-radar-db
```

## Backup and Recovery

### Automated Backups

- Automatically enabled (retention: 7 days)
- Backup window: 03:00-04:00 UTC
- No performance impact
- Point-in-time recovery (PITR) available

### Manual Snapshots

Create before major changes:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier smarthome-radar-db \
  --db-snapshot-identifier smarthome-radar-db-$(date +%Y%m%d-%H%M%S)
```

### Restore from Snapshot

```bash
# List snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier smarthome-radar-db

# Restore
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier smarthome-radar-db-restored \
  --db-snapshot-identifier <snapshot-id>
```

## Scaling

### Vertical Scaling (Instance Size)

Update instance class:

```hcl
# In terraform.tfvars
db_instance_class = "db.t3.medium"  # or db.r6g.large, etc.
```

Apply changes:

```bash
terraform apply -var="db_master_password=$TF_VAR_db_master_password"
```

**Downtime**: 5-15 minutes during instance modification.

### Horizontal Scaling (Read Replicas)

Enable read replica:

```hcl
# In terraform.tfvars
db_create_read_replica = true
replica_instance_class = "db.t3.small"
```

Update application to use read replica for read queries:

```javascript
// For read-heavy operations
const READ_REPLICA_URL = process.env.READ_REPLICA_URL

// Use read replica for analytics queries
const prismaRead = new PrismaClient({
  datasources: { db: { url: READ_REPLICA_URL } }
})
```

### Storage Scaling

Storage autoscaling is enabled by default:
- Initial: 20 GB
- Max: 100 GB (configurable)
- Automatically scales when >90% full

## Troubleshooting

### Issue: Cannot connect to database

**Check 1**: Security groups

```bash
terraform output db_security_group_id
aws ec2 describe-security-groups --group-ids <sg-id>
```

**Check 2**: Network connectivity from EC2

```bash
# From EC2 instance
telnet <db-endpoint> 5432
```

**Check 3**: Database status

```bash
aws rds describe-db-instances \
  --db-instance-identifier smarthome-radar-db \
  --query 'DBInstances[0].DBInstanceStatus'
```

### Issue: Migrations fail

**Check 1**: Using DIRECT_URL (not DATABASE_URL)

```bash
# Migrations require direct connection
npx prisma migrate deploy
```

**Check 2**: Database accessibility

```bash
psql "$DIRECT_URL" -c "SELECT 1;"
```

### Issue: Slow queries

**Solution 1**: Enable Performance Insights

```hcl
db_performance_insights_enabled = true
```

**Solution 2**: Check indexes

```sql
-- Connect to database
psql "$DIRECT_URL"

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY abs(correlation) DESC;
```

**Solution 3**: Add read replica

```hcl
db_create_read_replica = true
```

## Cost Optimization

1. **Right-size instance**: Start with `db.t3.micro`, scale up as needed
2. **Disable Multi-AZ for dev/staging**: Saves ~50% cost
3. **Reduce backup retention**: Use 1-3 days for non-production
4. **Delete old snapshots**: Manual snapshots cost $0.095/GB-month
5. **Monitor storage growth**: Prevent excessive autoscaling

## Next Steps

After RDS is deployed:

1. ✅ Update SSM parameters with RDS connection strings
2. ✅ Run database migrations
3. ✅ Refresh EC2 instances
4. ✅ Test application endpoints
5. ✅ Set up CloudWatch alarms
6. ✅ Configure automated backups
7. ✅ Document connection strings (securely)
8. ✅ Update application .env files

## Resources

- [RDS Module README](./modules/rds/README.md)
- [AWS RDS Pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [Prisma with RDS](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-lambda)
- [RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
