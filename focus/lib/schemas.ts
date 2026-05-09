import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be under 30 characters')
      .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const subjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Subject name is required')
    .max(60, 'Name must be under 60 characters'),
  description: z.string().max(200, 'Description must be under 200 characters').optional(),
  emoji: z.string().optional(),
  color: z.string().optional(),
});

export const chapterSchema = z.object({
  name: z
    .string()
    .min(1, 'Chapter name is required')
    .max(80, 'Name must be under 80 characters'),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type SignupForm = z.infer<typeof signupSchema>;
export type SubjectForm = z.infer<typeof subjectSchema>;
export type ChapterForm = z.infer<typeof chapterSchema>;
