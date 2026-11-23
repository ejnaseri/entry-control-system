import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, numbers, dot, underscore, and dash only")
  .transform((value) => value.toLowerCase());

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }
    return value;
  },
  z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional()
);

const optionalFullNameSchema = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") {
      return undefined;
    }
    return value;
  },
  z.string().trim().min(2).max(120).optional()
);

const weakPasswords = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password123",
  "admin12345",
  "atlasgym123",
  "qwerty123",
]);

export const setupOwnerSchema = z
  .object({
    username: usernameSchema,
    password: z.string().min(10).max(256),
    fullName: optionalFullNameSchema,
    email: optionalEmailSchema,
  })
  .superRefine((value, ctx) => {
    if (weakPasswords.has(value.password.toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Password is too common",
      });
    }
    if (value.password.toLowerCase().includes(value.username.toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Password must not contain the username",
      });
    }
  });

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
});

export type SetupOwnerInput = z.infer<typeof setupOwnerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
