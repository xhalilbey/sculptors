import { z } from 'zod';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .min(1, 'Email required')
  // Piped, so an empty field reports only "Email required" (the message the
  // login form shows first), and the format is checked once there is text.
  .pipe(z.email('Enter a valid email'));

/**
 * Login form schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
