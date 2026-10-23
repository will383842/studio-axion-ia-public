/**
 * Forme du spec lue par la composition. Miroir structurel de `CarrouselSpecType` (le paquet Remotion ne sait pas résoudre
 * l'alias « @/ » du schéma) ; la compatibilité est vérifiée au typage par `tests/visuels/composition-spec.test.ts`.
 * La validation Zod se fait à l'entrée : `src/visuels/proprietes-page.ts`.
 */
import type { TypeDecor } from "../../../../src/briques/visuels/registre-decor";
import type { TypeMini } from "../../../../src/briques/visuels/registre-mini";

export interface CarteSpec {
  titre: string;
  corps: string;
  mini?: TypeMini;
}

export interface EtapeSpec {
  titre: string;
  corps: string;
}

export type PageSpec =
  | { type: "T01"; titre: string; sousTitre?: string }
  | { type: "T01B"; titre: string; sousTitre?: string; deco?: TypeDecor }
  | { type: "T01C"; titre: string; sousTitre?: string; deco?: TypeDecor }
  | { type: "T02"; titre: string; cartes: CarteSpec[] }
  | { type: "T06"; titre: string; points: { texte: string }[] }
  | { type: "T08"; titre: string; avant: string; apres: string }
  | { type: "T10"; message: string; legende?: string; deco?: TypeDecor }
  | { type: "T20"; titre: string; etapes: EtapeSpec[] }
  | { type: "T21" };

export interface SpecVisuel {
  version: "carrousel/1";
  alt: string;
  pages: PageSpec[];
}

/** Propriétés de la composition : le spec validé et la page à dessiner (index dans `spec.pages`). */
export type ProprietesVisuelPage = { spec: SpecVisuel; index: number };
