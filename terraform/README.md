# Terraform Infrastructure for SmartHome Radar API

This Terraform configuration deploys the SmartHome Radar API to AWS with the following architecture:

- **VPC** with public and private subnets across 2 AZs
- **Application Load Balancer** (ALB) in public subnets
- **Auto Scaling Group** (ASG) with EC2 instances in private subnets (min/max/desired = 1)
- **ECR** repository for Docker images
- **NAT Gateways** for private subnet internet access
- **IAM roles** for EC2 to access ECR and SSM Parameter Store
- **Security Groups** for ALB and EC2 instances

## Prerequisites

1. **AWS CLI** installed and configured with credentials
   ```bash
   aws configure
   ```

2. **Terraform** >= 1.5.0 installed
   ```bash
   terraform --version
   ```

3. **Docker** installed locally for building images
   ```bash
   docker --version
   ```

4. **Environment Variables** ready in `.env` file at project root

## ⚠️ IMPORTANT: Pre-Deployment Requirements

**Before starting, complete ALL items in [`PRE_DEPLOYMENT_CHECKLIST.md`](./PRE_DEPLOYMENT_CHECKLIST.md)**

The checklist ensures:
- ✅ Supabase buckets are created
- ✅ Database migrations are run
- ✅ Environment variables are configured
- ✅ Docker image is ready

**Skipping these steps will cause deployment failures!**

---

## Available Scripts

The `terraform/scripts/` directory contains helper scripts for deployment and maintenance:

| Script | Purpose | Usage |
|--------|---------|-------|
| `setup-backend.sh` | Create S3 bucket and DynamoDB table for Terraform state | `./setup-backend.sh` |
| `setup-ssm-parameters.sh` | Upload `.env` variables to AWS SSM Parameter Store | `./setup-ssm-parameters.sh` |
| `build-and-push.sh` | Build Docker image and push to ECR | `./build-and-push.sh [tag]` |
| `refresh-instances.sh` | Trigger ASG instance refresh to deploy changes | `./refresh-instances.sh` |
| `run-migrations.sh` | Run Prisma database migrations locally | `./run-migrations.sh` |

**When to use `refresh-instances.sh`:**
- After updating SSM parameters (environment variables)
- After pushing a new Docker image to ECR
- To apply user-data script changes
- To recover from unhealthy instances

---

## Quick Start

### Step 1: Set Up Terraform Backend

Create the S3 bucket and DynamoDB table for Terraform state:

```bash
cd terraform/scripts
./setup-backend.sh
```

This creates:
- S3 bucket: `smarthome-radar-terraform-state`
- DynamoDB table: `smarthome-radar-terraform-locks`

### Step 2: Store Environment Variables in SSM Parameter Store

Store your `.env` variables as SSM parameters:

```bash
cd terraform/scripts
./setup-ssm-parameters.sh
```

This reads your `.env` file and creates SSM parameters at:
- `/smarthome-radar/DATABASE_URL`
- `/smarthome-radar/SUPABASE_SERVICE_ROLE_KEY`
- etc.

**Note:** Sensitive values (keys, passwords, URLs) are automatically stored as `SecureString` type.

### Step 3: Initialize Terraform

```bash
cd terraform
terraform init
```

### Step 4: Review Infrastructure Plan

```bash
terraform plan
```

Review the resources that will be created (VPC, subnets, ALB, ASG, etc.)

### Step 5: Deploy Infrastructure

```bash
terraform apply
```

Type `yes` when prompted. This will take ~10-15 minutes to create:
- VPC and networking (subnets, NAT gateways, route tables)
- Security groups
- ECR repository
- Application Load Balancer
- Auto Scaling Group (but instances will fail to start until you push a Docker image)

Save the outputs:
```bash
terraform output > outputs.txt
```

### Step 6: Build and Push Docker Image

```bash
cd terraform/scripts
./build-and-push.sh latest
```

This script:
1. Logs in to ECR
2. Builds the Docker image
3. Pushes to ECR as `latest`
4. Optionally triggers ASG instance refresh

**Important:** After the first `terraform apply`, you MUST push an image before instances can start successfully.

### Step 7: Verify Deployment

Get the ALB DNS name:
```bash
terraform output alb_dns_name
```

Test the health endpoint:
```bash
curl http://<alb-dns-name>/api/healthz
```

Test uploading a radar packet:
```bash
curl -X POST http://<alb-dns-name>/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @../test-data/sample_packet_minimal.bin
```

## Architecture Details

### Network Architecture

```
Internet
   │
   ├─→ ALB (Public Subnets in us-east-1a and us-east-1b)
   │     │
   │     └─→ Target Group
   │            │
   │            ├─→ EC2 Instance (Private Subnet - us-east-1a)
   │            └─→ EC2 Instance (Private Subnet - us-east-1b)
   │                   │
   │                   └─→ Single NAT Gateway (us-east-1a) → Internet
   │                           │
   │                           ├─→ ECR (Docker images)
   │                           ├─→ Supabase PostgreSQL
   │                           └─→ Supabase Storage
```

### Cost-Optimized 2-AZ Setup

