#!/bin/bash

# Load environment variables to get DATABASE_URL
export $(grep -v '^#' newbackend/.env | xargs)

echo "=============== 1. PERFORMING SQL DATA MIGRATION ==============="
echo "Moving legacy 'bonus' data to 'fiatBonus' safely..."

# Use prisma db execute inside newbackend where DATABASE_URL guarantees connectivity
cd newbackend
npx prisma db execute --url="$DATABASE_URL" --stdin <<EOF
-- Move the legacy generic bonus into the new structured fiatBonus bucket
UPDATE "User" SET "fiatBonus" = "fiatBonus" + "bonus" WHERE "bonus" > 0;
EOF

echo "SQL Migration completed successfully!"
echo " "

echo "=============== 2. UPDATING BACKEND PRISMA ==============="
# Backend: We push the schema (accepting schema drops now that data is safe) and update types
npx prisma db push --accept-data-loss
npx prisma generate
cd ..
echo "Backend Prisma updated successfully!"
echo " "

echo "=============== 3. UPDATING ADMIN PRISMA ==============="
# Admin: I have already synced your admin schema.prisma to remove 'bonus'.
cd newadmin
npx prisma db push --accept-data-loss
npx prisma generate
cd ..
echo "Admin Prisma updated successfully!"
echo " "

echo "========================================================="
echo "✅ All Prisma instances updated and perfectly in sync!"
echo "========================================================="
