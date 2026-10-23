/**
 * CONTRÔLE DU FICHIER D'UNE SORTIE : dimensions EXACTES du format et AUCUNE colonne ni rangée noire au bord.
 *
 * Défaut connu (essai réel du 11/10) : une bande noire de 8 px au bord droit (colonnes 1072 à 1079), venue de la
 * conversion `yuv420p → gbrp` du FFmpeg 8.1.1 à l'export. L'export du tableau la contourne
 * (`RECETTE_COMPOSITION_TABLEAU.exportBordsSurs`) et demande la mesure des bords du fichier exporté (`bordNoir*`,
 * `studio-rendu/src/controle-bords.ts`) : ce contrôle la lit, pour qu'une rechute se voie sur chaque vidéo.
 *
 * 14/10 (`finPropre`) : la fin du fichier est contrôlée aussi (son éteint à la dernière 0,1 s, dernières images
 * identiques, `controleFinPropre`) : une fin qui s'arrête net est un défaut dit en français, jamais un blocage.
 *
 * PUR : ne lit que les mesures rendues par `studio-rendu`. Une mesure absente est dite « non mesurée », jamais réussie.
 */
import { controleFinDesMesures } from "@/briques/composition/fin-propre";
import { formatSortie, type IdFormatSortie } from "./formats-sortie";

export type EtatControleSortie = "conforme" | "non-conforme" | "non-mesure";

export interface ControleSortie {
  format: IdFormatSortie;
  etat: EtatControleSortie;
  /** Une phrase par problème ou par mesure manquante, en français. */
  phrases: string[];
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** Contrôle d'une sortie d'après les mesures du fichier exporté (`largeur`, `hauteur`, `bordNoir*`). */
export function controlerSortie(id: IdFormatSortie, mesures: Readonly<Record<string, number | undefined>>, options: { finPropre?: boolean } = {}): ControleSortie {
  const f = formatSortie(id);
  const problemes: string[] = [];
  const manquants: string[] = [];
  const { largeur, hauteur } = mesures;
  if (typeof largeur !== "number" || typeof hauteur !== "number" || !largeur || !hauteur) manquants.push("Dimensions du fichier non mesurées.");
  else if (largeur !== f.largeur || hauteur !== f.hauteur) problemes.push(`Dimensions ${largeur} × ${hauteur} au lieu de ${f.largeur} × ${f.hauteur} (${f.libelle}).`);
  const bords = { gauche: mesures.bordNoirGauche, droite: mesures.bordNoirDroite, haut: mesures.bordNoirHaut, bas: mesures.bordNoirBas };
  if (mesures.bordNoirErreur) manquants.push("Bords noirs non mesurés : la mesure a échoué.");
  else if (Object.values(bords).some((v) => typeof v !== "number")) manquants.push("Bords noirs non mesurés.");
  else {
    const L = typeof largeur === "number" && largeur ? largeur : f.largeur;
    const H = typeof hauteur === "number" && hauteur ? hauteur : f.hauteur;
    const { gauche, droite, haut, bas } = bords as Record<keyof typeof bords, number>;
    if (droite > 0) problemes.push(`Bande noire de ${pluriel(droite, "colonne")} au bord droit (colonnes ${L - droite} à ${L - 1}).`);
    if (gauche > 0) problemes.push(`Bande noire de ${pluriel(gauche, "colonne")} au bord gauche (colonnes 0 à ${gauche - 1}).`);
    if (haut > 0) problemes.push(`Bande noire de ${pluriel(haut, "rangée")} en haut (rangées 0 à ${haut - 1}).`);
    if (bas > 0) problemes.push(`Bande noire de ${pluriel(bas, "rangée")} en bas (rangées ${H - bas} à ${H - 1}).`);
  }
  if (options.finPropre) {
    const fin = controleFinDesMesures(mesures);
    if (!fin.mesuree) manquants.push("Fin de la vidéo non mesurée.");
    for (const d of fin.defauts) problemes.push(`${d.charAt(0).toUpperCase()}${d.slice(1)}.`);
  }
  const etat: EtatControleSortie = problemes.length ? "non-conforme" : manquants.length ? "non-mesure" : "conforme";
  return { format: id, etat, phrases: [...problemes, ...manquants] };
}
