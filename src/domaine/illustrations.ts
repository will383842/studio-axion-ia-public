/**
 * ILLUSTRATIONS — règles PURES de la cascade (plan du moteur avocat B.6, lot M5 ; `MES-IMAGES-ORGANISATION.md`).
 *
 * Ordre de la cascade, au service, à l'Aperçu (le moteur ne fait que l'étape 2) :
 *   0.     Mes images : images PERSONNELLES de Will, PRÊTES (confidentialité validée), score ≥ seuil — dont les captures
 *          verticales de son site (Source axion-ia.com), qui passent devant à score égal ;
 *   0 bis. réutilisation AVANT toute dépense : toutes les autres illustrations de la Bibliothèque (déjà payées,
 *          déjà téléchargées), score ≥ seuil, anti-répétition à 10 vidéos d'écart ;
 *   1.     banques gratuites (Pexels puis Pixabay) : vidéos VERTICALES seulement, durée suffisante, sans texte ni logo ;
 *   2.     fabrication payante AU MOTEUR (image puis clip de 5 s), jamais de personne, de logo ni d'uniforme.
 * Mode « économique » : on s'arrête à l'étape 1 (rien n'est fabriqué ; sans résultat, le plan revient au double).
 *
 * Les requêtes sont tirées du plan SANS Claude tant qu'aucune clé n'existe : objet ou action concrets autour du mot
 * ancre, traduits par une table locale (français → anglais). Le refus des images génériques est fait par règles.
 */
import type { BlocScript, ElementBibliotheque, Id, Ratio } from "./types";

/* ------------------------------------------------------------------ */
/* Mots                                                                */
/* ------------------------------------------------------------------ */

const MOTS_VIDES = new Set(
  (
    "les des une un le la de du au aux et ou en dans sur sous par pour avec sans que qui quoi est sont ete etre avoir avez avons ont vous nous " +
    "ils elles il elle on je tu ce cet cette ces son sa ses leur leurs votre vos notre nos mon ma mes ton ta tes pas plus moins tres tout tous " +
    "toute toutes comme mais donc car ni ne se si deja encore aussi alors bien fait faire faut peut doit chez entre vers avant apres quand " +
    "comment pourquoi meme autre autres seul seule une deux trois quatre cinq dix the and for with from this that are was were your our " +
    // Adjectifs sans objet : ils ne disent pas CE que l'image montre (« un tribunal vide » ≠ « un bureau vide »).
    "vide vides plein pleine petit petite grand grande beau belle nouveau nouvelle vieux vieille simple " +
    "into onto over under its their them they you have has had not just very"
  ).split(" "),
);

