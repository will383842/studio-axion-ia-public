/** Noms français des champs d'un texte de session : sert aux phrases d'erreur et à l'aide au format. PUR. */

/** Champ simple d'une page (singulier). */
export const LIBELLES_CHAMPS: Record<string, string> = {
  titre: "titre",
  sousTitre: "sous-titre",
  corps: "texte",
  texte: "texte",
  message: "message",
  legende: "légende",
  avant: "avant",
  apres: "après",
  mythe: "mythe",
  realite: "réalité",
  question: "question",
  aide: "aide",
  annotation: "annotation",
  sans: "sans",
  avec: "avec",
  vous: "bandeau « vous »",
  deco: "décor",
  mini: "mini-visuel",
  icone: "icône",
  relance: "relance",
};

/** Liste d'éléments d'une page : [singulier, pluriel]. */
export const LIBELLES_LISTES: Record<string, [string, string]> = {
  cartes: ["carte", "cartes"],
  points: ["point", "points"],
  etapes: ["étape", "étapes"],
  questions: ["question", "questions"],
  lignes: ["ligne", "lignes"],
  noeuds: ["nœud", "nœuds"],
  outils: ["outil", "outils"],
  rappels: ["rappel", "rappels"],
  avant: ["ligne « avant »", "lignes « avant »"],
  avec: ["ligne « avec nous »", "lignes « avec nous »"],
};

export const accorder = (n: number, [singulier, pluriel]: [string, string]) => (n > 1 ? pluriel : singulier);

/** Partie d'une phrase d'erreur pour un chemin dans une page : ["points", 0, "texte"] → « point 1 » ; ["cartes", 1, "titre"] → « carte 2, titre ». */
export function libelleDansPage(chemin: readonly (string | number)[]): string {
  const parties: string[] = [];
  for (let i = 0; i < chemin.length; i++) {
    const cle = String(chemin[i]);
    const suite = chemin[i + 1];
    if (typeof suite === "number" && LIBELLES_LISTES[cle]) {
      parties.push(`${LIBELLES_LISTES[cle]![0]} ${suite + 1}`);
      i++;
      // « texte » d'un point : le point lui-même ; un autre sous-champ (titre d'une carte) se dit à part.
      if (chemin[i + 1] === "texte") i++;
    } else if (cle === "type") {
      parties.push("type de page");
    } else if (LIBELLES_LISTES[cle] && !(cle in LIBELLES_CHAMPS)) {
      parties.push(LIBELLES_LISTES[cle]![1]);
    } else {
      parties.push(LIBELLES_CHAMPS[cle] ?? cle);
    }
  }
  return parties.join(", ");
}
