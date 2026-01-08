import path from "node:path";
import type { PrismaConfig } from "prisma";
// Note: dotenv not needed in production (env vars provided by AWS SSM)
// import "dotenv/config";

export default {
  // Point to the directory containing schema files
  schema: path.join("prisma", "schema"),

  // Configure migrations path
  migrations: {
    path: path.join("prisma", "migrations")
  }
} satisfies PrismaConfig;
