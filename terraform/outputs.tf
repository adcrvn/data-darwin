output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.app.name
}

output "asg_name" {
  description = "Auto Scaling Group name"
  value       = aws_autoscaling_group.main.name
}

output "iam_role_name" {
  description = "IAM role name for EC2 instances"
  value       = module.iam.role_name
}

output "api_endpoint" {
  description = "API endpoint URL"
  value       = "http://${aws_lb.main.dns_name}"
}

# ==================== RDS Database Outputs ====================

output "db_instance_id" {
  description = "RDS instance ID"
  value       = module.rds.db_instance_id
}

output "db_instance_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = module.rds.db_instance_endpoint
}

output "db_instance_address" {
  description = "RDS instance hostname"
  value       = module.rds.db_instance_address
}

output "db_name" {
  description = "Database name"
  value       = module.rds.db_name
}

output "database_url" {
  description = "DATABASE_URL for Prisma (use this in your .env file)"
  value       = module.rds.database_url
  sensitive   = true
}

output "direct_url" {
  description = "DIRECT_URL for Prisma migrations (use this in your .env file)"
  value       = module.rds.direct_url
  sensitive   = true
}

output "read_replica_endpoint" {
  description = "Read replica endpoint (if created)"
  value       = module.rds.read_replica_endpoint
}

# ==================== S3 Storage Outputs ====================

output "s3_bucket_name" {
  description = "S3 bucket name for radar data storage"
  value       = aws_s3_bucket.radar_data.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.radar_data.arn
}
