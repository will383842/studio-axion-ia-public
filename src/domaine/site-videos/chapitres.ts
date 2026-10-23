// Vidéos sur le site, lot S1 — chapitres web (PUR). Même méthode pour tous les générateurs.
import { compterMots, texteScript } from "@/domaine/derivations";
import type { BlocScript, MotHorodate } from "@/domaine/types";
import type { RecetteScript } from "@/formats/types";
import type { ChapitreWeb, RegleChapitresWeb } from "./types";

/** Sous cette durée, une vidéo n'a pas de chapitres (correction A4 n° 4). */
export const DUREE_MIN_CHAPITRES_SEC = 30;
/** Deux chapitres plus proches que cela n'en font qu'un. */
const ECART_MIN_SEC = 1;

const dixieme = (n: number) => Math.round(n * 10) / 10;

export interface EntreeChapitres {
  blocs: BlocScript[];
  recette: Pick<RecetteScript, "blocs">;
  regle: RegleChapitresWeb;
  /** Mots horodatés de tous les segments de sous-titres, à la suite (vide : prorata). */
  mots: MotHorodate[];
  dureeSec: number;
}

/**
 * Début de chaque bloc = début du mot de rang cumulé dans les sous-titres ; si les sous-titres manquent ou sont plus
 * courts que le texte, répartition au prorata des mots sur la durée. Les blocs « rattachés » rejoignent le chapitre
 * précédent ; moins de 2 chapitres, ou moins de 30 s : aucun chapitre.
 */
export function chapitresWeb({ blocs, recette, regle, mots, dureeSec }: EntreeChapitres): ChapitreWeb[] {
  if (dureeSec < DUREE_MIN_CHAPITRES_SEC) return [];
  const comptes = blocs.map((b) => compterMots(texteScript([b])));
  const totalMots = comptes.reduce((a, b) => a + b, 0);
  if (totalMots === 0) return [];
  const motsSuffisants = mots.length >= totalMots;
  let rang = 0;
  const debuts = comptes.map((n) => {
    const debut = motsSuffisants ? mots[rang].debutSec : (rang / totalMots) * dureeSec;
    rang += n;
    return debut;
  });

  const rattaches = new Set(regle.rattaches ?? []);
  const retenus: { bloc: BlocScript; debut: number }[] = [];
  blocs.forEach((bloc, i) => {
    if (comptes[i] === 0) return;
    if (rattaches.has(bloc.blocRecette) && retenus.length) return;
    retenus.push({ bloc, debut: dixieme(debuts[i]) });
  });
  if (retenus.length) retenus[0].debut = 0;

  // Deux débuts à moins de 1 s : le second est fusionné dans le premier.
  const separes: typeof retenus = [];
  for (const r of retenus) {
    const precedent = separes[separes.length - 1];
    if (precedent && r.debut - precedent.debut < ECART_MIN_SEC) continue;
    separes.push(r);
  }
  if (separes.length < 2) return [];

  const repetables = new Set(recette.blocs.filter((b) => b.repetable).map((b) => b.id));
  const nomsRecette = new Map(recette.blocs.map((b) => [b.id, b.nom]));
  const numeros = new Map<string, number>();
  return separes.map((r, i) => {
    const id = r.bloc.blocRecette;
    const base = regle.libelles?.[id] ?? nomsRecette.get(id) ?? id;
    let libelle = base;
    if (repetables.has(id)) {
      const n = (numeros.get(id) ?? 0) + 1;
      numeros.set(id, n);
      libelle = `${base} ${n}`;
    }
    return { debutSec: r.debut, finSec: i + 1 < separes.length ? separes[i + 1].debut : dixieme(dureeSec), libelle, blocRecette: id };
  });
}
