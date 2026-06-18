#!/bin/bash

# Load environment variables (ensure DATABASE_URL is set)
export $(grep -v '^#' newbackend/.env | xargs)

echo "Starting data migration: Moving legacy 'bonus' data to 'fiatBonus'..."

# Execute the raw SQL migration using Prisma
cd newadmin
npx prisma db execute --url="$DATABASE_URL" --stdin <<EOF
-- Move the legacy generic bonus into the new structured fiatBonus bucket
UPDATE "User" SET "fiatBonus" = "fiatBonus" + "bonus" WHERE "bonus" > 0;
EOF

echo "Data migration successful. Now safely dropping the old 'bonus' column..."

# Apply the Prisma schema changes and drop the column
npx prisma db push --accept-data-loss

echo "Database successfully updated!"
