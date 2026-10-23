/**
 * Plan de l'objet `liste-taches` (R2) : une fiche blanche à cases vides, dont les rangs entrent un à un sur leur mot
 * (vidéo de référence, plan `s4`), puis s'assombrissent et tremblent à l'annonce du total. Repère local : l'origine
 * est le coin haut-gauche de la boîte de l'objet. PUR : ni `remotion` ni React.
 */
import { largeurTexte, type BoitePx } from "../../../../src/briques/ecrans-motion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { doux, famille, instant, progres, teinte, type ProprietesObjet } from "./commun";

/** Propriétés de la liste : l'objet commun, plus les heures (s depuis le début de l'écran) de chaque rang et du total. */
export type ProprietesListeTaches = ProprietesObjet & {
  /** Heure d'entrée de chaque rang ; par défaut un rang toutes les 0,3 s à partir de 0,5 s. */
  debuts?: number[];
  /** Heure de l'annonce du total : les rangs s'assombrissent, la fiche tremble. `null`/absent : pas d'annonce. */
  annonce?: number | null;
};

/** Mesures de la référence (fiche de 860 px) : marge, retrait du texte, case, rang. */
const MARGE = 30 / 860;
const RETRAIT_TEXTE = 126 / 860;
const CASE_REL = 44 / 112;
const TEXTE_REL = 50 / 112;
/** Rang assombri à l'annonce du total (opacité finale). */
const OPACITE_ANNONCEE = 0.4;

export const debutRangParDefaut = (i: number) => 0.5 + 0.3 * i;

export function planListeTaches(p: ProprietesListeTaches, image: number, fps = 25) {
  const t = instant(image, fps);
  const textes = p.textes ?? [];
  const n = Math.max(1, textes.length);
  const { largeur: w, hauteur: h } = p.boite;
  const marge = w * MARGE;
  const rang = (h - 2 * marge) / n;
  const x0 = w * RETRAIT_TEXTE;
  const disponible = w - x0 - marge;
  const depuisAnnonce = p.annonce == null ? -1 : t - p.annonce;
  const tremblement = depuisAnnonce > 0.1 && depuisAnnonce < 0.45 ? Math.sin(depuisAnnonce * 90) * 8 * (w / 860) * (1 - progres(depuisAnnonce, 0.1, 0.35)) : 0;
  const rangs = textes.map((texte, i) => {
    const x = progres(t, (p.debuts?.[i] ?? debutRangParDefaut(i)) - 0.05, 0.28);
    const taille = Math.min(rang * TEXTE_REL, (rang * TEXTE_REL * disponible) / Math.max(1, largeurTexte(texte, "inter-gras", rang * TEXTE_REL)));
    const cote = rang * CASE_REL;
    const y = marge + i * rang;
    return {
      texte,
      taille,
      famille: famille("inter-gras"),
      couleur: COULEURS_DUO.encre,
      boite: { x: x0, y, largeur: disponible, hauteur: rang } as BoitePx,
      caseBoite: { x: marge + (22 / 860) * w, y: y + (rang - cote) / 2, largeur: cote, hauteur: cote } as BoitePx,
      caseRayon: cote * (12 / 44),
      caseTrait: Math.max(1, cote * (4 / 44)),
      caseCouleur: COULEURS_DUO.grisClair,
      separateur: i < n - 1 ? { y: y + rang - 1, epaisseur: Math.max(1, (2 * w) / 860), couleur: teinte(COULEURS_DUO.grisClair, 0.4) } : null,
      opacite: x * (depuisAnnonce > 0 ? 1 - (1 - OPACITE_ANNONCEE) * progres(depuisAnnonce, 0, 0.3) : 1),
      decalageX: (1 - doux(x)) * -50 * (w / 860),
      tient: largeurTexte(texte, "inter-gras", taille) <= disponible + 0.01,
    };
  });
  return {
    t,
    fiche: { boite: { x: 0, y: 0, largeur: w, hauteur: h } as BoitePx, rayon: (40 / 860) * w, couleur: COULEURS_DUO.blanc },
    decalageX: tremblement,
    rangs,
  };
}
