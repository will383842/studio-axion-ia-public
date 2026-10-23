/**
 * CONTRÔLES DE L'IMAGE PROPRES AU STYLE « reference/2 » (gabarit de page clair, 14/10/2026). PURS, sur la mise en page
 * (et la fiche, pour les numéros dits). S'ajoutent à ceux de la page écrite au crayon (`controles-reference.ts` : rien
 * ne dépasse, aucun chevauchement, texte écrit une fois, page non vide).
 *
 *  - titre présent : chaque page porte son titre (une page de suite, son titre rappelé) ;
 *  - numéros écrits : quand la voix compte une étape (« Un. », « Deux : »), sa page porte la pastille de ce numéro ;
 *  - tailles minimales : titre, phrase clé et détails jamais sous leur plus petite taille (70, 56, 44 px de référence) ;
 *  - couleurs du gabarit : texte en encre, terracotta ou vert sauge sur le fond ; en clair seulement sur un fond plein
 *    (pastille, étiquette, bandeau, cadre de l'appel) ;
 *  - blocs courts : un titre en 2 rangées au plus, tout autre bloc en 4 ;
 *  - page remplie : chaque page remplit au moins 75 % de la hauteur utile, à partir du haut.
 */
import { COULEURS_REFERENCE, TAILLES_GABARIT } from "@/briques/tableau-scene/reference/charte";
import type { FauteReference } from "./controles-reference";
import type { FicheTableau } from "./fiche";
import { numerosDits } from "./gabarit";
import type { ElementPlace, MiseEnPageTableau } from "./mise-en-page";

/** Part de la hauteur utile qu'une page du gabarit clair remplit au moins (consigne de Will : 75 %). */
export const REMPLISSAGE_MIN_GABARIT = 0.75;

const C = COULEURS_REFERENCE;
const nom = (e: ElementPlace) => `« ${e.lignes.map((l) => l.texte).join(" ")} »`;

/** Chaque page porte un titre. */
export function titresAbsentsGabarit(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) => (p.elements.some((e) => e.gabarit?.sorte === "titre") ? [] : [{ sceneId: p.elements[0]?.sceneId ?? "", message: `page ${p.page} : aucun titre` }]));
}

/** Quand la voix compte une étape, sa page porte la pastille de ce numéro. */
export function numerosAbsentsGabarit(fiche: FicheTableau, mise: MiseEnPageTableau): FauteReference[] {
  const res: FauteReference[] = [];
  for (const s of fiche.scenes) {
    const page = mise.pages.find((p) => p.page === s.page);
    for (const d of numerosDits(s.texteDit)) {
      const ok = page?.elements.some((e) => e.gabarit?.sorte === "pastille" && e.gabarit.n === d.n);
      if (!ok) res.push({ sceneId: s.id, message: `page ${s.page} : la voix dit « ${d.n} », aucune pastille ${d.n} n'est écrite` });
    }
  }
  return res;
}

/** Plus petite taille permise de chaque partie du gabarit (px à l'échelle de la sortie). */
function tailleMin(e: ElementPlace, k: number): number | null {
  const g = e.gabarit?.sorte;
  if (g === "titre") return TAILLES_GABARIT.titreMin * k;
  if (g === "phrase") return TAILLES_GABARIT.phraseMin * k;
  if (e.type === "dessin" || g === "repere") return null;
  return TAILLES_GABARIT.detailMin * k;
}

/** Titre, phrase clé, détails (et le reste) jamais sous leur plus petite taille. */
export function taillesTropPetitesGabarit(mise: MiseEnPageTableau): FauteReference[] {
  const k = mise.styleReference?.k ?? 1;
  return mise.pages.flatMap((p) =>
    p.elements.flatMap((e) => {
      const min = tailleMin(e, k);
      return min !== null && e.lignes.length && (e.taillePx ?? 0) + 0.5 < min ? [{ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} est écrit en ${e.taillePx} px (au moins ${Math.round(min)})` }] : [];
    }),
  );
}

/** Texte en encre, terracotta ou sauge sur le fond ; en clair seulement sur un fond plein du gabarit. */
export function couleursHorsGabarit(mise: MiseEnPageTableau): FauteReference[] {
  const sombres: readonly string[] = [C.encre, C.terracotta, C.sauge];
  return mise.pages.flatMap((p) =>
    p.elements.flatMap((e) => {
      if (e.type === "dessin" || !e.lignes.length) return [];
      const ok = e.couleurFond === C.fond ? sombres.includes(e.couleurTexte ?? "") : e.couleurTexte === C.fond && sombres.includes(e.couleurFond ?? "");
      return ok ? [] : [{ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} est écrit en ${e.couleurTexte} sur ${e.couleurFond}` }];
    }),
  );
}

/** Un titre en 2 rangées au plus, tout autre bloc en 4. */
export function blocsTropLongsGabarit(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) =>
    p.elements.flatMap((e) => {
      const max = e.gabarit?.sorte === "titre" ? 2 : 4;
      return e.lignes.length > max ? [{ sceneId: e.sceneId, message: `page ${p.page} : ${nom(e)} fait ${e.lignes.length} rangées (${max} au plus)` }] : [];
    }),
  );
}

/** Chaque page remplit au moins 75 % de sa hauteur utile. */
export function pagesTropVidesGabarit(mise: MiseEnPageTableau): FauteReference[] {
  return mise.pages.flatMap((p) =>
    p.occupation + 1e-6 >= REMPLISSAGE_MIN_GABARIT ? [] : [{ sceneId: p.elements.at(-1)?.sceneId ?? "", message: `page ${p.page} : la page n'est remplie qu'à ${Math.round(p.occupation * 100)} % (au moins ${Math.round(REMPLISSAGE_MIN_GABARIT * 100)} %)` }],
  );
}
