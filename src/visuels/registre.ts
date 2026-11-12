import type { ZodType } from "zod";
import { CHARTE_CARROUSEL } from "@/briques/visuels/charte-carrousel";
import { CarrouselSpec } from "@/domaine/visuels/schema";
import { InfographieSpec } from "@/domaine/visuels/schema-infographie";

export interface DefinitionVisuel {
  id: string;
  nom: string;
  charte: string;
  schema: ZodType;
}

export const DEFINITION_CARROUSEL: DefinitionVisuel = {
  id: "carrousel/1",
  nom: "Carrousel",
  charte: CHARTE_CARROUSEL.id,
  schema: CarrouselSpec,
};

export const DEFINITION_INFOGRAPHIE: DefinitionVisuel = {
  id: "infographie/1",
  nom: "Infographie",
  charte: CHARTE_CARROUSEL.id,
  schema: InfographieSpec,
};

export const REGISTRE_VISUELS: readonly DefinitionVisuel[] = [DEFINITION_CARROUSEL, DEFINITION_INFOGRAPHIE];
