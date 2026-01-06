# Deployment Guide

This guide covers deploying the SmartHome Radar API using Docker to various AWS environments.

## Table of Contents
- [Local Development with Docker](#local-development-with-docker)
- [AWS Deployment Options](#aws-deployment-options)
- [Option 1: EC2 with Application Load Balancer (Recommended for Quick Start)](#option-1-ec2-with-application-load-balancer)
- [Option 2: ECS Fargate (Recommended for Production)](#option-2-ecs-fargate)
- [Option 3: EKS (For Complex Requirements)](#option-3-eks)

---

## Local Development with Docker

### Prerequisites
- Docker installed
- Docker Compose installed

### Quick Start

1. **Create `.env` file** (copy from `.env.example`):
```bash
cp .env.example .env
```

2. **Update `.env` with your Supabase credentials**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Database (use local postgres from docker-compose)
DATABASE_URL="postgresql://postgres:postgres@db:5432/smarthome_api"
DIRECT_URL="postgresql://postgres:postgres@db:5432/smarthome_api"
```

3. **Start services**:
```bash
docker-compose up -d
```

4. **Run database migrations**:
```bash
# Access the app container
docker-compose exec app sh

# Run migrations
npx prisma migrate deploy

# Exit container
exit
```

5. **Test the API**:
```bash
# Health check
curl http://localhost:3000/api/healthz

# Upload test packet
curl -X POST http://localhost:3000/api/radar-data \
  -H "Content-Type: application/octet-stream" \
  --data-binary @test-data/sample_packet_minimal.bin
```

### Docker Commands

```bash
# Build and start
docker-compose up --build -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart app only
docker-compose restart app
```

---

## AWS Deployment Options

### Comparison Matrix

| Feature | EC2 + ALB | ECS Fargate | EKS |
|---------|-----------|-------------|-----|
| **Setup Time** | 1-2 hours | 2-3 hours | 4-8 hours |
| **Monthly Cost** | $20-50 | $30-70 | $80-150 |
| **Auto-scaling** | Manual/ASG | Built-in | Built-in |
| **Maintenance** | High | Low | Medium |
| **Best For** | Quick start, low traffic | Production, variable load | Complex microservices |

---

## Option 1: EC2 with Application Load Balancer

**Best for:** Quick deployment, getting started, cost-conscious projects

### Architecture
```
Internet → ALB → EC2 Instance(s) → RDS PostgreSQL
                                  → Supabase Storage
```

### Step-by-Step Deployment

#### 1. Prepare Docker Image

```bash
# Build and tag image
docker build -t smarthome-radar-api:latest .

# Test locally
docker run -p 3000:3000 --env-file .env smarthome-radar-api:latest

# Push to ECR (Elastic Container Registry)
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

aws ecr create-repository --repository-name smarthome-radar-api --region us-east-1

docker tag smarthome-radar-api:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/smarthome-radar-api:latest

docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/smarthome-radar-api:latest
```

#### 2. Launch EC2 Instance

**Instance Type:** t3.small or t3.medium (2-4 GB RAM)

**User Data Script:**
```bash
#!/bin/bash
yum update -y
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Create env file from AWS Systems Manager Parameter Store
aws ssm get-parameter --name /smarthome-api/env --with-decryption --query 'Parameter.Value' --output text > /home/ec2-user/.env

# Run container
docker run -d \
  --name smarthome-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /home/ec2-user/.env \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/smarthome-radar-api:latest
```

#### 3. Security Group Configuration

**Inbound Rules:**
- Port 3000: From ALB security group
- Port 22: Your IP (for SSH access)

**Outbound Rules:**
- All traffic: 0.0.0.0/0 (for database and Supabase access)

#### 4. Create Application Load Balancer

1. **Create Target Group:**
   - Target type: Instances
   - Protocol: HTTP
   - Port: 3000
   - Health check path: `/api/healthz`
   - Health check interval: 30 seconds
   - Healthy threshold: 2
   - Unhealthy threshold: 3

2. **Create ALB:**
   - Scheme: Internet-facing
   - Listeners: HTTP (80) and HTTPS (443)
   - Forward to target group

3. **Register EC2 instance** to target group

#### 5. Store Environment Variables

Store `.env` variables in AWS Systems Manager Parameter Store:

```bash
# Create secure parameter
aws ssm put-parameter \
  --name /smarthome-api/env \
  --type SecureString \
  --value "$(cat .env)"
```

Ensure EC2 instance has IAM role with `ssm:GetParameter` permission.

#### 6. Optional: CloudFront CDN

**When to use CloudFront:**
- Global user base
- DDoS protection needed
- SSL/TLS termination
- Caching static assets

**Setup:**
1. Create CloudFront distribution
2. Origin: ALB DNS name
3. Cache behavior: Allow all HTTP methods (for POST requests)
4. Origin protocol: HTTPS only
5. Viewer protocol: Redirect HTTP to HTTPS

**Note:** For binary uploads (radar data), ensure cache behavior allows POST/PUT methods.

---

## Option 2: ECS Fargate

**Best for:** Production workloads, auto-scaling, lower maintenance

### Architecture
```
Internet → ALB → ECS Fargate Tasks → RDS PostgreSQL
                                    → Supabase Storage
```

### Step-by-Step Deployment

#### 1. Push Image to ECR
(Same as Option 1, Step 1)

#### 2. Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name smarthome-radar-cluster \
  --region us-east-1
```

#### 3. Create Task Definition

Create `task-definition.json`:
```json
{
  "family": "smarthome-radar-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "smarthome-api",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/smarthome-radar-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:smarthome-api/database-url"
        },
        {
          "name": "SUPABASE_SERVICE_ROLE_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:smarthome-api/supabase-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/smarthome-radar-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/api/healthz || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 40
      }
    }
  ]
}
```

Register task definition:
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

#### 4. Create ECS Service

```bash
aws ecs create-service \
  --cluster smarthome-radar-cluster \
  --service-name smarthome-api-service \
  --task-definition smarthome-radar-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...,containerName=smarthome-api,containerPort=3000"
```

#### 5. Auto-scaling (Optional)

```bash
# Register scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/smarthome-radar-cluster/smarthome-api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Create scaling policy (CPU-based)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/smarthome-radar-cluster/smarthome-api-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration file://scaling-policy.json
```

`scaling-policy.json`:
```json
{
  "TargetValue": 70.0,
  "PredefinedMetricSpecification": {
    "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
  },
  "ScaleInCooldown": 300,
  "ScaleOutCooldown": 60
}
```

---

## Option 3: EKS

**Best for:** Complex microservices, existing Kubernetes expertise, multi-region

### Quick Overview

EKS is overkill for a single API service but makes sense if:
- You plan to add multiple microservices
- You need advanced traffic management (service mesh)
- You have Kubernetes expertise in-house
- You're building a platform for multiple services

### Basic Setup

1. **Create EKS Cluster** (use eksctl):
```bash
eksctl create cluster \
  --name smarthome-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4
```

2. **Deploy using Kubernetes manifests**:
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: smarthome-api
spec:
  replicas: 2
  selector:
    matchLabels:
      app: smarthome-api
  template:
    metadata:
      labels:
        app: smarthome-api
    spec:
      containers:
      - name: api
        image: <account-id>.dkr.ecr.us-east-1.amazonaws.com/smarthome-radar-api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: smarthome-api-secrets
        livenessProbe:
          httpGet:
            path: /api/healthz
            port: 3000
          initialDelaySeconds: 40
          periodSeconds: 30
---
apiVersion: v1
kind: Service
metadata:
  name: smarthome-api-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: smarthome-api
```

---

## Recommendations

### For Quick Start (Next 1-3 months)
**→ Option 1: EC2 + ALB**
- Fastest to set up
- Lowest cost
- Easy to understand and troubleshoot
- Can migrate to ECS later

### For Production (Long-term)
**→ Option 2: ECS Fargate**
- Auto-scaling built-in
- No server management
- Pay only for what you use
- Better security (patching handled by AWS)
- Easy CI/CD integration

### CloudFront: Use If...
- You have global users (IoT devices in multiple regions)
- You need DDoS protection
- You want custom domain with SSL

**Don't use if:**
- All devices in same region as API
- Budget is very tight
- Traffic is low (<100 requests/min)

---

## Database Considerations

### Option A: Continue with Supabase
- Already configured
- Includes storage for CSV/binary files
- Lower operational overhead
- No migration needed

### Option B: Migrate to RDS PostgreSQL
- Lower latency within AWS VPC
- More control over configuration
- Can use Supabase only for storage

**Recommendation:** Keep Supabase for now, migrate to RDS only if:
- You see database latency issues
- You need advanced PostgreSQL features
- You want everything in one AWS account

---

## CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: smarthome-radar-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      # For ECS deployment
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster smarthome-radar-cluster --service smarthome-api-service --force-new-deployment
```

---

## Monitoring & Logging

### CloudWatch Logs
All container logs automatically go to CloudWatch Logs.

### Alarms to Set Up

1. **Unhealthy Hosts:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name smarthome-api-unhealthy-hosts \
  --alarm-description "Alert when targets are unhealthy" \
  --metric-name UnHealthyHostCount \
  --namespace AWS/ApplicationELB \
  --statistic Average \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold
```

2. **High CPU:**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name smarthome-api-high-cpu \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold
```

---

## Cost Estimates

### EC2 + ALB (us-east-1)
- t3.small EC2: $15/month
- ALB: $20/month
- Data transfer: $5-10/month
- **Total: ~$40-45/month**

### ECS Fargate
- 2 tasks × 0.5 vCPU × 1GB: $30/month
- ALB: $20/month
- Data transfer: $5-10/month
- **Total: ~$55-60/month**

### EKS
- EKS control plane: $73/month
- 2 × t3.medium nodes: $60/month
- ALB: $20/month
- **Total: ~$150-160/month**

---

## Next Steps

1. **Immediate:** Start with EC2 + ALB for quick deployment
2. **Week 2-4:** Set up CI/CD pipeline
3. **Month 2-3:** Migrate to ECS Fargate for better scaling
4. **Month 3-6:** Add CloudFront if needed for global distribution
5. **Long-term:** Consider multi-region deployment for high availability
