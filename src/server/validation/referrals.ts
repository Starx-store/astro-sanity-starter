import { z } from "zod";

export const referralCodeSchema = z.object({
  referralCode: z.string().trim().min(1).max(20).toUpperCase().optional().or(z.literal("")),
});
