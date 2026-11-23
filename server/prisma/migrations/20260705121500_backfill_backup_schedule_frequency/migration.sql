UPDATE "BackupJob"
SET "scheduleFrequency" = 'hourly'
WHERE "type" = 'SCHEDULED'
  AND "scheduleFrequency" IS NULL
  AND lower(coalesce("location", '')) LIKE '%_hourly_scheduled%';

UPDATE "BackupJob"
SET "scheduleFrequency" = 'weekly'
WHERE "type" = 'SCHEDULED'
  AND "scheduleFrequency" IS NULL
  AND lower(coalesce("location", '')) LIKE '%_weekly_scheduled%';

UPDATE "BackupJob"
SET "scheduleFrequency" = 'monthly'
WHERE "type" = 'SCHEDULED'
  AND "scheduleFrequency" IS NULL
  AND lower(coalesce("location", '')) LIKE '%_monthly_scheduled%';

UPDATE "BackupJob"
SET "scheduleFrequency" = 'yearly'
WHERE "type" = 'SCHEDULED'
  AND "scheduleFrequency" IS NULL
  AND lower(coalesce("location", '')) LIKE '%_yearly_scheduled%';

UPDATE "BackupJob"
SET "scheduleFrequency" = 'daily'
WHERE "type" = 'SCHEDULED'
  AND "scheduleFrequency" IS NULL
  AND (
    lower(coalesce("location", '')) LIKE '%_daily_scheduled%'
    OR lower(coalesce("location", '')) LIKE '%\daily\%'
    OR lower(coalesce("location", '')) LIKE '%/daily/%'
    OR lower(coalesce("location", '')) LIKE '%_scheduled%'
  );
