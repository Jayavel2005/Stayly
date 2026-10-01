import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (e.g. guest@example.com)')
    .transform((val) => val.trim().toLowerCase()),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters in length'),
  rememberMe: z.boolean().default(true).optional(),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be under 80 characters'),
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address (e.g. guest@example.com)')
    .transform((val) => val.trim().toLowerCase()),
  phone: z
    .string()
    .min(8, 'Phone number must be at least 8 digits'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters in length'),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;