/** Mots sans accents, en minuscules, singulier simple, sans mots vides (3 lettres au moins, chiffres gardés). */
export function motsSignificatifs(texte: string | undefined): string[] {
  const brut = (texte ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((m) => (m.length >= 3 || /^\d+$/.test(m) || Object.hasOwn(TRADUCTIONS, m)) && !MOTS_VIDES.has(m));
  return Array.from(new Set(brut.map(racine)));
}

/** Racine grossière : pluriels en -s / -x retirés (« factures » = « facture », « journaux » ≈ « journau »). */
export function racine(mot: string): string {
  if (mot.length > 4 && /[sx]$/.test(mot) && !/ss$/.test(mot)) return mot.slice(0, -1);
  return mot;
}

/**
 * Deux mots se rejoignent : égaux, ou même début sur 5 lettres quand le plus court en a 6 au moins
 * (contester / contestation, signing / signature) — jamais « table » / « tableau » ni « park » / « parking ».
 */
export function motsProches(a: string, b: string): boolean {
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 6 && a.slice(0, 5) === b.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* Traduction locale (requêtes des banques) — remplacée par Claude plus tard, même interface */
/* ------------------------------------------------------------------ */

/** Français → anglais, objets et actions concrets d'un studio « avocat » (les mots inconnus ne sont pas traduits). */
export const TRADUCTIONS: Record<string, string> = {
  amende: "fine",
  contravention: "parking ticket",
  avi: "notice",
  pv: "parking ticket",
  table: "table",
  bureau: "desk",
  voiture: "car",
  route: "road",
  autoroute: "highway",
  radar: "speed camera",
  parking: "parking",
  stationnement: "parking",
  contrat: "contract",
  facture: "invoice",
  devi: "quote document",
  telephone: "smartphone",
  smartphone: "smartphone",
  ordinateur: "laptop",
  ecran: "screen",
  tribunal: "courthouse",
  justice: "justice scale",
  balance: "scale",
  marteau: "gavel",
  lettre: "letter",
  courrier: "mail",
  enveloppe: "envelope",
  boite: "mailbox",
  argent: "money",
  euro: "euro banknotes",
  billet: "banknotes",
  piece: "coins",
  monnaie: "coins",
  calendrier: "calendar",
  horloge: "clock",
  montre: "watch",
  jour: "calendar",
  delai: "hourglass",
  sablier: "hourglass",
  stylo: "pen",
  signature: "signing document",
  signer: "signing document",
  document: "document",
  papier: "paperwork",
  dossier: "folder",
  classeur: "binder",
  cle: "keys",
  maison: "house",
  appartement: "apartment",
  loyer: "rent",
  usine: "factory",
  atelier: "workshop",
  entrepot: "warehouse",
  camion: "truck",
  cafe: "coffee",
  carnet: "notebook",
  graphique: "chart",
  tableau: "chart",
  banque: "bank",
  carte: "credit card",
  calculatrice: "calculator",
  loupe: "magnifying glass",
  livre: "book",
  code: "law book",
  loi: "law book",
  impot: "tax form",
  salaire: "paycheck",
  fiche: "payslip",
  licenciement: "cardboard box office",
  travail: "work",
  conge: "vacation",
  vacance: "vacation",
  accident: "car accident",
  assurance: "insurance",
  permi: "driving license",
  feu: "traffic light",
  vitesse: "speedometer",
  compteur: "speedometer",
  pluie: "rain",
  nuit: "night city",
  ville: "city",
  rue: "street",
  porte: "door",
  colis: "parcel",
  commande: "parcel",
  panier: "shopping cart",
  magasin: "store",
  ticket: "receipt",
  recu: "receipt",
  conteste: "appeal letter",
  contester: "appeal letter",
  recour: "appeal letter",
  erreur: "red pen correction",
  calcul: "calculator",
  economie: "piggy bank",
  economiser: "piggy bank",
  tirelire: "piggy bank",
  medicament: "medicine",
  hopital: "hospital",
  ecole: "school",
  train: "train",
  avion: "airplane",
  valise: "suitcase",
  chantier: "construction site",
  outil: "tools",
  machine: "machine",
  imprimante: "printer",
  email: "email inbox",
  mail: "email inbox",
  message: "phone notification",
  notification: "phone notification",
  alerte: "phone notification",
  telegram: "phone notification",
  console: "laptop dashboard",
  automatisation: "laptop dashboard",
  donnee: "data chart",
  client: "handshake",
  recommandee: "registered letter",
  recommande: "registered letter",
  accuse: "acknowledgment",
  reception: "receipt",
  tampon: "rubber stamp",
  parcmetre: "parking meter",
  reunion: "meeting room",
  // Correcteur réel 2 (04/10) : vocabulaire bureau, logiciels et automatisation (1re vraie vidéo : Excel, alertes…).
  excel: "spreadsheet computer screen",
  tableur: "spreadsheet computer screen",
  clavier: "typing keyboard",
  saisie: "typing keyboard",
  saisir: "typing keyboard",
  taper: "typing keyboard",
  copier: "typing keyboard",
  logiciel: "software computer screen",
  application: "smartphone app",
  appli: "smartphone app",
  fichier: "computer files",
  formulaire: "form paperwork",
  dashboard: "dashboard screen",
  rapport: "report document",
  agenda: "calendar",
  semaine: "calendar",
  mois: "calendar",
  heure: "clock",
  minute: "clock",
  temp: "clock",
  tache: "checklist",
  liste: "checklist",
  vente: "sales chart",
  chiffre: "sales chart",
  stock: "warehouse shelves",
  comptable: "calculator",
  comptabilite: "calculator",
  paiement: "credit card payment",
  virement: "bank transfer phone",
  relance: "phone notification",
  robot: "robot arm",
  ia: "artificial intelligence screen",
  intelligence: "artificial intelligence screen",
  automatique: "laptop dashboard",
  automatiser: "laptop dashboard",
  automatise: "laptop dashboard",
};

/** Mots-clés anglais d'une requête française (table locale ; un mot déjà anglais passe tel quel). */
export function motsAnglais(texte: string | undefined): string[] {
  const sortie: string[] = [];
  for (const m of motsSignificatifs(texte)) {
    const t = Object.hasOwn(TRADUCTIONS, m) ? TRADUCTIONS[m] : undefined;
    if (t) sortie.push(...t.split(" "));
  }
  return Array.from(new Set(sortie));
}

/* ------------------------------------------------------------------ */
/* Requête d'un plan                                                   */
/* ------------------------------------------------------------------ */

export interface PlanAIllustrer {
  id: Id;
  ordre: number;
  texte: string;
  /** Intention écrite dans le script (« un avis de contravention sur une table ») : prime sur le texte. */
  requete?: string;
  /** Mot ancre (le mot que l'image MONTRE, B.2) : son texte, s'il est connu. */
  motAncre?: string;
}

export interface RequeteIllustration {
  /** Mots français (Bibliothèque, Mes images). */
  motsFr: string[];
  /** Requête anglaise des banques (objet concret, 4 mots au plus). */
  requeteEn: string;
  /** Mot ancre normalisé (bonus de score). */
  ancre?: string;
}

/** Requête concrète d'un plan : l'intention si elle existe, sinon le texte ; le mot ancre passe en tête. */
export function requeteDuPlan(p: PlanAIllustrer): RequeteIllustration {
  const source = p.requete?.trim() || p.texte;
  const ancre = p.motAncre ? motsSignificatifs(p.motAncre)[0] : undefined;
  const motsFr = motsSignificatifs(source);
  const ordonnes = ancre ? [ancre, ...motsFr.filter((m) => m !== ancre)] : motsFr;
  const en = motsAnglais(ordonnes.join(" "));
  return { motsFr: ordonnes, requeteEn: en.slice(0, 4).join(" "), ancre };
}

/* ------------------------------------------------------------------ */
/* Intentions automatiques d'un texte collé (correcteur réel 2, 04/10)  */
/* ------------------------------------------------------------------ */

/** Blocs jamais illustrés d'office : l'accroche (le visage d'abord), l'appel et la boucle (la fin reste au visage). */
const BLOCS_SANS_ILLUSTRATION_AUTO = new Set(["accroche", "appel", "boucle"]);

/** Mots concrets d'une phrase, TELS QU'ÉCRITS (au plus 3) : ceux que la table locale sait montrer, jamais une personne. */
function motsConcrets(texte: string): string[] {
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const brut of texte.split(/[^\p{L}\p{N}]+/u)) {
    const mot = brut.toLowerCase();
    const r = motsSignificatifs(mot)[0];
    if (!r || vus.has(r) || !Object.hasOwn(TRADUCTIONS, r) || contientInterdit(mot)) continue;
    vus.add(r);
    sortie.push(mot);
  }
  return sortie.slice(0, 3);
}

/**
 * Un texte COLLÉ n'est jamais réécrit : ses segments n'ont aucune intention d'illustration, et la vidéo sortait sans
 * une seule illustration. Ici, sans Claude et sans rien dépenser, on choisit ~1 segment sur 3 qui nomme un objet
 * concret (contravention, radar, lettre recommandée…) : jamais le premier ni le dernier segment, jamais l'accroche,
 * l'appel ni la boucle, jamais deux segments voisins. L'intention est faite des mots du texte lui-même.
 * Renvoie segmentId → intention. Un script qui porte déjà UNE intention écrite n'est pas touché (rien n'est renvoyé).
 */
export function intentionsAutomatiques(blocs: BlocScript[]): Map<Id, string> {
  const segments = blocs.flatMap((b) => b.segments.filter((s) => s.texte.trim()).map((s) => ({ s, bloc: b.blocRecette })));
  const choix = new Map<Id, string>();
  if (segments.some((x) => x.s.intentionIllustration?.trim())) return choix;
  const cible = Math.max(1, Math.round(segments.length / 3));
  const candidats = segments
    .map((x, rang) => ({ id: x.s.id, rang, bloc: x.bloc, mots: motsConcrets(x.s.texte) }))
    .filter((c) => c.rang > 0 && c.rang < segments.length - 1 && !BLOCS_SANS_ILLUSTRATION_AUTO.has(c.bloc) && c.mots.length > 0)
    .filter((c) => requeteFabrication(requeteDuPlan({ id: c.id, ordre: c.rang, texte: c.mots.join(" ") }).requeteEn) !== null)
    // Les phrases les plus concrètes d'abord, puis dans l'ordre du texte.
    .sort((a, b) => b.mots.length - a.mots.length || a.rang - b.rang);
  const rangs: number[] = [];
  for (const c of candidats) {
    if (rangs.length >= cible) break;
    if (rangs.some((r) => Math.abs(r - c.rang) < 2)) continue;
    rangs.push(c.rang);
    choix.set(c.id, c.mots.join(" "));
  }
  return choix;
}

/* ------------------------------------------------------------------ */
/* Images génériques, interdits de fabrication                         */
/* ------------------------------------------------------------------ */

/** Mots « génériques » (bureau vide, technologie abstraite) : une image décrite seulement par eux est refusée (Mayer). */
const GENERIQUES = new Set(
  "technologie technology abstrait abstract concept business entreprise succes success fond background texture motif pattern digital numerique innovation futur future reseau network lumiere light bokeh".split(" ").map(racine),
);

/** Une description qui ne dit rien de concret (seulement des mots génériques) : refusée. */
export function estGenerique(description: string | undefined): boolean {
  const mots = motsSignificatifs(description);
  return mots.length > 0 && mots.every((m) => GENERIQUES.has(m));
}

/** Mots qui font générer une personne, un logo ou un uniforme : interdits (B.6). */
const INTERDITS_FABRICATION =
  /\b(personnes?|gens|hommes?|femmes?|enfants?|bebes?|people|person|persons|man|men|woman|women|child|children|kid|kids|visages?|faces?|portraits?|selfie|policiers?|gendarmes?|police|officer|cops?|avocats?|lawyer|juges?|judge|clients?|employes?|salaries?|patrons?|medecins?|doctor|soldats?|soldier|logos?|marques?|brand|trademark|uniformes?|uniform|badge|insigne|drapeau officiel)\b/gi;

/**
 * Requête de fabrication sûre : les mots interdits sont RETIRÉS (jamais de personne, de logo ni d'uniforme) ;
 * sans objet restant, rien n'est fabriqué (`null`).
 */
export function requeteFabrication(requeteEn: string): string | null {
  const propre = requeteEn.replace(INTERDITS_FABRICATION, " ").replace(/\s+/g, " ").trim();
  if (!propre || estGenerique(propre)) return null;
  return `${propre}, realistic close-up photograph, natural light, shallow depth of field, vertical composition, no people, no hands, no faces, no text, no logo, no uniform`;
}

/** Une requête contient-elle un mot interdit à la fabrication ? (affiché comme raison, testé) */
export function contientInterdit(requete: string): boolean {
  INTERDITS_FABRICATION.lastIndex = 0;
  const r = INTERDITS_FABRICATION.test(requete);
  INTERDITS_FABRICATION.lastIndex = 0;
  return r;
}

/** Consigne du clip animé : mouvement naturel de la scène, jamais un zoom lent sur une image fixe. */
export const CONSIGNE_CLIP = "subtle natural motion in the scene, gentle handheld camera drift, realistic, no people, no text, no logo";

/* ------------------------------------------------------------------ */
/* Score de correspondance                                             */
/* ------------------------------------------------------------------ */

/** Score minimal pour qu'un élément existant soit pris (sinon, on cherche plus loin dans la cascade). */
export const SEUIL_CORRESPONDANCE = 0.5;

type ElementScore = Pick<ElementBibliotheque, "nom" | "motsCles" | "description" | "motsClesEn">;

/**
 * Score 0-1 d'un élément pour une requête : part des mots de la requête retrouvés dans ses mots-clés, sa description
 * et son nom (français), ou dans ses mots-clés anglais ; + 0,25 si le mot ancre est retrouvé. Un élément décrit
 * seulement par des mots génériques est divisé par deux.
 */
export function scoreCorrespondance(req: RequeteIllustration, e: ElementScore): number {
  if (!req.motsFr.length) return 0;
  const fr = motsSignificatifs([e.nom, e.description, ...e.motsCles].join(" "));
  const en = motsSignificatifs((e.motsClesEn ?? []).join(" "));
  const trouve = (m: string) => fr.some((x) => motsProches(x, m)) || motsAnglais(m).some((t) => en.some((x) => motsProches(x, racine(t))));
  const consideres = req.motsFr.slice(0, 4);
  const retrouves = consideres.filter(trouve).length;
  let score = retrouves / consideres.length;
  if (req.ancre && trouve(req.ancre)) score += 0.25;
  score = Math.min(1, score);
  if (estGenerique(e.description)) score /= 2;
  return Math.round(score * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Anti-répétition                                                     */
/* ------------------------------------------------------------------ */

/** Pas le même élément dans deux vidéos à moins de 10 vidéos d'écart (B.6, étape 0 bis). */
export const ECART_ANTI_REPETITION = 10;

/** L'élément peut-il servir dans la vidéo de rang `rang` ? (même vidéo : oui ; jamais servi : oui) */
export function disponiblePourVideo(e: Pick<ElementBibliotheque, "derniereVideoId" | "dernierRangVideo">, videoId: Id, rang: number): boolean {
  if (!e.derniereVideoId || e.derniereVideoId === videoId || e.dernierRangVideo === undefined) return true;
  return rang - e.dernierRangVideo >= ECART_ANTI_REPETITION;
}

/** Ce que la fabrication écrit sur un élément utilisé (compteur, dernière vidéo, rang). Une même vidéo ne compte qu'une fois. */
export function usageApres(e: Pick<ElementBibliotheque, "utilisations" | "derniereVideoId">, videoId: Id, rang: number): Pick<ElementBibliotheque, "utilisations" | "derniereVideoId" | "dernierRangVideo"> {
  const deja = e.derniereVideoId === videoId;
  return { utilisations: (e.utilisations ?? 0) + (deja ? 0 : 1), derniereVideoId: videoId, dernierRangVideo: rang };
}

/* ------------------------------------------------------------------ */
/* Cascade (étapes 0 et 0 bis : PURES)                                  */
/* ------------------------------------------------------------------ */

/** D'où vient l'illustration d'un plan, affiché à l'Aperçu. */
export type OrigineCascade = "mes-images" | "reutilisee" | "banque" | "a-fabriquer" | "choix" | "double";

export interface DecisionIllustration {
  planId: Id;
  origine: OrigineCascade;
  elementId?: Id;
  score?: number;
  /** Requête anglaise (banques, fabrication). */
  requeteEn?: string;
}

export type ElementCascade = Pick<
  ElementBibliotheque,
  "id" | "type" | "nom" | "motsCles" | "description" | "motsClesEn" | "origine" | "confidentialite" | "archiveLe" | "derniereVideoId" | "dernierRangVideo" | "licence" | "fabrique" | "sourceSite"
>;

/** Une image personnelle n'entre dans la cascade que PRÊTE (confidentialité validée par Will). */
export function utilisableParLeMoteur(e: Pick<ElementBibliotheque, "origine" | "confidentialite" | "archiveLe" | "type"> & { sourceSite?: Pick<NonNullable<ElementBibliotheque["sourceSite"]>, "format"> }): boolean {
  if (e.archiveLe) return false;
  if (e.type !== "illustration-image" && e.type !== "illustration-video") return false;
  // Capture de votre site (Source axion-ia.com) : seule la verticale entre dans une vidéo 9:16 (jamais un 16:9 recadré).
  if (e.sourceSite && e.sourceSite.format !== "9:16") return false;
  if (e.origine === "personnelle") return e.confidentialite?.statut === "prete";
  // Une illustration d'une autre origine qui porte un contrôle « à vérifier » attend aussi la validation.
  return !e.confidentialite || e.confidentialite.statut === "prete";
}

/**
 * Étapes 0 et 0 bis pour UN plan : le meilleur élément de Mes images (prêt), sinon le meilleur élément déjà payé ou
 * téléchargé, au-dessus du seuil, disponible (anti-répétition) et pas déjà pris dans cette vidéo. `null` : il faut
 * chercher plus loin (banques, puis fabrication).
 */
export function choisirDansLaBibliotheque(req: RequeteIllustration, elements: ElementCascade[], ctx: { videoId: Id; rang: number; dejaPris: Set<Id> }): { origine: "mes-images" | "reutilisee"; elementId: Id; score: number } | null {
  const possibles = elements.filter((e) => utilisableParLeMoteur(e) && !ctx.dejaPris.has(e.id) && disponiblePourVideo(e, ctx.videoId, ctx.rang) && e.licence.type !== "a-verifier");
  const noter = (liste: ElementCascade[]) =>
    liste
      .map((e) => ({ e, s: scoreCorrespondance(req, e) }))
      .filter((x) => x.s >= SEUIL_CORRESPONDANCE)
      // À score égal, une capture de votre site passe devant (Source axion-ia.com : « le plan parle de ce sujet »).
      .sort((a, b) => b.s - a.s || Number(!!b.e.sourceSite) - Number(!!a.e.sourceSite) || a.e.nom.localeCompare(b.e.nom))[0];
  const perso = noter(possibles.filter((e) => e.origine === "personnelle"));
  if (perso) return { origine: "mes-images", elementId: perso.e.id, score: perso.s };
  const autre = noter(possibles.filter((e) => e.origine !== "personnelle"));
  if (autre) return { origine: "reutilisee", elementId: autre.e.id, score: autre.s };
  return null;
}

/* ------------------------------------------------------------------ */
/* Banques (étape 1)                                                    */
/* ------------------------------------------------------------------ */

/** Mots de la description d'un résultat de banque qui trahissent du texte ou une marque à l'image. */
const TEXTE_OU_LOGO = /\b(text|texte|logo|brand|typography|lettering|sign|signage|watermark|title|titre|caption)\b/i;

/**
 * Résultat de banque acceptable : VERTICAL (jamais un 16:9 recadré : hauteur / largeur ≥ 1,5 pour le 9:16, ≥ 1,2
 * pour le 4:5), durée suffisante, licence commerciale, sans texte ni logo, pas générique.
 */
export function resultatBanqueAcceptable(r: { largeur: number; hauteur: number; dureeSec: number; description: string; licence: { usageCommercial: boolean } }, ratio: Ratio, dureeMinSec: number, requeteEn?: string): boolean {
  if (!r.largeur || !r.hauteur || r.hauteur <= r.largeur) return false;
  const minimum = ratio === "9:16" ? 1.5 : ratio === "4:5" ? 1.2 : 1;
  if (r.hauteur / r.largeur < minimum) return false;
  if (r.dureeSec < dureeMinSec) return false;
  if (!r.licence.usageCommercial) return false;
  if (TEXTE_OU_LOGO.test(r.description) || estGenerique(r.description)) return false;
  if (requeteEn && !pertinent(r.description, requeteEn)) return false;
  return true;
}

/**
 * Le résultat MONTRE-t-il ce que dit la requête ? (le modèle de vision le jugera ; d'ici là, règle simple : l'objet
 * principal, ou au moins la moitié des mots de la requête, dans la description). Une banque renvoie souvent « un homme devant une machine » pour
 * « parking ticket » : refusé, on passe au suivant (Mayer : une image sans lien nuit à la compréhension).
 */
export function pertinent(description: string, requeteEn: string): boolean {
  const voulus = motsSignificatifs(requeteEn);
  if (!voulus.length) return true;
  const vus = motsSignificatifs(description);
  const trouve = (v: string) => vus.some((x) => motsProches(x, v));
  // L'objet principal (premier mot : le mot ancre passe en tête) suffit ; sinon, pour 3 mots et plus, la moitié.
  return trouve(voulus[0]) || (voulus.length >= 3 && voulus.filter(trouve).length >= Math.ceil(voulus.length / 2));
}

/* ------------------------------------------------------------------ */
/* Coûts                                                                */
/* ------------------------------------------------------------------ */

/**
 * Tarifs de la fabrication fal.ai, en centimes de DOLLAR (relevés le 02/10 sur les pages des modèles) :
 * image Nano Banana 3,9 ¢ ; clip Seedance 1.0 Pro Fast 720p : 1 $ le million de « jetons vidéo »,
 * jetons = hauteur × largeur × 24 i/s × durée / 1024 (720 × 1280, 5 s ≈ 108 000 → 10,8 ¢).
 */
export const TARIFS_FABRICATION_USD = {
  image: 3.9,
  clipParSeconde: (720 * 1280 * 24) / 1024 / 1_000_000 * 100,
  dureeClipSec: 5,
};

/** Prix d'une illustration fabriquée (image + clip), en centimes de dollar. */
export function prixFabricationUsd(dureeClipSec = TARIFS_FABRICATION_USD.dureeClipSec): number {
  return TARIFS_FABRICATION_USD.image + TARIFS_FABRICATION_USD.clipParSeconde * dureeClipSec;
}

/** Résumé des coûts d'illustration d'une vidéo, affiché à l'Aperçu : « réutilisé 0 € » et « à fabriquer ». */
export function resumeCoutIllustrations(decisions: DecisionIllustration[], tauxUsdEur: number, economique: boolean): { reutilisees: number; banques: number; mesImages: number; aFabriquer: number; centimesAFabriquer: number } {
  const n = (o: OrigineCascade) => decisions.filter((d) => d.origine === o).length;
  const aFabriquer = economique ? 0 : n("a-fabriquer");
  return {
    mesImages: n("mes-images"),
    reutilisees: n("reutilisee") + n("choix"),
    banques: n("banque"),
    aFabriquer,
    centimesAFabriquer: Math.round(aFabriquer * prixFabricationUsd() * tauxUsdEur),
  };
}
