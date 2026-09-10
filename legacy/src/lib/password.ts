import bcrypt from "bcryptjs";
import { z } from "zod";

const ROUNDS = 12;

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That is too long")
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), "Mix letters with a number or capital");

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
