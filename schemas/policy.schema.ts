import { z } from "zod";

const money = z.object({
  amount: z.number(),
  currency: z.string().length(3),
});

const selectors = z
  .object({
    region: z.enum(["US", "EU", "APAC"]).optional(),
    department: z.enum(["engineering", "sales", "hr", "other"]).optional(),
    category: z.enum(["ride_hail", "travel", "meals", "software"]).optional(),
  })
  .partial();

const ruleEffect = z.object({
  always_require_steps: z.array(z.string()).optional(),
  require_steps_if: z
    .array(
      z.object({
        when: z
          .object({
            amount_gt: money.optional(),
          })
          .strict(),
        steps: z.array(z.string()).min(1),
      })
    )
    .optional(),
  skip_steps_below: z
    .array(
      z.object({
        step: z.string(),
        amount: z.number(),
        currency: z.string().length(3),
      })
    )
    .optional(),
  category_routes: z.record(z.array(z.string()).min(1)).optional(),
});

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  priority: z.number(),
  effective_from: z.string().datetime(),
  effective_to: z.string().datetime().optional(),
  selectors,
  effect: ruleEffect,
  comment: z.string().optional(),
});

export const PoliciesSchema = z.array(RuleSchema);

export type RuleSchemaT = z.infer<typeof RuleSchema>;
