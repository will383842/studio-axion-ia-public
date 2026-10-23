/**
 * SÉQUENCE DE LA DÉMO 15 s « v2 énergie » (`DemoV2`) — DONNÉES SEULES, sans React ni Remotion : la même liste sert à la composition
 * et au test `tests/facecam-animee/demo-v2.test.ts`, qui la fait passer par les règles D0 à D13 du réalisateur (`regles-v2.ts`).
 *
 * 8 éléments ACTIFS du catalogue, 4 lots différents (1 papier, 2 géométrie, 3 typographie, 5 organique), trouvés par une recherche
 * exhaustive sur les règles du standard § E (aucun même emplacement / forme / mouvement / sortie / sens d'inclinaison deux fois de
 * suite, emplacements qui tournent, un grand élément avant 10 s, un coup de poing — tampon-déchirure — à 10,7 s, Will seul
 * 1 s après, puis un élément moyen). Le lot 4 (impact) n'y est pas : aucune suite des 17 éléments actifs ne tient les règles avec
 * les 5 lots à la fois sur 15 s.
 *
 * La transcription est FICTIVE (la démo n'a pas de voix) : elle donne les mots que les éléments affichent, aux instants où ils
 * entrent. Aucun chiffre affiché qui ne soit « dit » (« trois »), jamais « Villeexemple ».
 */
export const FPS_DEMO = 30;
export const DUREE_DEMO_SEC = 15;
export const LARGEUR_DEMO = 540;
export const HAUTEUR_DEMO = 960;
/** Taille de travail des éléments (ils sont dessinés pour 1080 × 1920) ; la composition la réduit de moitié. */
export const LARGEUR_TRAVAIL = 1080;
export const HAUTEUR_TRAVAIL = 1920;

export interface ElementDemo {
  id: string;
  debut: number;
  fin: number;
  /** Textes affichés (mots DITS). */
  mots?: string[];
}

export const SEQUENCE_DEMO: readonly ElementDemo[] = Object.freeze([
  { id: "pastille-chiffre", debut: 1.2, fin: 2.5, mots: ["3"] },
  { id: "bulle-cri", debut: 2.6, fin: 3.5, mots: ["PAS LE TEMPS !"] },
  { id: "mot-vertical-bord", debut: 3.6, fin: 5.2, mots: ["DEVIS"] },
  { id: "losange-crans", debut: 5.3, fin: 7.4 },
  { id: "demi-lune-bas", debut: 7.5, fin: 9.0, mots: ["ET VOILÀ"] },
  { id: "pile-de-lettres", debut: 9.1, fin: 10.6, mots: ["AGENDA"] },
  { id: "tampon-dechirure", debut: 10.7, fin: 11.75, mots: ["RÉGLÉ"] },
  { id: "badge-roulant", debut: 12.8, fin: 14.0, mots: ["À DISTANCE", "PARTOUT"] },
]);

/** Étapes dites du losange (une icône par étape, aucun numéro affiché). */
export const ETAPES_LOSANGE_DEMO = Object.freeze([
  { icone: "loupe", a: 5.3 },
  { icone: "eclair", a: 6.1 },
  { icone: "graphique", a: 6.8 },
]);

/** Ce que « dit » la démo (mots horodatés, secondes). */
export const TRANSCRIPTION_DEMO: readonly { w: string; a: number; f: number }[] = Object.freeze(
  (
    [
      ["Chaque", 0.2], ["semaine", 0.5], ["trois", 1.2], ["heures", 1.55], ["perdues", 1.9],
      ["Pas", 2.6], ["le", 2.85], ["temps", 3.05],
      ["Vos", 3.35], ["devis", 3.6], ["attendent", 3.95],
      ["D'abord", 5.3], ["je", 5.6], ["trie", 5.75], ["ensuite", 6.1], ["je", 6.4], ["relance", 6.55], ["enfin", 6.8], ["je", 7.05], ["facture", 7.2],
      ["Et", 7.5], ["voilà", 7.75],
      ["Tout", 8.2], ["passe", 8.45], ["dans", 8.75], ["l'agenda", 9.1],
      ["en", 9.6], ["un", 9.8], ["clic", 10.05],
      ["Réglé", 10.7],
      ["On", 11.3], ["vient", 11.5], ["chez", 11.75], ["vous", 12.0],
      ["Partout", 12.8], ["en", 13.3], ["France", 13.45], ["ou", 13.9], ["à", 14.1], ["distance", 14.2],
    ] as const
  ).map(([w, a]) => ({ w, a, f: a + 0.3 })),
);
