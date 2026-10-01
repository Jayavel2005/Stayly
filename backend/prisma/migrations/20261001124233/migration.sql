-- AlterTable
ALTER TABLE "hotels" ALTER COLUMN "check_in_time" SET DEFAULT '14:00:00'::time,
ALTER COLUMN "check_out_time" SET DEFAULT '11:00:00'::time;
