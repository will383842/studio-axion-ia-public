/**
 * EMPRISE des composants « Image → vidéo » : SEULE SOURCE dans `src/briques/schema-motion/emprise.ts` (lue aussi par le
 * contrôle Q21 du moteur). Ici seulement l'emprise des galeries de micro-objets, propres à `studio-rendu`.
 */
import { beneficesGalerie, planBanqueMicro, planListeMicro, type ListeGalerieMicro } from "./donnees-galerie-micro";
import { PLANCHER_PX_IV, type EmpriseIV } from "./mise-en-page";

export * from "../../../src/briques/schema-motion/emprise";

/** Emprise de la galerie des micro-objets (liste A / B, ou banque) : rangées (en creux avant leur tour) ou grille. */
export function empriseMicro(liste: ListeGalerieMicro): EmpriseIV {
  if (liste === "banque") {
    const b = planBanqueMicro();
    return { zone: b.zone, blocs: b.cases.map((c, i) => ({ nom: `dessin ${i + 1}`, ...c })), textes: [], icones: [] };
  }
  const titres = beneficesGalerie(liste);
  const g = planListeMicro(titres.length);
  return { zone: g.zone, blocs: g.lignes.map((l, i) => ({ nom: titres[i].titre, ...l })), textes: titres.map((b) => ({ texte: b.titre, taille: Math.max(g.taille, PLANCHER_PX_IV) })), icones: [] };
}
