/**
 * IMAGE → VIDÉO · Sous-titres mot à mot (lot L11, plan 50 § 5, Q22). PUR, déterministe.
 *
 * - groupes de 2 à 4 mots (brique commune `briques/sous-titres`, règles typographiques comprises), chaque mot avec son
 *   heure : le mot dit s'allume quand il est dit (mot à mot) ;
 * - le mot fort de chaque plan (le `*mot*` orange de l'écran) est orange dans les sous-titres aussi ;
 * - couleurs de la charte : encre #15100c sur ivoire, ivoire sur sombre, sans ombre ;
 * - position (décision de la direction : sous-titres VISIBLES PARTOUT) : la bande `BANDE_SOUS_TITRES_IV`, LA MÊME pour
 *   toutes les versions, se termine au-dessus de la limite la plus contraignante des réseaux (table
 *   `LIMITES_BAS_SOUS_TITRES_IV`, marge comprise) ; la zone utile du contenu s'arrête juste au-dessus (`ZONE_UTILE_IV.bas`).
 *   SEULE SOURCE : `briques/schema-motion/types.ts`, lue aussi par les compositions ; aucune valeur recopiée ici.
 * - 4:5 (lot F45 : LinkedIn, fil Facebook) : la bande du 4:5 (`MISE_EN_PAGE_IV["4:5"]`, y 1042 → 1176), au-dessus des
 *   zones masquées 4:5 du registre (le fil Facebook n'en a pas : celles de LinkedIn, comme le doc 73) ; le 9:16 est
 *   inchangé (mêmes valeurs, même objet rendu, sans champ `format`).
 */
import type { MotHorodate } from "@/domaine/types";
import { RESEAUX_IV, RESEAUX_IV_HISTORIQUE, type ReseauIV } from "@/domaine/image-video/plafonds";
import { grouperMots } from "@/briques/sous-titres/groupement";
import { recollerElisionsHorodatees } from "@/briques/sous-titres/recollage";
import { BANDE_SOUS_TITRES_IV, MISE_EN_PAGE_IV, ZONE_UTILE_IV, type FormatEcranIV } from "@/briques/schema-motion/types";
import { COULEURS_DUO, TAILLE_PLANCHER_DUO } from "@/briques/habillage/charte-duo";
import { zoneProtegeeCombinee } from "@/reseaux";
import { cleMot } from "./calage";

/** Marge entre le bas des sous-titres et la zone masquée (fraction de la hauteur). */
export const MARGE_SOUS_TITRES = 0.02;
/** Hauteur d'une ligne de sous-titres (fraction de la hauteur) : au-dessus du plancher de la charte (0,03). */
export const TAILLE_SOUS_TITRES = 0.036;
/** Les 20 % du bas : jamais de sous-titres, quel que soit le réseau. */
export const BAS_ABSOLU_SOUS_TITRES = 0.8;
/** 4:5 : jamais de sous-titres dans les 10 % du bas (barre de lecture des fils LinkedIn et Facebook). */
export const BAS_ABSOLU_SOUS_TITRES_4X5 = 0.9;
/** Réseau dont les zones 4:5 servent à un réseau qui n'en a pas dans le registre (fil Facebook : doc 73 § 1). */
const RESEAU_ZONES_4X5_PAR_DEFAUT: ReseauIV = "linkedin";
export const COULEURS_SOUS_TITRES = Object.freeze({ surIvoire: COULEURS_DUO.encre, surSombre: COULEURS_DUO.ivoire, accent: COULEURS_DUO.orange });

export interface MotSousTitre {
  mot: string;
  debutSec: number;
  finSec: number;
  orange: boolean;
}

export interface GroupeSousTitresIV {
  id: string;
  debutSec: number;
  finSec: number;
  mots: MotSousTitre[];
}

/** Bande des sous-titres, fractions de la hauteur (haut et bas). */
export type BandeSousTitresIV = { haut: number; bas: number };

export interface SousTitresIV {
  groupes: GroupeSousTitresIV[];
  bande: BandeSousTitresIV;
  taille: number;
  ombre: false;
  /** Format de la bande : présent seulement en 4:5 (le 9:16 reste octet pour octet celui d'avant). */
  format?: "4:5";
}

/**
 * Bas permis des sous-titres au-dessus de la zone masquée de chaque réseau visé (9:16), marge de 2 % comprise. Les zones
 * masquées viennent du registre `src/reseaux` (seule source, sources citées là) : Instagram et Facebook 30 % du bas
 * (guide Meta des Reels, organique), TikTok 26 %, YouTube Shorts 20 %, LinkedIn 14 % ; jamais dans les 20 % du bas.
 */
export function basPermisSousTitres(reseaux: readonly ReseauIV[], format: FormatEcranIV = "9:16"): number {
  if (format === "4:5") {
    const masques = reseaux.map((r) => zoneProtegeeCombinee("4:5", [r]) ?? zoneProtegeeCombinee("4:5", [RESEAU_ZONES_4X5_PAR_DEFAUT]));
    const masque = Math.max(0, ...masques.map((z) => (z ? z.bas / 100 : 0)));
    return Math.min(BAS_ABSOLU_SOUS_TITRES_4X5, 1 - masque - MARGE_SOUS_TITRES);
  }
  const zone = zoneProtegeeCombinee("9:16", [...reseaux]);
  const masque = zone ? zone.bas / 100 : 0;
  return Math.min(BAS_ABSOLU_SOUS_TITRES, 1 - masque - MARGE_SOUS_TITRES);
}

