import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Please enter your administrator email')
    .email('Please enter a valid email address (e.g. devansh.mehta@stayora.internal)')
    .trim(),
  password: z
    .string()
    .min(1, 'Please enter your password')
    .min(8, 'Password must be at least 8 characters long'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
