/**
 * Q21 · MISE EN PAGE AUX INSTANTS CLÉS, mesurée depuis le moteur. PUR et déterministe.
 *
 * À chaque instant clé, le bloc de la ligne de temps RENDUE à cet instant est relu avec les MÊMES plans que les
 * composants dessinent (`@/briques/schema-motion/emprise` et `plan-objets`, partagés avec `studio-rendu`) : son
 * emprise passe à `controlerMiseEnPage` (remplissage de la zone utile, marges, plancher, icônes jamais en double).
 *  - moments (L9a) : le moment en cours ;
 *  - objets (L8) : l'objet le plus visible à l'instant (fondu enchaîné compris) ;
 *  - toile : la scène « Ensemble » si elle est pleinement à l'écran ; sinon la toile filmée par la caméra, dont le
 *    cadrage (aucun bloc lisible coupé) est contrôlé par L11 (Q15 et Q23) ;
 *  - écran v4 : mise en page de la brique du cas concret, refusée AVANT le rendu si elle ne tient pas (`IV_RENDU`).
 * Les en-têtes (titre de la scène) passent par `controlerEntetes`.
 */
import { empriseEnsemble, empriseMoment, empriseObjet } from "@/briques/schema-motion/emprise";
import { controlerMiseEnPage, zoneUtile, type EmpriseIV } from "@/briques/schema-motion/mise-en-page";
import { controlerEntetes, debordementsEnsemble, objetsA, planEnsemble } from "@/briques/schema-motion/plan-objets";
import { TEMPS_IV } from "@/briques/schema-motion/temps";
import type { BlocRenduIV, LigneDeTempsIV } from "./mise-en-scene";

const EPS_BLOC = 1e-6;

/** Le bloc rendu à l'instant `t` (secondes de la version) : celui qui le contient, sinon le dernier commencé. */
export function blocA(ligne: Pick<LigneDeTempsIV, "blocs">, t: number): BlocRenduIV | null {
  const dedans = ligne.blocs.find((b) => t >= b.debut - EPS_BLOC && t < b.fin - EPS_BLOC);
  if (dedans) return dedans;
  const commences = ligne.blocs.filter((b) => b.debut <= t + EPS_BLOC);
  return commences.length ? commences[commences.length - 1] : null;
}

/** Emprise du bloc à l'instant local `t` (depuis le début du bloc), ou `null` si la mise en page relève d'un autre contrôle. */
export function empriseDuBloc(b: BlocRenduIV, t: number): EmpriseIV | null {
  switch (b.sorte) {
    case "moments": {
      const m = b.moments.find((x) => t >= x.debut && t < x.fin) ?? b.moments[b.moments.length - 1];
      return m ? empriseMoment(m, t) : null;
    }
    case "objets": {
      const visibles = objetsA({ objets: b.objets }, t);
      if (!visibles.length) return { zone: zoneUtile(), blocs: [], textes: [], icones: [] };
      const o = visibles.reduce((a, x) => (x.opacite > a.opacite ? x : a));
      return empriseObjet(o.objet, t);
    }
    case "toile": {
      const p = b.proprietes;
      const e = (p.ensembles ?? []).find((x) => t >= x.debut && t < x.fin - TEMPS_IV.fondu);
      return e ? empriseEnsemble(planEnsemble(p.schema, { allumes: e.allumes, chiffresCles: e.chiffresCles })) : null;
    }
    case "ecran":
    case "variete":
      return null;
  }
}

/** Défauts des en-têtes du bloc (titre trop long pour tenir au plancher). */
function defautsEntetes(b: BlocRenduIV, ligne: Pick<LigneDeTempsIV, "largeur" | "hauteur">): string[] {
  const cadre = { largeur: ligne.largeur, hauteur: ligne.hauteur };
  if (b.sorte === "toile") return controlerEntetes({ entetes: b.proprietes.entetes, ...cadre });
  if (b.sorte === "objets") return controlerEntetes({ entetes: b.entetes, ...cadre });
  if (b.sorte === "moments") return controlerEntetes({ entetes: b.moments.flatMap((m) => (m.entete ? [{ ...m.entete, debut: m.debut, fin: m.fin }] : [])), ...cadre });
  return [];
}

/** Libellés qui dépasseraient leur bloc dans la vue d'ensemble à l'instant local `t` (la mise en page seule ne voit que les rectangles). */
function debordementsDeLaToile(b: BlocRenduIV, t: number): string[] {
  if (b.sorte !== "toile") return [];
  const e = (b.proprietes.ensembles ?? []).find((x) => t >= x.debut && t < x.fin - TEMPS_IV.fondu);
  return e ? debordementsEnsemble(planEnsemble(b.proprietes.schema, { allumes: e.allumes, chiffresCles: e.chiffresCles })) : [];
}

/** Mise en page de la version à chacun des instants clés : une entrée par instant (vide = conforme). */
export function miseEnPageAuxInstantsIV(ligne: Pick<LigneDeTempsIV, "blocs" | "largeur" | "hauteur">, instants: readonly number[]): { instantSec: number; defauts: string[] }[] {
  return instants.map((instantSec) => {
    const b = blocA(ligne, instantSec);
    if (!b) return { instantSec, defauts: ["aucune scène à l'écran."] };
    const emprise = empriseDuBloc(b, instantSec - b.debut);
    return { instantSec, defauts: [...defautsEntetes(b, ligne), ...(emprise ? controlerMiseEnPage(emprise) : []), ...debordementsDeLaToile(b, instantSec - b.debut)] };
  });
}
