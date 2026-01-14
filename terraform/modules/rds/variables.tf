variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where RDS will be deployed"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for DB subnet group"
  type        = list(string)
}

variable "allowed_security_groups" {
  description = "List of security group IDs allowed to access RDS"
  type        = list(string)
}

# Database Configuration
variable "db_name" {
  description = "Name of the database to create"
  type        = string
  default     = "smarthome_api"
}

variable "master_username" {
  description = "Master username for RDS"
  type        = string
  default     = "postgres"
}

variable "master_password" {
  description = "Master password for RDS (should be stored in secrets manager in production)"
  type        = string
  sensitive   = true
}

# Engine Configuration
variable "engine_version" {
  description = "PostgreSQL engine version"
  type        = string
  default     = "16.1"
}

variable "db_parameter_group_family" {
  description = "DB parameter group family"
  type        = string
  default     = "postgres16"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

# Storage Configuration
variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Maximum storage for autoscaling in GB (0 to disable)"
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "Storage type (gp2, gp3, io1)"
  type        = string
  default     = "gp3"
}

variable "storage_encrypted" {
  description = "Enable storage encryption"
  type        = bool
  default     = true
}

# High Availability
variable "multi_az" {
  description = "Enable Multi-AZ deployment for high availability"
  type        = bool
  default     = false
}

# Backup Configuration
variable "backup_retention_period" {
  description = "Backup retention period in days (0-35)"
  type        = number
  default     = 7
}

variable "backup_window" {
  description = "Preferred backup window (UTC)"
  type        = string
  default     = "03:00-04:00"
}

variable "maintenance_window" {
  description = "Preferred maintenance window (UTC)"
  type        = string
  default     = "sun:04:00-sun:05:00"
}

variable "skip_final_snapshot" {
  description = "Skip final snapshot when destroying database"
  type        = bool
  default     = false
}

# Monitoring
variable "enabled_cloudwatch_logs_exports" {
  description = "List of log types to export to CloudWatch (postgresql, upgrade)"
  type        = list(string)
  default     = ["postgresql", "upgrade"]
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights"
  type        = bool
  default     = false
}

variable "monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0, 1, 5, 10, 15, 30, 60)"
  type        = number
  default     = 0
}

# Database Parameters
variable "max_connections" {
  description = "Maximum number of database connections"
  type        = string
  default     = "100"
}

# Protection
variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "auto_minor_version_upgrade" {
  description = "Enable automatic minor version upgrades"
  type        = bool
  default     = true
}

# Read Replica
variable "create_read_replica" {
  description = "Create a read replica"
  type        = bool
  default     = false
}

variable "replica_instance_class" {
  description = "Instance class for read replica (uses main instance class if empty)"
  type        = string
  default     = ""
}

# External Access via NLB
variable "nlb_allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access RDS via NLB (external access)"
  type        = list(string)
  default     = []
}
