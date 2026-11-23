import { z } from "zod";

export const soundSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  accessAllowedSoundId: z.string().cuid().nullable().optional(),
  accessDeniedSoundId: z.string().cuid().nullable().optional(),
  alertSoundId: z.string().cuid().nullable().optional(),
  accessAllowedVolume: z.number().min(0).max(1).optional(),
  accessDeniedVolume: z.number().min(0).max(1).optional(),
  alertVolume: z.number().min(0).max(1).optional(),
});

export type SoundSettingsInput = z.infer<typeof soundSettingsSchema>;
