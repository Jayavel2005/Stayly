-- DropIndex
DROP INDEX IF EXISTS "payments_booking_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "payments_idempotency_key_key";

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "idempotency_key" DROP NOT NULL;

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "attempt_number" SMALLINT NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "status" VARCHAR(20) NOT NULL DEFAULT 'CREATED',
    "gateway_provider" VARCHAR(50) NOT NULL DEFAULT 'MOCK',
    "gateway_reference" VARCHAR(100),
    "payment_method" VARCHAR(50),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_idempotency_key_key" ON "payment_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_attempts_payment_id_idx" ON "payment_attempts"("payment_id");

-- CreateIndex
CREATE INDEX "payment_attempts_booking_id_idx" ON "payment_attempts"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_payment_id_attempt_number_key" ON "payment_attempts"("payment_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "payments_booking_id_key" ON "payments"("booking_id");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payment Attempts Check Constraints
ALTER TABLE "payment_attempts" ADD CONSTRAINT "chk_payment_attempts_status" CHECK ("status" IN ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED'));
ALTER TABLE "payment_attempts" ADD CONSTRAINT "chk_payment_attempts_amount" CHECK ("amount_cents" >= 0);
