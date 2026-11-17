/**
 * Ouvertures des voisines du réseau, en mots (E2, fiche X2-14b-a) : liste à citer dans la consigne pour ne pas répéter
 * la même ouverture. Module PUR, côté Studio seulement : aucun appelant, aucune date, aucun hasard, aucun réseau.
 */
import type { EmpreinteVideo } from "@/briques/variete-commune/types";
import { NEUTRES } from "@/briques/variete-commune/vocabulaire";

/** Libellé lisible de chaque valeur commune de `VOCABULAIRE.ouverture`. */
export const LIBELLES_OUVERTURE: Readonly<Record<string, string>> = Object.freeze({
  "chiffre-geant": "un chiffre géant",
  question: "une question",
  "avant-apres": "un avant / après",
  "titre-geant": "un titre géant",
  "visage-direct": "le visage en direct",
  "objet-zoom": "un zoom sur un objet",
  affiche: "une affiche",
  "phrase-deux-temps": "une phrase en deux temps",
  horloge: "une horloge",
  "detail-puis-recul": "un détail puis un recul",
});

/** Ouvertures (en mots) des `max` voisines les plus récentes (ordre reçu), sans neutres, sans `autre:*`, sans doublon. */
export function ouverturesVoisines(voisines: readonly EmpreinteVideo[], max = 3): string[] {
  const mots = new Set<string>();
  for (const v of voisines.slice(0, Math.max(0, max))) {
    for (const valeur of v.axes.ouverture ?? []) {
      if (NEUTRES.includes(valeur) || valeur.startsWith("autre:")) continue;
      const mot = Object.hasOwn(LIBELLES_OUVERTURE, valeur) ? LIBELLES_OUVERTURE[valeur] : undefined;
      if (mot) mots.add(mot);
    }
  }
  return [...mots];
}
