-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PROGRAMADA', 'CONFIRMADA', 'ATENDIDA', 'CANCELADA', 'NO_SHOW');

-- AlterTable
ALTER TABLE "Cita" ADD COLUMN     "estado" "EstadoCita" NOT NULL DEFAULT 'PROGRAMADA';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'PATIENT';

-- CreateIndex
CREATE INDEX "Cita_fecha_idx" ON "Cita"("fecha");