**Why 2 AZs?** AWS Application Load Balancers require at least 2 subnets in 2 different availability zones.

**Cost Optimization:** We use only **1 NAT Gateway** (in us-east-1a) instead of 2:
- Both private subnets route internet traffic through the single NAT Gateway
- Saves ~$32.50/month compared to 2 NAT Gateways
- Still meets AWS ALB requirements

**Architecture:**
- **2 Public Subnets** (us-east-1a, us-east-1b) → ALB + NAT Gateway (1a only)
- **2 Private Subnets** (us-east-1a, us-east-1b) → EC2 instances (ASG)
- **1 NAT Gateway** (us-east-1a) → Used by both private subnets

**Trade-off:** If us-east-1a NAT Gateway fails, instances in both AZs lose internet access (can't pull ECR images or reach Supabase). However, they can still serve traffic through the ALB.

### Subnets

- **Public Subnets**
  - 10.0.0.0/24 (us-east-1a) - ALB + NAT Gateway
  - 10.0.1.0/24 (us-east-1b) - ALB only

- **Private Subnets**
  - 10.0.10.0/24 (us-east-1a) - EC2 instances (ASG)
  - 10.0.11.0/24 (us-east-1b) - EC2 instances (ASG)
  - Both route through NAT in us-east-1a

### Security Groups

**ALB Security Group:**
- Inbound: 80 (HTTP), 443 (HTTPS) from `0.0.0.0/0`
- Outbound: All traffic

**EC2 Security Group:**
- Inbound: 3000 (HTTP) from ALB security group only
- Outbound: All traffic (for ECR, Supabase, internet)

### IAM Permissions

EC2 instances have IAM role with permissions for:
- **ECR**: Pull Docker images
- **SSM Parameter Store**: Read `/smarthome-radar/*` parameters
- **CloudWatch Logs**: Write container logs

## Configuration

### Variables

Edit `terraform.tfvars` to customize:

```hcl
# terraform.tfvars (create this file)
aws_region              = "us-east-1"
environment             = "prod"
project_name            = "smarthome-radar"
instance_type           = "t3.small"
asg_min_size            = 1
asg_max_size            = 1
asg_desired_capacity    = 1
container_image_tag     = "latest"

# Optional: SSL certificate ARN for HTTPS
# ssl_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
```

### Environment Variables

The following environment variables must be stored in SSM Parameter Store (use `setup-ssm-parameters.sh`):

- `DATABASE_URL` - Supabase PostgreSQL connection string
- `DIRECT_URL` - Supabase direct connection string
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (SecureString)
- `NEXT_PUBLIC_APP_URL` - Your app URL (ALB DNS or custom domain)

## Deployment Workflow

### Initial Deployment

```bash
# 1. Setup backend
cd terraform/scripts
./setup-backend.sh

# 2. Store environment variables
./setup-ssm-parameters.sh

# 3. Deploy infrastructure
cd ..
terraform init
terraform apply

# 4. Build and push Docker image
cd scripts
./build-and-push.sh v1.0.0

# 5. Verify
curl http://$(terraform output -raw alb_dns_name)/api/healthz
```

### Updating Application Code

```bash
# 1. Build and push new image
cd terraform/scripts
./build-and-push.sh v1.0.1

# 2. Script will prompt to trigger ASG instance refresh
# Or use the refresh script:
cd scripts
./refresh-instances.sh

# Or manually:
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name smarthome-radar-asg \
  --preferences '{"MinHealthyPercentage": 0}' \
  --region us-east-1

# 3. Monitor refresh
aws autoscaling describe-instance-refreshes \
  --auto-scaling-group-name smarthome-radar-asg \
  --region us-east-1
```

### Updating Infrastructure

```bash
# Make changes to .tf files
cd terraform

# Plan changes
terraform plan

# Apply changes
terraform apply
```

### Updating Environment Variables

```bash
# 1. Update .env file
vim ../.env

# 2. Re-run SSM setup
cd scripts
./setup-ssm-parameters.sh

# 3. Trigger instance refresh to pick up new values
cd scripts
./refresh-instances.sh

# Or manually:
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name smarthome-radar-asg \
  --preferences '{"MinHealthyPercentage": 0}' \
  --region us-east-1
```

## Outputs

After `terraform apply`, these outputs are available:

```bash
terraform output alb_dns_name           # ALB DNS for accessing API
terraform output ecr_repository_url     # ECR URL for pushing images
terraform output vpc_id                 # VPC ID
terraform output asg_name               # Auto Scaling Group name
terraform output api_endpoint           # Full API endpoint URL
```

## Cost Estimate

Monthly costs (us-east-1) - **Single AZ Configuration**:

| Resource | Cost |
|----------|------|
| t3.small EC2 (1 instance) | ~$15 |
| Application Load Balancer | ~$20 |
| NAT Gateway (1 AZ) | ~$32.50 |
| Data Transfer | ~$5-10 |
| **Total** | **~$72.50-77.50/month** |

### Additional Cost Optimization Options

1. **Use t3.micro instead of t3.small**: (saves ~$7/month)
   - Sufficient for light to moderate traffic
   - Update `instance_type = "t3.micro"` in terraform.tfvars

2. **Use Public Subnets for EC2**: Place EC2 in public subnets, no NAT needed (saves $32.50/month)
   - Total cost: ~$40/month
   - Higher security risk
   - Only recommended for testing/development

3. **Reserved Instances**: Commit to 1-year reserved instance (saves ~30% on EC2)

4. **Add Second NAT Gateway for High Availability**: For production redundancy
   - Edit `modules/vpc/main.tf` to create NAT in each AZ
   - Adds ~$32.50/month for second NAT Gateway
   - Total: ~$105-110/month
   - Benefit: If one NAT fails, the other AZ still has internet access

## Monitoring

### CloudWatch Logs

Container logs are sent to CloudWatch Logs at:
```
/aws/ec2/smarthome-radar
```

View logs:
```bash
aws logs tail /aws/ec2/smarthome-radar --follow
```

### ALB Health Checks

Target health:
```bash
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)
```

### ASG Status

```bash
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names smarthome-radar-asg
```

## Troubleshooting

### Instances Not Starting

**Check user data logs:**
```bash
# SSH into instance (requires SSH key and security group rule)
ssh ec2-user@<instance-ip>
sudo tail -f /var/log/cloud-init-output.log
```

**Check Docker container:**
```bash
docker ps -a
docker logs smarthome-api
```

### Health Checks Failing

**Test locally on instance:**
```bash
curl http://localhost:3000/api/healthz
```

**Check database connectivity:**
```bash
# Review SSM parameters
aws ssm get-parameter --name /smarthome-radar/DATABASE_URL --with-decryption
```

### Image Pull Failures

**Verify ECR login:**
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

**Check IAM role permissions:**
```bash
aws iam get-role-policy --role-name smarthome-radar-ec2-role --policy-name smarthome-radar-ecr-access
```

### Instance Refresh Stuck

**Use the refresh script (detects and offers to cancel stuck refreshes):**
```bash
cd terraform/scripts
./refresh-instances.sh
```

**Or cancel and retry manually:**
```bash
aws autoscaling cancel-instance-refresh --auto-scaling-group-name smarthome-radar-asg

aws autoscaling start-instance-refresh \
  --auto-scaling-group-name smarthome-radar-asg \
  --preferences '{"MinHealthyPercentage": 0}'
```

## DNS and Custom Domain

### Using Route 53

Create an A record pointing to the ALB:

```hcl
# Add to main.tf or create route53.tf
resource "aws_route53_record" "api" {
  zone_id = "Z1234567890ABC"  # Your hosted zone ID
  name    = "api.yourdomain.com"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
```

### Adding SSL Certificate

1. **Request certificate in ACM:**
```bash
aws acm request-certificate \
  --domain-name api.yourdomain.com \
  --validation-method DNS \
  --region us-east-1
```

2. **Update `terraform.tfvars`:**
```hcl
ssl_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."
```

3. **Apply changes:**
```bash
terraform apply
```

This will:
- Add HTTPS listener (443) to ALB
- Redirect HTTP (80) to HTTPS

## Scaling

### Manual Scaling (Increase to 2 instances)

Edit `terraform.tfvars`:
```hcl
asg_min_size         = 2
asg_max_size         = 4
asg_desired_capacity = 2
```

Apply:
```bash
terraform apply
```

### Auto Scaling Policies

Add to `main.tf`:

```hcl
# CPU-based scaling
resource "aws_autoscaling_policy" "cpu_scaling" {
  name                   = "${var.project_name}-cpu-scaling"
  autoscaling_group_name = aws_autoscaling_group.main.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 70.0
  }
}
```

## Cleanup

### Destroy All Resources

```bash
cd terraform
terraform destroy
```

**Warning:** This deletes:
- VPC and all networking
- ALB and target groups
- ASG and EC2 instances
- ECR repository and images
- IAM roles

**Preserved:**
- S3 backend bucket (manual deletion required)
- DynamoDB state lock table (manual deletion required)
- SSM parameters (manual deletion required)

### Delete Backend Resources

```bash
# Delete S3 bucket
aws s3 rb s3://smarthome-radar-terraform-state --force

# Delete DynamoDB table
aws dynamodb delete-table --table-name smarthome-radar-terraform-locks

# Delete SSM parameters
aws ssm delete-parameters --names $(aws ssm get-parameters-by-path --path /smarthome-radar --query 'Parameters[].Name' --output text)
```

## Next Steps

1. **Set up CloudWatch Alarms** for monitoring
2. **Configure custom domain** with Route 53
3. **Add SSL certificate** for HTTPS
4. **Set up CI/CD pipeline** (GitHub Actions)
5. **Migrate to ECS Fargate** for better scalability (when needed)

## Support

For issues or questions:
- Check CloudWatch Logs: `/aws/ec2/smarthome-radar`
- Review instance user data: `/var/log/cloud-init-output.log`
- Verify SSM parameters: `aws ssm get-parameters-by-path --path /smarthome-radar`
