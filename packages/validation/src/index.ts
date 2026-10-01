import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().email();
export const passwordSchema = z.string().min(8).max(128);
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
