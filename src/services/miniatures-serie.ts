/**
 * COUVERTURE DE SÉRIE (TB-16, plan § 7) — demande de rendu d'une image fixe « la douleur en gros » : 8 mots au plus
 * (refus au-delà), mot-clé en noir souligné d'orange, nom de la série en petit, JAMAIS de numéro d'épisode ; 9:16 ou 1:1.
 * Opération `image-fixe` (gratuite, file courte), composition `TableauCouvertureSerie` de `studio-rendu`. Ce fichier ne
 * lit rien de `studio-rendu` (l'image du studio ne l'embarque pas) : les règles sont recopiées, un test vérifie qu'elles
 * restent celles du gabarit. `Miniature.tsx` (miniature des vidéos, `services/miniatures.ts`) n'est pas concerné.
 * Aucun appel réel ici : le service de rendu est injecté.
 */
import "server-only";
import { executerRendu } from "@/fournisseurs/rendu/attente";
import type { DemandeRendu, ServiceRendu } from "@/fournisseurs/types";

export const COMPOSITION_COUVERTURE_SERIE = "TableauCouvertureSerie";
export const VERSION_COUVERTURE_SERIE = "couverture-serie/1";
export const RATIOS_COUVERTURE_SERIE = ["9:16", "1:1"] as const;
export type RatioCouvertureSerie = (typeof RATIOS_COUVERTURE_SERIE)[number];
export const MOTS_DOULEUR_MAX = 8;

export interface EntreeCouvertureSerie {
  /** La douleur, en gros (8 mots au plus). */
  douleur: string;
  /** Nom de la série, en petit (jamais de numéro d'épisode). */
  serie: string;
  ratio?: RatioCouvertureSerie;
  /** Mot de la douleur à mettre en valeur ; absent : le plus long mot. */
  motCle?: string;
}

const NUMERO_EPISODE = /(?:(?<![\p{L}\p{N}])(?:ép|ep|épisode|episode|saison|partie|part|volet|n°|no|numéro)(?![\p{L}\p{N}])\.?\s*\d+|#\s*\d+|(?<![\p{L}\p{N}])\d+\s*\/\s*\d+(?![\p{L}\p{N}]))/iu;
const MOT_EPISODE = /(?<![\p{L}\p{N}])(?:épisode|episode)(?![\p{L}\p{N}])/iu;

const compterMots = (t: string) => t.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
const cleMot = (m: string) =>
  m
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Le mot mis en valeur : celui demandé s'il est dans la douleur, sinon le plus long mot. */
export function motCleCouvertureSerie(douleur: string, demande?: string): string {
  const mots = douleur.split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
  const propre = (m: string) => m.replace(/[^\p{L}\p{N}'’-]/gu, "");
  if (demande?.trim()) {
    const trouve = mots.find((m) => cleMot(m) === cleMot(demande));
    if (!trouve) throw new Error(`Couverture de série · le mot-clé « ${demande} » n'est pas un mot de la douleur.`);
    return propre(trouve);
  }
  return propre([...mots].sort((a, b) => cleMot(b).length - cleMot(a).length)[0] ?? "");
}

/** Contrôle l'entrée : liste de problèmes en français (vide = valide). */
export function controlerCouvertureSerie(e: EntreeCouvertureSerie): string[] {
  const pb: string[] = [];
  const n = compterMots(e.douleur);
  if (n === 0) pb.push("Couverture de série · la douleur est vide.");
  if (n > MOTS_DOULEUR_MAX) pb.push(`Couverture de série · la douleur compte ${n} mots (${MOTS_DOULEUR_MAX} au plus) : raccourcissez-la.`);
  if (!e.serie.trim()) pb.push("Couverture de série · le nom de la série est vide.");
  if (e.ratio !== undefined && !(RATIOS_COUVERTURE_SERIE as readonly string[]).includes(e.ratio)) pb.push(`Couverture de série · format « ${e.ratio} » non géré (9:16 ou 1:1).`);
  for (const [champ, texte] of [["la douleur", e.douleur], ["le nom de la série", e.serie]] as const) {
    if (NUMERO_EPISODE.test(texte) || MOT_EPISODE.test(texte)) pb.push(`Couverture de série · ${champ} ne doit jamais porter de numéro d'épisode (« ${texte} »).`);
  }
  return pb;
}

/** Propriétés de la composition (sérialisables). Lève une erreur claire si l'entrée est refusée. */
export function proprietesCouvertureSerie(e: EntreeCouvertureSerie): Record<string, unknown> {
  const pb = controlerCouvertureSerie(e);
  if (pb.length) throw new Error(pb.join(" "));
  return { version: VERSION_COUVERTURE_SERIE, ratio: e.ratio ?? "9:16", douleur: e.douleur.replace(/\s+/g, " ").trim(), motCle: motCleCouvertureSerie(e.douleur, e.motCle), serie: e.serie.replace(/\s+/g, " ").trim() };
}

/** Demande `image-fixe` : une image, déposée à l'adresse de `sortie`. */
export function demandeCouvertureSerie(e: EntreeCouvertureSerie, idRendu: string, sortie: DemandeRendu["sortie"]): DemandeRendu {
  return { idRendu, operation: "image-fixe", file: "courte", entrees: {}, sortie, parametres: { composition: COMPOSITION_COUVERTURE_SERIE, image: 0, proprietes: proprietesCouvertureSerie(e) } };
}

/** Rend la couverture par le service de rendu injecté (attente bornée, aucun nouvel essai). Rend la clé du PNG. */
export async function rendreCouvertureSerie(service: ServiceRendu, e: EntreeCouvertureSerie, idRendu: string, sortie: DemandeRendu["sortie"], delaiMs = 60_000): Promise<string> {
  const fait = await executerRendu(service, demandeCouvertureSerie(e, idRendu, sortie), { delaiMs, essais: 0 });
  return fait.sortieCle;
}
