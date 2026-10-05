CREATE TABLE "bootstrap_states" (
  "key" VARCHAR(100) NOT NULL,
  "version" INTEGER NOT NULL,
  "admin_user_id" UUID,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bootstrap_states_pkey" PRIMARY KEY ("key")
);
