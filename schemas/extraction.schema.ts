import { z } from "zod";

// Optional itemization for receipts that include multiple lines (e.g., base fare, taxes, fees, tip)
export const LineItemSchema = z.object({
  label: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3).optional(), // defaults to parent currency if omitted
});

const ExtractionSchemaBase = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  dateISO: z.string().datetime(),
  // Vendor can be any taxi/ride-hailing provider name as printed
  vendor: z.string().min(1),
  pickupCountry: z.string().optional(),
  pickupCity: z.string().optional(),
  // Category is business classification, not always on receipt; may be supplied/confirmed by user
  category: z.enum(["ride_hail", "travel", "meals", "software"]).optional(),
  inferredDepartment: z
    .enum(["engineering", "sales", "hr", "other"])
    .optional(),
  // Optional itemization; when present (non-empty), amounts should sum to total (checked in refinement)
  items: z.array(LineItemSchema).optional(),
  confidence: z.object({
    amount: z.number(),
    currency: z.number(),
    dateISO: z.number(),
    pickupCountry: z.number().optional(),
    // Category confidence reflects inference quality (not on receipt)
    category: z.number().optional(),
    inferredDepartment: z.number().optional(),
  }),
});

export const ExtractionSchema = ExtractionSchemaBase;

export type ExtractionSchemaT = z.infer<typeof ExtractionSchema>;
