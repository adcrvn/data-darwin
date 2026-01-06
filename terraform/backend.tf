terraform {
  backend "s3" {
    bucket         = "smarthome-radar-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "smarthome-radar-terraform-locks"
  }
}
