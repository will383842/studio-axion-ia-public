/**
 * Les objets d'un écran s'arrêtent AU-DESSUS de la bande des sous-titres (14/10, essai réel n° 1 : le téléphone, les
 * e-mails et le contrat descendaient jusqu'à 86 % de la hauteur, là où passent les sous-titres, qui devenaient
 * illisibles sur le papier blanc). La brique commune laisse les objets déborder sous la zone utile (`ZONE_DESSIN`,
 * comme la vidéo de référence du tableau animé) ; ce format ne le permet pas. Fonction PURE, propre au cas concret :
 * la brique commune et les autres formats ne changent pas.
 *
 * V4-2 (mission D) : le format rend ses écrans dans la zone « pleine image » (`ZONE_PLEINE_IMAGE_CAS_CONCRET`), à
 * l'échelle de la v4 ; le fil des étapes passe sous les sous-titres, à 92 % (`BAS_FIL_CAS_CONCRET`), comme la v4.
 */
import type { ZoneSure } from "@/briques/controle-image";
import { proprietesEcrans, zonesEcran, type EntreeEcrans, type ProprietesEcran } from "@/briques/ecrans-motion";
import { BANDE_SOUS_TITRES_CAS_CONCRET, BAS_FIL_CAS_CONCRET, ZONE_PLEINE_IMAGE_CAS_CONCRET } from "@/formats/cas-concret";

/** Ramène le bas de la zone de dessin de chaque écran au bas de sa zone utile (jamais plus haut que son haut). */
export function dessinAuDessusDesSousTitres(ecrans: readonly ProprietesEcran[]): ProprietesEcran[] {
  return ecrans.map((e) => {
    if (!e.dessin) return e;
    const basUtile = e.zone.y + e.zone.hauteur;
    const hauteur = Math.max(e.zone.hauteur, Math.min(e.dessin.hauteur, basUtile - e.dessin.y));
    return { ...e, dessin: { ...e.dessin, hauteur } };
  });
}

/**
 * Propriétés des écrans du format : zone pleine image, bande des sous-titres du format, objets au-dessus des
 * sous-titres, fil des étapes à 92 % de la hauteur (sous les sous-titres, comme la v4).
 */
export function proprietesPleineImage(entree: Pick<EntreeEcrans, "ecrans" | "captures">): ProprietesEcran[] {
  const brutes = proprietesEcrans({ ...entree, zoneProtegee: { ...ZONE_PLEINE_IMAGE_CAS_CONCRET }, bandeSousTitres: BANDE_SOUS_TITRES_CAS_CONCRET });
  return dessinAuDessusDesSousTitres(brutes).map((e) => ({ ...e, basFil: BAS_FIL_CAS_CONCRET * e.hauteur }));
}

/**
 * Centre des sous-titres en zone pleine image, en % de la hauteur : une ligne de 60 px (style du format) posée en haut
 * de la bande, à 48 px sous son bord (≈ 85 % ; v4 : `#st` à 1 600 px, 83 %). Les sous-titres ne touchent jamais un objet.
 */
export function centreSousTitresPleineImagePct(hauteur = 1920): number {
  const { sousTitres } = zonesEcran(ZONE_PLEINE_IMAGE_CAS_CONCRET, 1080, hauteur, BANDE_SOUS_TITRES_CAS_CONCRET);
  return +(((sousTitres.y + 0.025 * hauteur) / hauteur) * 100).toFixed(2);
}

/** La zone pleine image en fractions, pour les contrôles de mise en page (textes dedans, rien dans la bande). */
export function zonePleineImage(): ZoneSure {
  const z = ZONE_PLEINE_IMAGE_CAS_CONCRET;
  return { haut: z.haut / 100, droite: z.droite / 100, bas: z.bas / 100, gauche: z.gauche / 100 };
}
