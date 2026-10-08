import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  APP_URL: z.url().default("http://localhost:3000"),
  // "user:password"; empty disables Basic auth (see src/proxy.ts).
  APP_BASIC_AUTH: z
    .string()
    .regex(/^$|^[^:]+:.+$/, 'APP_BASIC_AUTH must be "user:password"')
    .default(""),
  MIGRATE_ON_START: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Parsed process env. Throws a readable error naming every bad variable. */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment:\n  ${problems.join("\n  ")}`);
  }
  cached = parsed.data;
  return cached;
}
