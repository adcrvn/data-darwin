# Scripts

## combine-schemas.js

Combines multiple Prisma schema files from `prisma/schema/` into a single `prisma/combined-schema.prisma` file.

**Why this exists:**
- Prisma's multi-file schema support via `prisma.config.ts` doesn't work reliably in Docker builds
- This script provides a build-time solution to combine schemas for deployment

**When it runs:**
- Automatically before `npm run build` (via prebuild script)
- Automatically during `npm install` (via postinstall script)
- Before any `npm run db:*` commands

**Usage:**
```bash
node scripts/combine-schemas.js
```

**Output:**
- Generates `prisma/combined-schema.prisma` (gitignored)
- Combines all `.prisma` files from `prisma/schema/` directory
- Adds headers indicating the file is auto-generated

**Maintenance:**
- Edit schema files in `prisma/schema/` directory only
- Never edit `prisma/combined-schema.prisma` directly (it will be overwritten)
- The script is automatically run by npm scripts, no manual intervention needed
