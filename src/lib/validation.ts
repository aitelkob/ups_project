import { z } from "zod";

export const roleSchema = z.enum(["DUMPER", "UNZIPPER"]);
export const beltSchema = z.enum(["DEBAG1", "DEBAG2"]);
export const shiftWindowSchema = z.enum(["EARLY", "MID", "LATE"]);
export const flowConditionSchema = z.enum(["NORMAL", "PEAK", "JAM"]);

export const createPersonSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional().or(z.literal("")),
    employeeCode: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .optional()
      .or(z.literal("")),
    active: z.boolean().default(true),
  })
  .refine((data) => Boolean(data.name || data.employeeCode), {
    message: "Either name or employee code is required.",
  });

export const createObservationSchema = z.object({
  personId: z.coerce.number().int().positive(),
  role: roleSchema,
  belt: beltSchema,
  shiftWindow: shiftWindowSchema,
  bagsTimed: z.coerce.number().int().min(1).max(500).default(10),
  totalSeconds: z.coerce.number().int().min(1).max(100000),
  flowCondition: flowConditionSchema.default("NORMAL"),
  qualityIssue: z.boolean().default(false),
  safetyIssue: z.boolean().default(false),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const observationFiltersSchema = z.object({
  role: roleSchema.optional(),
  belt: beltSchema.optional(),
  shiftWindow: shiftWindowSchema.optional(),
  flowCondition: flowConditionSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const reportRangeSchema = z.object({
  start: z.string().min(1),
  end: z.string().min(1),
});

export function parseDateRange(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T23:59:59.999Z`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid date range.");
  }

  if (startDate > endDate) {
    throw new Error("Start date cannot be after end date.");
  }

  return { startDate, endDate };
}
