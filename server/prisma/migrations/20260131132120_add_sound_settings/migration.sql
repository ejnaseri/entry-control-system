-- CreateTable
CREATE TABLE "SoundAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoundSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "accessAllowedSoundId" TEXT,
    "accessDeniedSoundId" TEXT,
    "alertSoundId" TEXT,
    "accessAllowedVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "accessDeniedVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "alertVolume" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoundSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SoundAsset_createdAt_idx" ON "SoundAsset"("createdAt");

-- AddForeignKey
ALTER TABLE "SoundSettings" ADD CONSTRAINT "SoundSettings_accessAllowedSoundId_fkey" FOREIGN KEY ("accessAllowedSoundId") REFERENCES "SoundAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoundSettings" ADD CONSTRAINT "SoundSettings_accessDeniedSoundId_fkey" FOREIGN KEY ("accessDeniedSoundId") REFERENCES "SoundAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoundSettings" ADD CONSTRAINT "SoundSettings_alertSoundId_fkey" FOREIGN KEY ("alertSoundId") REFERENCES "SoundAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
