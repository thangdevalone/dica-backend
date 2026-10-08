-- AlterTable
ALTER TABLE "supplier_ingredients"
ADD COLUMN "is_preferred" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "supplier_ingredients_ingredient_id_is_preferred_active_idx"
ON "supplier_ingredients"("ingredient_id", "is_preferred", "active");

-- Enforce one active preferred supplier per ingredient.
CREATE UNIQUE INDEX "supplier_ingredients_one_active_preferred_per_ingredient_key"
ON "supplier_ingredients"("ingredient_id")
WHERE "is_preferred" = true AND "active" = true;

-- CreateTable
CREATE TABLE "group_eligibilities" (
    "id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "department_id" UUID NOT NULL,
    "ingredient_group_id" UUID NOT NULL,
    "max_quantity_per_request" DECIMAL(20,3),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "group_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_eligibilities_facility_id_department_id_ingredient_group_id_key"
ON "group_eligibilities"("facility_id", "department_id", "ingredient_group_id");

-- CreateIndex
CREATE INDEX "group_eligibilities_ingredient_group_id_active_idx"
ON "group_eligibilities"("ingredient_group_id", "active");

-- AddForeignKey
ALTER TABLE "group_eligibilities"
ADD CONSTRAINT "group_eligibilities_facility_id_fkey"
FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_eligibilities"
ADD CONSTRAINT "group_eligibilities_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_eligibilities"
ADD CONSTRAINT "group_eligibilities_ingredient_group_id_fkey"
FOREIGN KEY ("ingredient_group_id") REFERENCES "ingredient_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
