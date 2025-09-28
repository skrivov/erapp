import { z } from "zod";

export const PolicyEvalSchema = z.object({
  warnings: z.array(z.string()),
  conflicts: z.array(
    z.object({
      rules: z.array(z.string()),
      description: z.string(),
    })
  ),
  gaps: z.array(z.string()),
  suggested_tests: z.array(
    z.object({
      name: z.string(),
      expense: z.object({
        dateISO: z.string(),
        region: z.enum(["US", "EU", "APAC"]),
        department: z.enum(["engineering", "sales", "hr", "other"]).optional(),
        category: z.enum(["ride_hail", "travel", "meals", "software"]),
        total: z.object({
          amount: z.number(),
          currency: z.string(),
        }),
      }),
      expected_steps: z.array(z.string()).optional(),
    })
  ),
});

export type PolicyEvalSchemaT = z.infer<typeof PolicyEvalSchema>;