/** Table des limites (bas permis des sous-titres, fraction de la hauteur) réseau par réseau : Q22 la vérifie, bloquant. */
export const LIMITES_BAS_SOUS_TITRES_IV: Readonly<Record<ReseauIV, number>> = Object.freeze(
  Object.fromEntries(RESEAUX_IV_HISTORIQUE.map((r) => [r, basPermisSousTitres([r])])) as Record<ReseauIV, number>,
);

/** Table 4:5 des limites (LinkedIn et fil Facebook ; les autres réseaux ne sortent qu'en 9:16). */
export const LIMITES_BAS_SOUS_TITRES_4X5_IV: Readonly<Record<ReseauIV, number>> = Object.freeze(
  Object.fromEntries(RESEAUX_IV_HISTORIQUE.map((r) => [r, basPermisSousTitres([r], "4:5")])) as Record<ReseauIV, number>,
);

/** Bande des sous-titres : celle de la mise en page du format, la même pour tous les réseaux du format. */
export function bandeSousTitres(format: FormatEcranIV = "9:16"): BandeSousTitresIV {
  const b = format === "4:5" ? MISE_EN_PAGE_IV["4:5"].bandeSousTitres : BANDE_SOUS_TITRES_IV;
  return { haut: b.haut, bas: b.bas };
}

/** Un mot fort (orange) d'un intervalle : le mot orange de l'écran affiché à ce moment. */
export type MotFort = { debutSec: number; finSec: number; mot: string };

/** Sous-titres mot à mot d'une version : groupes de 2 à 4 mots, mot fort en orange, bande hors de toutes les zones masquées. */
export function sousTitresIV(mots: readonly MotHorodate[], options: { reseaux: readonly ReseauIV[]; motsForts?: readonly MotFort[]; format?: FormatEcranIV }): SousTitresIV {
  const forts = (options.motsForts ?? []).map((f) => ({ ...f, cles: cleMot(f.mot).split(" ").filter(Boolean) }));
  const groupes = grouperMots(recollerElisionsHorodatees([...mots]), { motsMin: 2, motsMax: 4 }).map((g) => ({
    id: g.id,
    debutSec: g.debutSec,
    finSec: g.finSec,
    mots: g.mots.map((m) => {
      const cle = cleMot(m.mot);
      const orange = forts.some((f) => m.debutSec >= f.debutSec - 1e-6 && m.debutSec < f.finSec && f.cles.length > 0 && cle.split(" ").includes(f.cles[0]));
      return { mot: m.mot, debutSec: m.debutSec, finSec: m.finSec, orange };
    }),
  }));
  const format = options.format ?? "9:16";
  return { groupes, bande: bandeSousTitres(format), taille: TAILLE_SOUS_TITRES, ombre: false, ...(format === "4:5" ? { format } : {}) };
}

/**
 * Q22 (BLOQUANT) · Sous-titres dans la bande de la mise en page, jamais sur le contenu (zone utile jusqu'à
 * `ZONE_UTILE_IV.bas`), jamais dans les 20 % du bas, jamais dans la zone masquée d'un réseau visé (table
 * `LIMITES_BAS_SOUS_TITRES_IV`), taille au plancher de la charte. Sans réseau précisé : tous les réseaux du format (la
 * bande est la même pour toutes les versions). Format : celui des sous-titres (`st.format`, absent = 9:16), sauf s'il
 * est donné. Rend une phrase par défaut (vide = conforme).
 */
export function controlerSousTitresIV(st: Pick<SousTitresIV, "bande" | "taille" | "format">, reseaux: readonly ReseauIV[] = RESEAUX_IV, format: FormatEcranIV = st.format ?? "9:16"): string[] {
  const defauts: string[] = [];
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const attendue = bandeSousTitres(format);
  const utileBas = format === "4:5" ? MISE_EN_PAGE_IV["4:5"].zoneUtile.bas : ZONE_UTILE_IV.bas;
  const limites = format === "4:5" ? LIMITES_BAS_SOUS_TITRES_4X5_IV : LIMITES_BAS_SOUS_TITRES_IV;
  if (Math.abs(st.bande.haut - attendue.haut) > 1e-9 || Math.abs(st.bande.bas - attendue.bas) > 1e-9) {
    defauts.push(`Les sous-titres ne sont pas dans leur bande (${pct(st.bande.haut)}-${pct(st.bande.bas)} au lieu de ${pct(attendue.haut)}-${pct(attendue.bas)} de la hauteur).`);
  }
  if (format === "9:16" && st.bande.bas > BAS_ABSOLU_SOUS_TITRES + 1e-9) defauts.push(`Les sous-titres sont dans les 20 % du bas de l'écran.`);
  if (format === "4:5" && st.bande.bas > BAS_ABSOLU_SOUS_TITRES_4X5 + 1e-9) defauts.push(`Les sous-titres sont dans les 10 % du bas de l'écran (barre de lecture).`);
  const masques = reseaux.filter((r) => st.bande.bas > limites[r] + 1e-9);
  if (masques.length) {
    const permis = Math.min(...masques.map((r) => limites[r]));
    defauts.push(`Les sous-titres descendent à ${pct(st.bande.bas)} de la hauteur, dans la zone masquée de ${masques.join(", ")} (bas permis : ${pct(permis)}).`);
  }
  if (st.bande.haut < utileBas - 1e-9) defauts.push(`Les sous-titres montent sur le contenu (${pct(st.bande.haut)}, contenu jusqu'à ${pct(utileBas)}).`);
  if (st.taille < TAILLE_PLANCHER_DUO - 1e-9) defauts.push(`Les sous-titres sont écrits trop petit (sous le plancher de la charte).`);
  return defauts;
}
