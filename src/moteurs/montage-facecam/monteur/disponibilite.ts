/**
 * DISPONIBILITÉ DES OPÉRATIONS DU MONTEUR (rapport V6, P0 n° 6 « interdit de mentir »). PUR, importable partout.
 *
 * Chaque type du vocabulaire est soit RENDU dans la vidéo (la chaîne, l'habillage ou studio-rendu le lit : `par` dit
 * où), soit marqué « pas encore possible ». Une opération non disponible n'est JAMAIS enregistrée comme faite :
 * `appliquerOperations` la refuse avec la phrase ci-dessous, le monteur ne répond pas « C'est fait », et elle sort de
 * « Que puis-je demander ? » et de la consigne de Claude. Le test transversal
 * (`tests/facecam-monteur-honnete.test.ts`) vérifie chaque entrée : un rendu prouvé, ou un refus clair.
 */
import type { DeclencheurBruitage } from "@/domaine/types";
import type { OperationFacecam, TypeOperationFacecam } from "./operations";

export type Disponibilite = { rendu: true; par: string } | { rendu: false; phrase: string };

/** Début commun des refus : Will lit « Pas encore possible », jamais « C'est fait ». */
export const PAS_ENCORE_POSSIBLE = "Pas encore possible";

export const DISPONIBILITE_OPERATIONS: Record<TypeOperationFacecam, Disponibilite> = {
  ajouterCarte: { rendu: true, par: "habillage : carte rendue (Remotion) puis posée par la composition" },
  zoom: { rendu: true, par: "réalisation : plan serré (130 %) sur le passage, rendu au cadrage" },
  ecranPartage: { rendu: true, par: "habillage : écran partagé (carte en haut, Will en bas)" },
  miseEnPage: { rendu: true, par: "habillage : Will sur un côté ou en vignette" },
  couleurs: { rendu: true, par: "passe image : crans et teinte" },
  son: { rendu: true, par: "son monté (nettoyer, plus fort, moins fort) ; bruitages de la banque au mixage" },
  masquerPersonne: { rendu: false, phrase: `${PAS_ENCORE_POSSIBLE} : vous cacher puis vous faire revenir demande le détourage, qui n'est pas encore branché dans la vidéo.` },
  texteDerriere: { rendu: false, phrase: `${PAS_ENCORE_POSSIBLE} : le texte entre le mur et vous demande le détourage, qui n'est pas encore branché dans la vidéo.` },
  vitesse: { rendu: false, phrase: `${PAS_ENCORE_POSSIBLE} : accélérer ou ralentir un passage n'est pas encore branché dans la vidéo.` },
  arretImage: { rendu: false, phrase: `${PAS_ENCORE_POSSIBLE} : l'arrêt sur image n'est pas encore branché dans la vidéo.` },
  titre: { rendu: true, par: "habillage : carte « titre » (plein écran sur demande)" },
  generique: { rendu: true, par: "habillage : carte « titre plein écran » au début ou à la fin" },
  couper: { rendu: true, par: "coupes : son et image montés sans le passage" },
  retablir: { rendu: true, par: "coupes : passage remis" },
  retirer: { rendu: true, par: "passages : élément retiré avant l'habillage" },
  remettre: { rendu: true, par: "habillage : carte automatique reposée (identifiant retiré de la liste des cartes retirées)" },
  objetMain: { rendu: true, par: "effets spéciaux (lot I) : rendu Remotion posé en plein écran" },
  vitreBrisee: { rendu: true, par: "effets spéciaux (lot I) : rendu Remotion posé en plein écran" },
  transitionEcran: { rendu: true, par: "effets spéciaux (lot I) : rendu Remotion posé en plein écran" },
  effetRealisteIA: { rendu: true, par: "effet réaliste (lot K) : morceau rendu, posé au cadrage, après « Confirmer »" },
  changerTitreCouverture: { rendu: true, par: "miniature choisie : image de couverture refaite avec le nouveau titre (service miniatures), sans nouvelle version de la vidéo" },
};

/** Musique : aucune musique dans la banque du studio et aucun mixage musical branché dans la composition. */
export const PHRASE_MUSIQUE_INDISPONIBLE = `${PAS_ENCORE_POSSIBLE} : il n'y a pas encore de musique dans la vidéo (aucune musique branchée au mixage).`;

/**
 * Bruitages de la banque du studio (`public/bruitages`, CC0) : nom dit par Will → famille de la banque. Un nom qui
 * n'y est pas est refusé (on ne pose jamais un autre son en silence).
 */
const BRUITAGES_BANQUE: { declencheur: DeclencheurBruitage | "verre"; mots: RegExp }[] = [
  { declencheur: "illustration-forte", mots: /whoo?sh|swoosh|souffle|transition|passage rapide/ },
  { declencheur: "impact", mots: /\bpop\b|impact|boum|choc|coup|frappe/ },
  { declencheur: "chiffre", mots: /\btic\b|clic|click|chiffre|compteur/ },
  { declencheur: "document", mots: /papier|document|feuille|page/ },
  { declencheur: "telephone", mots: /t[eé]l[eé]phone|vibration|notification|sonnerie/ },
  { declencheur: "verre", mots: /verre|vitre/ },
];

/** Famille de la banque d'un bruitage demandé ; null : pas dans la banque. Sans nom : le « whoosh » (souffle court). */
export function bruitageDeLaBanque(nom: string | null | undefined): DeclencheurBruitage | "verre" | null {
  const t = (nom ?? "").trim().toLowerCase();
  if (!t) return "illustration-forte";
  return BRUITAGES_BANQUE.find((b) => b.mots.test(t))?.declencheur ?? null;
}

/** Disponibilité d'UNE opération (le type, puis les cas fins : musique, bruitage hors banque). */
export function disponibiliteOperation(op: OperationFacecam): Disponibilite {
  const base = DISPONIBILITE_OPERATIONS[op.type];
  if (!base?.rendu) return base ?? { rendu: false, phrase: `${PAS_ENCORE_POSSIBLE} : cette demande n'est pas encore branchée dans la vidéo.` };
  if (op.type === "son" && op.action === "musique") return { rendu: false, phrase: PHRASE_MUSIQUE_INDISPONIBLE };
  if (op.type === "son" && op.action === "bruitage" && !bruitageDeLaBanque(op.precision)) {
    return { rendu: false, phrase: `${PAS_ENCORE_POSSIBLE} : le bruitage « ${op.precision?.trim().slice(0, 40)} » n'est pas dans la banque du studio (disponibles : whoosh, pop, tic, papier, vibration, verre).` };
  }
  return base;
}

export const estDisponible = (type: TypeOperationFacecam) => DISPONIBILITE_OPERATIONS[type]?.rendu === true;
