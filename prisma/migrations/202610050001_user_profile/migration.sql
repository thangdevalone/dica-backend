ALTER TABLE "users"
ADD COLUMN "identity_number" VARCHAR(20),
ADD COLUMN "date_of_birth" DATE,
ADD COLUMN "phone" VARCHAR(30),
ADD COLUMN "email" VARCHAR(254),
ADD COLUMN "address" VARCHAR(500);

CREATE UNIQUE INDEX "users_organization_id_identity_number_key"
ON "users"("organization_id", "identity_number");
