/**
 * IMAGE → VIDÉO · Table unique des icônes : « ce que Claude voit » → nom d'icône (plan § 5). PUR.
 *
 * Les noms sont ceux de la bibliothèque « interface claire » (`NOMS_ICONES` de
 * `studio-rendu/compositions/interface-claire/elements.tsx`, recopiés ici car `src/` n'importe jamais `studio-rendu/` ;
 * un test vérifie que chaque nom existe toujours là-bas). Un mot inconnu rend `null` : il est refusé à l'écriture,
 * jamais remplacé par un rond par défaut.
 */

/** Noms d'icônes disponibles (sous-ensemble fermé de `NOMS_ICONES`). */
export const NOMS_ICONES_IV = [
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
  "euro",
  "cible",
  "tendance",
  "robot",
  "cloche",
  "envoyer",
  "dossier",
  "image",
  "usb",
  "scan",
] as const;
export type NomIconeIV = (typeof NOMS_ICONES_IV)[number];

/** Mot vu (sans accent, minuscules, singulier) → icône. */
export const TABLE_ICONES: Readonly<Record<string, NomIconeIV>> = Object.freeze({
  enveloppe: "mail",
  mail: "mail",
  "e-mail": "mail",
  email: "mail",
  courriel: "mail",
  horloge: "horloge",
  montre: "horloge",
  chrono: "horloge",
  chronometre: "horloge",
  minuteur: "horloge",
  sablier: "horloge",
  temps: "horloge",
  loupe: "loupe",
  recherche: "loupe",
  document: "document",
  fichier: "document",
  feuille: "document",
  pdf: "document",
  facture: "document",
  contrat: "document",
  dossier: "dossier",
  classeur: "dossier",
  drive: "dossier",
  bulle: "message",
  message: "message",
  chat: "message",
  chatbot: "robot",
  conversation: "message",
  coche: "coche",
  valide: "coche",
  "coche verte": "coche",
  eclair: "eclair",
  alerte: "cloche",
  cloche: "cloche",
  sonnette: "cloche",
  notification: "cloche",
  rapidite: "eclair",
  etincelle: "etincelles",
  ia: "etincelles",
  cerveau: "etincelles",
  robot: "robot",
  magie: "etincelles",
  calendrier: "calendrier",
  agenda: "calendrier",
  personne: "utilisateur",
  client: "utilisateur",
  utilisateur: "utilisateur",
  equipe: "utilisateurs",
  groupe: "utilisateurs",
  utilisateurs: "utilisateurs",
  entreprise: "batiment",
  batiment: "batiment",
  bureau: "batiment",
  reseau: "reseau",
  connexion: "reseau",
  lien: "reseau",
  outils: "reseau",
  boussole: "boussole",
  cible: "cible",
  objectif: "cible",
  resultat: "cible",
  decision: "boussole",
  direction: "boussole",
  formation: "former",
  diplome: "former",
  apprendre: "former",
  competence: "former",
  plus: "plus",
  ajout: "plus",
  croissance: "tendance",
  courbe: "tendance",
  tendance: "tendance",
  graphique: "tendance",
  productivite: "tendance",
  euro: "euro",
  "€": "euro",
  cout: "euro",
  argent: "euro",
  economie: "euro",
  piece: "euro",
  clarte: "coche",
  envoi: "envoyer",
  avion: "envoyer",
  "avion en papier": "envoyer",
  ticket: "document",
  photo: "image",
  image: "image",
  usb: "usb",
  "cle usb": "usb",
  scan: "scan",
  scanner: "scan",
});

function normalise(vu: string): string {
  return vu
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Icône pour un mot vu ; `null` si inconnu (refusé, jamais deviné). Essaie aussi le singulier (« enveloppes »). */
export function iconeDe(vu: string): NomIconeIV | null {
  const s = normalise(vu);
  if (Object.hasOwn(TABLE_ICONES, s)) return TABLE_ICONES[s];
  const singulier = s.replace(/(s|x)$/, "");
  return Object.hasOwn(TABLE_ICONES, singulier) ? TABLE_ICONES[singulier] : null;
}
