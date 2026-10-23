import type { z } from "zod";
import type { CarrouselSpec, Page } from "./schema";

export type CarrouselSpecType = z.infer<typeof CarrouselSpec>;
export type PageSpec = z.infer<typeof Page>;
