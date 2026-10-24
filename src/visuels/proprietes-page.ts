import type { Cadre } from "../briques/visuels/reseaux";
import { CarrouselSpec } from "../domaine/visuels/schema";
import type { CarrouselSpecType } from "../domaine/visuels/types";

/**
 * Version de la composition des pages de carrousel (`studio-rendu/compositions/visuels/`) : à changer avec elle, ET avec `VERSION_RENDU`
 * (`services/rendu.ts`, test `version-composition`). Ce fichier est dans l'image de studio-rendu : les deux côtés lisent la même valeur.
 */
export const VERSION_COMPOSITION = "visuel-page/9";

/** Spec validé : le CarrouselSpec, plus la version de la composition qui doit le dessiner (elle entre dans l'empreinte du rendu). */
export type SpecValide = CarrouselSpecType & { composition: typeof VERSION_COMPOSITION };

export interface ProprietesPageValides {
  spec: SpecValide;
  index: number;
  /** Cadre du réseau visé (H2) : absent = rendu habituel, identique à celui d'avant les cadres. */
  cadre?: Cadre;
}

const CADRES: readonly Cadre[] = ["linkedin", "meta"];

/**
 * Porte d'entrée de la composition `VisuelPage` : le spec passe par le schéma Zod strict (aucune URL, aucune propriété libre)
 * AVANT d'arriver à Remotion, et l'index doit désigner une page du spec. Lève une erreur sinon.
 * Mise en ligne simultanée (ART-1, tour 2) : le spec validé porte `composition` = `VERSION_COMPOSITION`. Le studio l'envoie à studio-rendu ;
 * un studio-rendu d'une AUTRE version le refuse ici, un studio-rendu plus ANCIEN (qui ne connaît pas la clé) le refuse par son schéma
 * strict : jamais un rendu de l'ancienne composition rangé sous l'empreinte de la nouvelle. Un spec sans la clé (studio plus ancien) passe.
 * `cadre` (H2, facultatif) : « linkedin » ou « meta » (`src/briques/visuels/reseaux.ts`), toute autre valeur est refusée ; absent, il
 * n'apparaît pas dans le résultat (mêmes propriétés, même rendu qu'avant).
 */
export function validerProprietesPage(brut: unknown): ProprietesPageValides {
  if (typeof brut !== "object" || brut === null) throw new Error("Propriétés de VisuelPage invalides : objet attendu");
  const { spec, index, cadre, ...autres } = brut as Record<string, unknown>;
  if (Object.keys(autres).length > 0) throw new Error(`Propriétés de VisuelPage invalides : clé inconnue « ${Object.keys(autres)[0]} »`);
  const { composition, ...carrousel } = typeof spec === "object" && spec !== null ? (spec as Record<string, unknown>) : { composition: undefined };
  if (composition !== undefined && composition !== VERSION_COMPOSITION) {
    throw new Error(`Version de composition « ${String(composition)} » demandée, ce studio-rendu dessine « ${VERSION_COMPOSITION} » : rendu refusé (mise en ligne en cours ? réessayez quand les deux versions sont en ligne)`);
  }
  const analyse = CarrouselSpec.safeParse(typeof spec === "object" && spec !== null ? carrousel : spec);
  if (!analyse.success) throw new Error(`Spec de carrousel invalide : ${analyse.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= analyse.data.pages.length) {
    throw new Error(`Index de page invalide : ${String(index)} (le spec a ${analyse.data.pages.length} page(s))`);
  }
  if (cadre !== undefined && !CADRES.includes(cadre as Cadre)) throw new Error(`Propriétés de VisuelPage invalides : cadre « ${String(cadre)} » inconnu (linkedin ou meta)`);
  const valides: ProprietesPageValides = { spec: { ...analyse.data, composition: VERSION_COMPOSITION }, index };
  if (cadre !== undefined) valides.cadre = cadre as Cadre;
  return valides;
}
