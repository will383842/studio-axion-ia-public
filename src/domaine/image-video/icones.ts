/**
 * IMAGE → VIDÉO · Table unique des icônes : « ce que Claude voit » → nom d'icône (plan § 5). PUR.
 *
 * Les noms sont ceux de la bibliothèque « interface claire » (`NOMS_ICONES` de
 * `studio-rendu/compositions/interface-claire/elements.tsx`, recopiés ici car `src/` n'importe jamais `studio-rendu/` ;
 * un test vérifie que chaque nom existe toujours là-bas). `iconeDe` rend `null` pour un mot inconnu ; `iconeOuRepli`
 * choisit alors seule une icône (mots-clés proches, sinon icône neutre) : jamais de blocage ni de question.
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
  former: "former",
  envoyer: "envoyer",
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

/** Icône neutre quand ni le mot vu ni le libellé ne rappellent rien de connu. */
export const ICONE_NEUTRE: NomIconeIV = "document";

/**
 * Mots-clés (sur texte normalisé sans accent, tous ancrés par des limites de mot) → icône, du plus précis au plus général :
 * le premier motif de la liste qui trouve dans « mot vu + libellé » mis bout à bout gagne.
 */
const REPLIS_ICONES: readonly (readonly [RegExp, NomIconeIV])[] = [
  [/\b(rappel|relanc|alert|notif)\w*|\bsms\b/, "cloche"],
  [/\brendez-?\s?vous\b|\brdv\b|\b(calendrier|agenda|planning|creneaux?|dates?|veille|semaines?)\b/, "calendrier"],
  [/\b(reponses?|repond\w*|messages?|questions?|echanges?|discussions?|avis)\b/, "message"],
  [/\b(presen(t|te|ts|tes|ce)|confirme?e?s?|confirmation|valide?e?s?|validation|accept(e|ee|es|er|ation)?|arriv\w*|honore\w*|termine?e?s?)\b/, "coche"],
  [/\b(mails?|courriers?|courriels?)\b/, "mail"],
  [/\b(envoi\w*|envoy\w*|transmis\w*)/, "envoyer"],
  [/\b(heures?|delais?|attente|duree|minutes?|retards?)\b/, "horloge"],
  [/\b(patients?|clients?|personnes?|contacts?|prospects?|visiteurs?|eleves?|usagers?)\b/, "utilisateur"],
  [/\b(equipes?|groupes?|cabinets?)\b/, "utilisateurs"],
  [/\b(dossiers?|documents?|fiches?|comptes?|rapports?|factures?)\b/, "document"],
  [/\b(prix|tarifs?|paiements?|couts?|euros?)\b/, "euro"],
  [/\b(objectifs?|resultats?|but)\b/, "cible"],
];

/** Négation d'une validation (« invalide », « non confirmé », « pas accepté ») : on ne devine pas une coche, icône neutre. */
const NEGATION_ICONES = /\b(in|non|pas)\s?(valid|confirm|accept)/;

/**
 * Icône pour un mot vu, toujours une réponse : la table d'abord (`iconeDe`), sinon les mots-clés proches du mot vu puis du
 * libellé du bloc (« Rappel la veille » → cloche, « Patient présent au rendez-vous » → calendrier), sinon `ICONE_NEUTRE`.
 */
export function iconeOuRepli(vu: string, libelle = ""): NomIconeIV {
  const connue = iconeDe(vu);
  if (connue) return connue;
  const texte = normalise(`${vu} ${libelle}`);
  if (NEGATION_ICONES.test(texte)) return ICONE_NEUTRE;
  for (const [motif, icone] of REPLIS_ICONES) if (motif.test(texte)) return icone;
  return ICONE_NEUTRE;
}
