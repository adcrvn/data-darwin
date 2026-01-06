#!/bin/bash
set -e

# Update system
yum update -y

# Install Docker
yum install -y docker

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user

# Install AWS CLI v2 (if not already installed)
if ! command -v aws &> /dev/null; then
    curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
    unzip awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# Login to ECR
aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin ${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com

# Fetch environment variables from SSM Parameter Store
# Store them in /home/ec2-user/.env file
cat > /home/ec2-user/.env << 'EOF'
# Environment variables fetched from SSM Parameter Store
EOF

# Fetch each parameter and append to .env
# Database
DATABASE_URL=$(aws ssm get-parameter --name "/${project_name}/DATABASE_URL" --with-decryption --query 'Parameter.Value' --output text --region ${aws_region} 2>/dev/null || echo "")
DIRECT_URL=$(aws ssm get-parameter --name "/${project_name}/DIRECT_URL" --with-decryption --query 'Parameter.Value' --output text --region ${aws_region} 2>/dev/null || echo "")

# Supabase
NEXT_PUBLIC_SUPABASE_URL=$(aws ssm get-parameter --name "/${project_name}/NEXT_PUBLIC_SUPABASE_URL" --query 'Parameter.Value' --output text --region ${aws_region} 2>/dev/null || echo "")
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(aws ssm get-parameter --name "/${project_name}/NEXT_PUBLIC_SUPABASE_ANON_KEY" --query 'Parameter.Value' --output text --region ${aws_region} 2>/dev/null || echo "")
SUPABASE_SERVICE_ROLE_KEY=$(aws ssm get-parameter --name "/${project_name}/SUPABASE_SERVICE_ROLE_KEY" --with-decryption --query 'Parameter.Value' --output text --region ${aws_region} 2>/dev/null || echo "")

# App config
NEXT_PUBLIC_APP_URL=$(aws ssm get-parameter --name "/${project_name}/NEXT_PUBLIC_APP_URL" --query 'Parameter.Value' --output text --region ${aws_region} 2>/dev/null || echo "")

# Write to .env file
{
    echo "DATABASE_URL=$DATABASE_URL"
    echo "DIRECT_URL=$DIRECT_URL"
    echo "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL"
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY"
    echo "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL"
    echo "NODE_ENV=production"
} >> /home/ec2-user/.env

# Set proper permissions
chown ec2-user:ec2-user /home/ec2-user/.env
chmod 600 /home/ec2-user/.env

# Pull and run the Docker container
IMAGE_URI="${aws_account_id}.dkr.ecr.${aws_region}.amazonaws.com/${ecr_repository_name}:${container_image_tag}"

docker pull $IMAGE_URI

# Stop and remove existing container if it exists
docker stop smarthome-api 2>/dev/null || true
docker rm smarthome-api 2>/dev/null || true

# Run the container
docker run -d \
  --name smarthome-api \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file /home/ec2-user/.env \
  --log-driver=awslogs \
  --log-opt awslogs-region=${aws_region} \
  --log-opt awslogs-group=/aws/ec2/${project_name} \
  --log-opt awslogs-create-group=true \
  $IMAGE_URI

# Wait for container to be healthy
echo "Waiting for container to be healthy..."
for i in {1..30}; do
  if docker exec smarthome-api curl -f http://localhost:3000/api/healthz > /dev/null 2>&1; then
    echo "Container is healthy!"
    break
  fi
  echo "Attempt $i/30: Container not ready yet, waiting..."
  sleep 5
done

# Log the deployment
echo "Deployment completed at $(date)" >> /var/log/deployment.log
echo "Image: $IMAGE_URI" >> /var/log/deployment.log
