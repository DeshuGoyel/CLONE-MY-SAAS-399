import { z } from 'zod';

export const customPromptSchema = z.object({
  prompt: z.string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(500, 'Prompt must be less than 500 characters')
    .refine(
      (val) => !/(kill|violent|nsfw|nude|naked|porn|sex)/i.test(val),
      'Prompt contains prohibited content'
    ),
});

export const regenerateSchema = z.object({
  promptIds: z.array(z.number()).min(1).max(10),
  styleOverrides: z.array(z.object({
    clothing: z.string(),
    background: z.string(),
  })).optional(),
  customPrompt: z.string().max(500).optional(),
});

export const referralCodeSchema = z.object({
  referralCode: z.string().length(8).regex(/^[A-Z0-9]{8}$/),
});

export const imageUploadSchema = z.object({
  fileName: z.string(),
  fileSize: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  fileType: z.enum(['image/jpeg', 'image/png', 'image/jpg', 'image/webp']),
  width: z.number().min(512, 'Image width must be at least 512px'),
  height: z.number().min(512, 'Image height must be at least 512px'),
});

export const analyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CustomPromptInput = z.infer<typeof customPromptSchema>;
export type RegenerateInput = z.infer<typeof regenerateSchema>;
export type ReferralCodeInput = z.infer<typeof referralCodeSchema>;
export type ImageUploadInput = z.infer<typeof imageUploadSchema>;
export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
