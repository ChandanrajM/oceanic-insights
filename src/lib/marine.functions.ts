import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const fetchMarineConditions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CoordinatesSchema.parse(input))
  .handler(async ({ data }) => {
    const { getMarineConditions } = await import("./marine.server");
    return getMarineConditions(data.latitude, data.longitude);
  });

export const fetchSourceStatuses = createServerFn({ method: "GET" }).handler(async () => {
  const { getSourceStatuses } = await import("./marine.server");
  return getSourceStatuses();
});
