# RDS PostgreSQL Module

This Terraform module provisions an AWS RDS PostgreSQL database instance with best practices for security, backup, and monitoring.

## Features

- PostgreSQL 16.1 (configurable)
- Deployed in private subnets (not publicly accessible)
- Automatic backups with configurable retention
- Optional Multi-AZ deployment for high availability
- Optional read replica for scaling read operations
- Storage encryption enabled by default
- Storage autoscaling
- Enhanced monitoring and Performance Insights (optional)
- CloudWatch log exports
- Deletion protection enabled by default

## Architecture

```
VPC
├── Private Subnet 1 (us-east-1a)
│   └── RDS Primary Instance
└── Private Subnet 2 (us-east-1b)
    └── RDS Standby Instance (if Multi-AZ enabled)
        └── Read Replica (if enabled)

Security Groups:
- RDS SG: Allows PostgreSQL (5432) from EC2 instances only
- EC2 SG: Can connect to RDS on port 5432
```

## Usage

```hcl
module "rds" {
  source = "./modules/rds"

  project_name            = "smarthome-radar"
  vpc_id                  = module.vpc.vpc_id
  private_subnet_ids      = module.vpc.private_subnet_ids
  allowed_security_groups = [aws_security_group.ec2.id]

  # Database Configuration
  db_name         = "smarthome_api"
  master_username = "postgres"
  master_password = var.db_master_password  # Store securely!

  # Instance Configuration
  engine_version = "16.1"
  instance_class = "db.t3.micro"

  # Storage Configuration
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true

  # High Availability
  multi_az = false  # Set to true for production

  # Backup Configuration
  backup_retention_period = 7
  skip_final_snapshot     = false

  # Monitoring
  performance_insights_enabled = false
  monitoring_interval          = 0

  # Protection
  deletion_protection = true

  # Read Replica
  create_read_replica = false
}
```

## Required Inputs

| Name | Description | Type |
|------|-------------|------|
| `project_name` | Project name for resource naming | `string` |
| `vpc_id` | VPC ID where RDS will be deployed | `string` |
| `private_subnet_ids` | List of private subnet IDs for DB subnet group | `list(string)` |
| `allowed_security_groups` | List of security group IDs allowed to access RDS | `list(string)` |
| `master_password` | Master password for RDS | `string` (sensitive) |

## Optional Inputs

| Name | Description | Type | Default |
|------|-------------|------|---------|
| `db_name` | Name of the database to create | `string` | `"smarthome_api"` |
| `master_username` | Master username for RDS | `string` | `"postgres"` |
| `engine_version` | PostgreSQL engine version | `string` | `"16.1"` |
| `instance_class` | RDS instance class | `string` | `"db.t3.micro"` |
| `allocated_storage` | Allocated storage in GB | `number` | `20` |
| `max_allocated_storage` | Maximum storage for autoscaling | `number` | `100` |
| `storage_type` | Storage type (gp2, gp3, io1) | `string` | `"gp3"` |
| `storage_encrypted` | Enable storage encryption | `bool` | `true` |
| `multi_az` | Enable Multi-AZ deployment | `bool` | `false` |
| `backup_retention_period` | Backup retention in days (0-35) | `number` | `7` |
| `skip_final_snapshot` | Skip final snapshot on destroy | `bool` | `false` |
| `performance_insights_enabled` | Enable Performance Insights | `bool` | `false` |
| `monitoring_interval` | Enhanced monitoring interval (0, 1, 5, 10, 15, 30, 60) | `number` | `0` |
| `deletion_protection` | Enable deletion protection | `bool` | `true` |
| `create_read_replica` | Create a read replica | `bool` | `false` |

## Outputs

| Name | Description |
|------|-------------|
| `db_instance_id` | RDS instance ID |
| `db_instance_endpoint` | RDS instance endpoint (host:port) |
| `db_instance_address` | RDS instance hostname |
| `database_url` | DATABASE_URL for Prisma (connection pooling) |
| `direct_url` | DIRECT_URL for Prisma migrations (direct connection) |
| `read_replica_endpoint` | Read replica endpoint (if created) |

## Instance Class Recommendations

| Environment | Instance Class | vCPU | Memory | Use Case |
|-------------|----------------|------|--------|----------|
| Development | `db.t3.micro` | 2 | 1 GB | Testing, low traffic |
| Staging | `db.t3.small` | 2 | 2 GB | Pre-production testing |
| Production (Small) | `db.t3.medium` | 2 | 4 GB | Low-medium traffic |
| Production (Medium) | `db.r6g.large` | 2 | 16 GB | Memory-intensive workloads |
| Production (Large) | `db.r6g.xlarge` | 4 | 32 GB | High traffic, large datasets |

## Cost Optimization Tips

