/** Mémoire anti-répétition ENTRE carrousels (L7) : fonctions PURES ; la lecture des fiches reste au service. */
import { illustrationCouverture } from "../../briques/visuels/choix-illustration";
import type { ControlePorte, EmpreinteCarrousel } from "../visuels/contrats";

/** Nombre de carrousels récents qu'un nouveau carrousel ne doit pas répéter. */
export const MEMOIRE_CARROUSELS = 5;

type SpecLue = { pages: readonly ({ type: string } & { titre?: string; sousTitre?: string })[] };

const COUVERTURES = ["T01", "T01B", "T01C"] as const;

export function empreinteCarrousel(spec: SpecLue): EmpreinteCarrousel {
  const [c] = spec.pages;
  const dessin = c && (COUVERTURES as readonly string[]).includes(c.type) ? illustrationCouverture(c.type as (typeof COUVERTURES)[number], c.titre ?? "", c.sousTitre) : "";
  return { suite: spec.pages.map((p) => p.type).join(" "), couverture: `${c?.type ?? ""}:${dessin}` };
}

/** Empreintes des `MEMOIRE_CARROUSELS` fiches les plus récentes qui ont un texte gardé (date de création ISO, la plus récente d'abord). */
export function recentsAEviter(fiches: readonly { creeLe: string; spec?: SpecLue }[], n = MEMOIRE_CARROUSELS): EmpreinteCarrousel[] {
  return fiches
    .filter((f): f is { creeLe: string; spec: SpecLue } => f.spec !== undefined)
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
    .slice(0, n)
    .map((f) => empreinteCarrousel(f.spec));
}

export const repete = (e: EmpreinteCarrousel, recents: readonly EmpreinteCarrousel[]): boolean => recents.some((r) => r.suite === e.suite || r.couverture === e.couverture);

/** Le premier candidat, à partir de `depart`, qui ne répète aucun récent ; sinon celui de `depart` (jamais de blocage). */
export function premierSansRepetition<T>(candidats: readonly T[], depart: number, empreinte: (c: T) => EmpreinteCarrousel, recents: readonly EmpreinteCarrousel[]): T {
  for (let k = 0; k < candidats.length; k++) {
    const c = candidats[(depart + k) % candidats.length];
    if (!repete(empreinte(c), recents)) return c;
  }
  return candidats[depart % candidats.length];
}

/** Alerte (orange) quand la suite des pages ou la couverture reprend celle d'un des derniers carrousels produits. */
export function controlesMemoire(spec: SpecLue, recents: readonly EmpreinteCarrousel[]): ControlePorte[] {
  const e = empreinteCarrousel(spec);
  const res: ControlePorte[] = [];
  if (recents.some((r) => r.suite === e.suite)) {
    res.push({ code: "REPETITION", niveau: "orange", phrase: `La suite des pages (${e.suite}) est la même qu'un des ${MEMOIRE_CARROUSELS} derniers carrousels ; changez l'ordre ou un type de page.` });
  }
  if (recents.some((r) => r.couverture === e.couverture)) {
    res.push({ code: "REPETITION", niveau: "orange", page: 1, phrase: `Page 1 : la couverture (même modèle, même dessin) est la même qu'un des ${MEMOIRE_CARROUSELS} derniers carrousels ; changez de modèle ou de sujet.` });
  }
  return res;
}
