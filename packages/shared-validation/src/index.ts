import { z } from 'zod';

/**
 * Customer Authentication Validation Schemas
 * Aligned with DESIGN_SYSTEM.md Form Standards and API contracts
 */

export const customerLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (e.g. guest@stayora.com)')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional().default(true),
});

export type CustomerLoginFormValues = z.infer<typeof customerLoginSchema>;
