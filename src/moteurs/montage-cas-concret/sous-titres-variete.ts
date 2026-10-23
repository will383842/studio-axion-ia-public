/**
 * CAS CONCRET · VARIÉTÉ DES SOUS-TITRES (lot L3b, « leviers sans risque »). PUR, déterministe.
 *
 * Traduit `mise.tirage.sousTitres` (L2, `variete.ts`) en paramètres FACULTATIFS de la brique commune des sous-titres :
 *  - inclinaison « inverse » : le premier Impact penche dans l'autre sens (les suivants alternent toujours) ;
 *  - intensité « calme » / « vif » : réglages de l'intensité réellement employée par le format (« Équilibré », base
 *    Minimal) un peu moins / un peu plus fournis, sans franchir les planchers de la brique (`PLANCHERS_VARIATION`) ;
 *  - accent « surlignage » : le mot mis en avant sur un fond orange de la charte (#F0703C sur sombre, texte encre ;
 *    #C2532A sur ivoire, texte ivoire) au lieu du trait ;
 *  - hauteur « haute » : la ligne un peu plus haut, mais TOUJOURS dans la bande des sous-titres du format
 *    (`BANDE_SOUS_TITRES_CAS_CONCRET`, `zonesEcran`) : jamais dans le haut de l'image, jamais sur un titre. Le contrôle
 *    de la PR #255 (`zonesOccupeesSousTitres` : haut de l'image toujours occupé) reste appliqué tel quel.
 * Valeur « v4 » (ou aucune mise) : rien n'est ajouté, l'appel à la brique reste strictement celui de la v4.
 */
import { zonesEcran } from "@/briques/ecrans-motion";
import { COULEURS_DUO } from "@/briques/habillage/charte-duo";
import type { SurlignageSousTitres, VariationSousTitres } from "@/briques/sous-titres";
import { BANDE_SOUS_TITRES_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";
import type { Tirage } from "./variete";
import { centreSousTitresPleineImagePct } from "./zone-objets";

export type TirageSousTitres = Tirage["sousTitres"];

/**
 * Réglages par intensité tirée (le format emploie « Équilibré » : Impact ≥ 6 s, un bandeau / 15 s, souligné 1 sur 5).
 * Calme : moins d'accents (un seul bandeau par tranche de 40 s) ; vif : un peu plus (souligné 1 sur 3, plancher de la
 * brique ; jamais sous les planchers : Impact ≥ 4 s, un bandeau / 10 s au plus).
 */
export const REGLAGES_SOUS_TITRES_CAS_CONCRET = Object.freeze({
  calme: Object.freeze({ impactEcartSec: 9, bandeauToutesLesSec: 40, souligneUnSur: 7 }),
  vif: Object.freeze({ impactEcartSec: 5, bandeauToutesLesSec: 12, souligneUnSur: 3 }),
});

/** Surlignage de la charte : orange vif sur sombre (texte encre), orange sur ivoire (texte ivoire). */
export const SURLIGNAGE_CAS_CONCRET: SurlignageSousTitres = Object.freeze({
  fond: COULEURS_DUO.orangeVif,
  texte: COULEURS_DUO.encre,
  fondClair: COULEURS_DUO.orange,
  texteClair: COULEURS_DUO.ivoire,
});

/**
 * Hauteur « haute » : centre de la ligne à 1,75 % de la hauteur sous le HAUT de la bande des sous-titres (v4 : 2,5 %),
 * soit ≈ 14 px plus haut sur 1 920. Une ligne de base (60 px, interligne 1,1) y tient encore entière dans la bande : le
 * plus haut possible sans toucher la zone des objets.
 */
export function centreSousTitresHautPct(hauteur = 1920): number {
  const { sousTitres } = zonesEcran(ZONE_PLEINE_IMAGE_CAS_CONCRET, 1080, hauteur, BANDE_SOUS_TITRES_CAS_CONCRET);
  return +(((sousTitres.y + 0.0175 * hauteur) / hauteur) * 100).toFixed(2);
}

/** Centre des sous-titres (% de la hauteur) selon le tirage : la v4 (`centreSousTitresPleineImagePct`) ou « haute ». */
export function centreSousTitresCasConcret(t?: TirageSousTitres | null): number {
  return t?.hauteur === "haute" ? centreSousTitresHautPct() : centreSousTitresPleineImagePct();
}

/** Champ à ajouter au style des sous-titres : `{ surlignage }` pour l'accent « surlignage », sinon rien. */
export function surlignageCasConcret(t?: TirageSousTitres | null): { surlignage?: SurlignageSousTitres } {
  return t?.accent === "surlignage" ? { surlignage: SURLIGNAGE_CAS_CONCRET } : {};
}

/** Variation du mélange (sens du premier Impact, réglages) ; `{}` quand inclinaison et intensité sont celles de la v4. */
export function variationSousTitresCasConcret(t?: TirageSousTitres | null): { variation?: VariationSousTitres } {
  if (!t) return {};
  const variation: VariationSousTitres = {
    ...(t.inclinaison === "inverse" ? { sensPremierImpact: -1 as const } : {}),
    ...(t.intensite === "calme" || t.intensite === "vif" ? { reglages: { ...REGLAGES_SOUS_TITRES_CAS_CONCRET[t.intensite] } } : {}),
  };
  return Object.keys(variation).length ? { variation } : {};
}
