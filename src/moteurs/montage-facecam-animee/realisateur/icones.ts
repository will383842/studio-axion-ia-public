/**
 * ICÔNES AUTORISÉES du face caméra animé (lot C) — copie EXACTE de `NOMS_ICONES`
 * (`studio-rendu/compositions/interface-claire/elements.tsx`, dans l'ordre des tracés).
 *
 * Le rendu dessine un simple rond pour un nom inconnu : le réalisateur n'a donc droit qu'à ces noms. La copie évite
 * d'importer un composant React côté serveur ; un test vérifie que les deux listes restent identiques.
 */
export const ICONES_AUTORISEES = Object.freeze([
  "utilisateurs",
  "batiment",
  "reseau",
  "etincelles",
  "former",
  "boussole",
  "loupe",
  "eclair",
  "horloge",
  "coche",
  "plus",
  "mail",
  "document",
  "calendrier",
  "message",
  "utilisateur",
  "graphique",
  "tendance",
  "cadenas",
  "ecran",
  "image",
  "telephone",
  "euro",
  "cloche",
  "envoyer",
  "robot",
  "dossier",
  "tableur",
  "etoile",
  "coeur",
  "partage",
  "crayon",
  "globe",
  "video",
  "lien",
  "cible",
  "usb",
  "scan",
] as const);

export type NomIcone = (typeof ICONES_AUTORISEES)[number];

const ENSEMBLE = new Set<string>(ICONES_AUTORISEES);

export function iconeAutorisee(nom: string): nom is NomIcone {
  return ENSEMBLE.has(nom);
}
