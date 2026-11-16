/**
 * JAQUETTES PAR RÉSEAU (UO-11). PUR : aucune lecture de base, aucun appel.
 * Une vidéo cochée pour N réseaux a exactement N jaquettes, une par réseau.
 * Règle : la jaquette d'un réseau est tirée d'un ratio de sortie EXISTANT de la vidéo (aucun recadrage inventé).
 *   - le ratio visé est celui de la miniature du réseau (registre) ; Instagram (« 3:4 », hors des formats connus) se
 *     rabat sur son ratio d'emplacement (4:5) ;
 *   - sans sortie à ce ratio, un autre ratio de sortie de la vidéo est pris s'il est accepté par le réseau ;
 *   - sinon la jaquette est impossible : elle est comptée manquante, avec une phrase qui nomme le réseau.
 * Les tailles viennent de `dimensionsMiniature`, les ratios du registre des réseaux : rien n'est écrit en dur ici.
 */
import { obtenirReseau } from "@/reseaux";
import { dimensionsMiniature } from "./miniatures";
import { RATIOS, type IdReseau, type Miniature, type Ratio } from "./types";

export interface JaquetteAttendue {
  reseau: IdReseau;
  /** Ratio de sortie dont la jaquette est tirée ; null : aucune sortie de la vidéo n'est acceptée par ce réseau. */
  ratio: Ratio | null;
  dimensions: { largeur: number; hauteur: number } | null;
}

export interface VerdictJaquettes {
  pretes: boolean;
  /** Phrase française (vouvoiement) qui nomme chaque réseau dont la jaquette manque ; vide quand tout est prêt. */
  phrase: string;
  manquantes: IdReseau[];
}

const estRatio = (r: string): r is Ratio => (RATIOS as string[]).includes(r);

/** Ratio visé pour la jaquette d'un réseau : celui de sa miniature, sinon son ratio d'emplacement déjà existant. */
export function ratioCibleJaquette(reseau: IdReseau): Ratio {
  const def = obtenirReseau(reseau);
  if (estRatio(def.miniature.ratio)) return def.miniature.ratio;
  const emplacement = def.emplacements?.find((e) => def.ratios.includes(e.ratio) && e.ratio !== def.ratioPrefere) ?? def.emplacements?.[0];
  return emplacement?.ratio ?? def.ratioPrefere;
}

/** Ratio de sortie à utiliser : la cible si la vidéo l'a, sinon un ratio de sortie accepté par le réseau, sinon rien. */
export function choisirRatioJaquette(reseau: IdReseau, ratiosSorties: readonly Ratio[]): Ratio | null {
  const cible = ratioCibleJaquette(reseau);
  if (ratiosSorties.includes(cible)) return cible;
  const acceptes = obtenirReseau(reseau).ratios;
  return ratiosSorties.find((r) => acceptes.includes(r)) ?? null;
}

/** Une jaquette attendue par réseau coché (doublons ignorés, ordre gardé). */
export function jaquettesAttendues(reseaux: readonly IdReseau[], ratiosSorties: readonly Ratio[]): JaquetteAttendue[] {
  return [...new Set(reseaux)].map((reseau) => {
    const ratio = choisirRatioJaquette(reseau, ratiosSorties);
    return { reseau, ratio, dimensions: ratio ? dimensionsMiniature(ratio) : null };
  });
}

/** Verdict : prêtes seulement si chaque réseau a sa jaquette, au ratio attendu. */
export function jaquettesPretesDomaine(reseaux: readonly IdReseau[], ratiosSorties: readonly Ratio[], miniatures: readonly Pick<Miniature, "reseau" | "ratio">[]): VerdictJaquettes {
  const manquantes: IdReseau[] = [];
  const phrases: string[] = [];
  for (const a of jaquettesAttendues(reseaux, ratiosSorties)) {
    const nom = obtenirReseau(a.reseau).nom;
    if (!a.ratio) {
      manquantes.push(a.reseau);
      phrases.push(`La jaquette ${nom} ne peut pas être faite : la vidéo n'existe dans aucun format accepté par ${nom}.`);
    } else if (!miniatures.some((m) => m.reseau === a.reseau && m.ratio === a.ratio)) {
      manquantes.push(a.reseau);
      phrases.push(`La jaquette ${nom} n'est pas encore prête.`);
    }
  }
  return { pretes: manquantes.length === 0, phrase: phrases.join(" "), manquantes };
}
