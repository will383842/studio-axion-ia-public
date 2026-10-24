/** Statuts d'un visuel (carrousel) et transitions permises. Module pur : aucune dépendance. */
export const STATUTS_VISUEL = ["brouillon", "ecrit", "bloque", "rendu_en_cours", "echec_rendu", "a_valider", "valide", "refuse", "programme", "publie"] as const;
export type StatutVisuel = (typeof STATUTS_VISUEL)[number];

export const TRANSITIONS: Record<StatutVisuel, readonly StatutVisuel[]> = {
  brouillon: ["ecrit", "bloque"],
  ecrit: ["rendu_en_cours"],
  bloque: ["brouillon"],
  rendu_en_cours: ["a_valider", "echec_rendu"],
  echec_rendu: ["rendu_en_cours", "brouillon"],
  a_valider: ["valide", "refuse"],
  refuse: ["brouillon"],
  valide: [],
  programme: [],
  publie: [],
};

export function transitionPermise(de: StatutVisuel, vers: StatutVisuel): boolean {
  return TRANSITIONS[de].includes(vers);
}

/** Corbeille interdite pour programme/publie ; permise sinon. */
export function corbeillePermise(s: StatutVisuel): boolean {
  return s !== "programme" && s !== "publie";
}

export const LIBELLES_STATUT: Record<StatutVisuel, string> = {
  brouillon: "Brouillon",
  ecrit: "Texte écrit",
  bloque: "Bloqué par la porte",
  rendu_en_cours: "Rendu en cours",
  echec_rendu: "Le rendu a échoué",
  a_valider: "À valider",
  valide: "Validé",
  refuse: "Refusé",
  programme: "Programmé",
  publie: "Publié",
};