1. **Start small**: Use `db.t3.micro` for development
2. **Disable Multi-AZ**: For non-production environments
3. **Reduce backup retention**: Use 1-3 days for dev/staging
4. **Single NAT Gateway**: Already configured in VPC module
5. **Monitor storage**: Set `max_allocated_storage` to prevent runaway costs
6. **Performance Insights**: Only enable in production

## Security Best Practices

1. **Never commit passwords**: Use environment variables or AWS Secrets Manager
2. **Private subnets only**: RDS is not publicly accessible
3. **Encryption at rest**: Enabled by default
4. **Encryption in transit**: Use SSL connections
5. **IAM authentication**: Consider enabling for passwordless access
6. **Regular backups**: Minimum 7 days retention for production
7. **Deletion protection**: Keep enabled for production databases

## Connection String Format

The module outputs connection strings in the format required by Prisma:

```bash
# DATABASE_URL (for application runtime with connection pooling)
postgresql://postgres:PASSWORD@db-instance.region.rds.amazonaws.com:5432/smarthome_api

# DIRECT_URL (for migrations - direct connection)
postgresql://postgres:PASSWORD@db-instance.region.rds.amazonaws.com:5432/smarthome_api
```

### Using with PgBouncer (Connection Pooling)

For production, consider using PgBouncer or RDS Proxy:

```bash
# RDS Proxy endpoint (port 5432)
DATABASE_URL="postgresql://postgres:PASSWORD@proxy-endpoint.region.rds.amazonaws.com:5432/smarthome_api"

# Direct endpoint (for migrations only)
DIRECT_URL="postgresql://postgres:PASSWORD@db-instance.region.rds.amazonaws.com:5432/smarthome_api"
```

## Maintenance Windows

Default maintenance window: `sun:04:00-sun:05:00` (UTC)
Default backup window: `03:00-04:00` (UTC)

Ensure these don't overlap with peak traffic hours in your timezone.

## Multi-AZ Deployment

When `multi_az = true`:

- AWS automatically provisions a standby replica in a different AZ
- Automatic failover in case of primary instance failure
- ~2x cost of single-AZ deployment
- Recommended for production workloads
- Failover typically completes in 1-2 minutes

## Read Replicas

When `create_read_replica = true`:

- Asynchronous replication from primary instance
- Use for read-heavy workloads (analytics, reporting)
- Can be promoted to primary if needed
- Billed as separate instance
- Minimal replication lag (typically <1 second)

## Monitoring

### CloudWatch Logs

Enabled by default:
- `postgresql` - Database logs
- `upgrade` - Version upgrade logs

### Performance Insights

Enable with `performance_insights_enabled = true`:
- 7-day retention (free tier)
- Query performance analysis
- Wait event analysis
- Recommended for production troubleshooting

### Enhanced Monitoring

Enable with `monitoring_interval = 60` (seconds):
- OS-level metrics
- Process monitoring
- Requires IAM role (automatically created)
- Recommended for production

## Disaster Recovery

### Automated Backups

- Retention: 7 days (configurable 0-35)
- Point-in-time recovery (PITR)
- Stored in S3 (multi-AZ)
- No performance impact

### Manual Snapshots

Create manual snapshots for major changes:

```bash
aws rds create-db-snapshot \
  --db-instance-identifier smarthome-radar-db \
  --db-snapshot-identifier smarthome-radar-db-before-migration
```

### Recovery

Restore from snapshot:

```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier smarthome-radar-db-restored \
  --db-snapshot-identifier smarthome-radar-db-snapshot
```

## Troubleshooting

### Cannot connect to database

1. Check security group rules:
   ```bash
   terraform output db_security_group_id
   ```

2. Verify EC2 instance is in the allowed security group:
   ```bash
   aws ec2 describe-instances --filters "Name=tag:Name,Values=smarthome-radar-instance"
   ```

3. Test connection from EC2 instance:
   ```bash
   psql -h <db_endpoint> -U postgres -d smarthome_api
   ```

### Slow query performance

1. Enable Performance Insights
2. Check connection pooling settings
3. Review CloudWatch metrics (CPU, IOPS)
4. Consider upgrading instance class
5. Add read replica for read-heavy workloads

### Storage full

- Storage autoscaling is enabled by default (max: 100 GB)
- Monitor `FreeStorageSpace` metric in CloudWatch
- Adjust `max_allocated_storage` if needed

## Migration from Supabase/Other PostgreSQL

See parent directory's `MIGRATION_GUIDE.md` for step-by-step instructions on migrating from Supabase to RDS.

## Terraform State

This module creates the following resources:
- `aws_db_instance.main` - Primary database instance
- `aws_db_subnet_group.main` - Subnet group for RDS
- `aws_db_parameter_group.main` - Custom parameter group
- `aws_security_group.rds` - Database security group
- `aws_iam_role.rds_monitoring` - Enhanced monitoring role (if enabled)
- `aws_db_instance.read_replica` - Read replica (if enabled)

## References

- [AWS RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [PostgreSQL on AWS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
