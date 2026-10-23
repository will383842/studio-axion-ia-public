/**
 * RÉALISATEUR PAR RÈGLES FIXES (lot C, version « simple ») — PUR et DÉTERMINISTE, sans Claude.
 *
 * Sert quand Claude n'est pas relié, quand le plafond du mois est atteint, ou quand la version complète échoue après ses
 * essais. Depuis le retour de Will sur la vidéo 5 (15/10 : « c'est presque toujours les mêmes choses qui reviennent en
 * animations… le visage est caché trop tôt »), il ne remplit plus le temps d'étiquettes : il POSE DES APPARITIONS DE
 * FAMILLES VARIÉES (15 familles : fenêtre, étiquette, carte et les 12 motions de `familles.ts`), de gauche à droite, une
 * toutes les 2 s environ :
 * 1. découpage en phrases et en segments (ponctuation forte, blanc > 1,5 s, séries « un, deux, trois »), comme avant ;
 * 2. à chaque instant, chaque famille propose sa pose d'après les mots dits (nombre → chiffre qui éclate ou compteur ;
 *    temps, soirées, journées → horloge ; question → bulles ; e-mail, relance, visio, rendez-vous → téléphone ;
 *    « partout », « à distance », entreprises → carte de France ; tâches énumérées → pile de notifications ; charge,
 *    priorité, trop → jauge ; suite de noms → ruban ; mot choc → mot géant ; opposition → écran partagé ; début de
 *    partie → volet ; énumération, question, appel → carte ; action ou lieu → fenêtre ; mot fort → trait dessiné ou
 *    étiquette) ;
 * 3. on garde la pose la mieux notée PARMI CELLES QUE LES RÈGLES PERMETTENT (R1 ouverture sur le visage entier, R2 temps de
 *    visage, R3 jamais deux fois la même famille de suite ni plus de 2 sur 5, couples qui ne reviennent pas, R4 plafonds
 *    et 20 % au plus par famille, R7 historique) ; la note favorise le mot qui appelle la famille, les familles encore peu
 *    servies, celles absentes de la vidéo précédente, et ce qui bouge en continu quand la parole fait un blanc ;
 * 4. les trous (> 0,7 s sans changement visible, comptés comme la mesure par `rythmePrevu`) sont réparés en déplaçant
 *    les bords des objets (une entrée ou une sortie tombe dans le trou) ;
 * 5. plusieurs variantes (graines de rotation) sont essayées ; la première qui passe `verifierPlan` sans erreur est gardée.
 * Cahier « perfection » (14/10) toujours tenu : littéralité (« illustre », un nom dit par élément, scène sujet + action
 * + lieu), cartes jamais vides ni immobiles, aucun zoom ni mouvement de cadrage (décision de Will du 15/10).
 */
import { schemaCalque, schemaCarte, schemaFenetre, schemaMotion, VERSION_PLAN_FACECAM_ANIMEE, type CalquePlan, type CartePlan, type ContenuCarte, type FenetrePlan, type MotionPlan, type MouvementPlan, type PlanFacecamAnimee, type TypeCarte } from "@/domaine/facecam-animee/plan";
import { CATALOGUE_FAMILLES, DIVERSITE, FAMILLES, plafondFamille, type Famille } from "./familles";
import type { NomIcone } from "./icones";
import { estMotOutil, majuscule, motsInterditsDans, nettoyer, nombresDansTexte, ponctuationFinale, sansElision, simplifier, valeurEnLettres, type MotTranscrit } from "./mots";
import { estMotFort } from "./sous-titres";
import { rythmePrevu, type RythmePrevu } from "./rythme";
import { groupesSousTitres } from "./sous-titres";
import { bruitagesDuPlan, instantsMotion } from "./sons";
import { controlerDiversite, copieCarte, motCleAvantEntree, exigencesScene, metaphoresDe, objetsDuPlan, SEUILS, TETES_TITRE_ABSTRAIT, LEGENDES_ECRAN, LEGENDES_IMAGE, motsSimples, verifierPlan, type HistoriqueVideo } from "./regles";

export interface EntreeReglesFixes {
  mots: readonly MotTranscrit[];
  /** Durée totale de la vidéo (écran de fin compris). */
  dureeSec: number;
  /** Début de l'écran de fin : rien ne le dépasse. */
  finDebut: number;
  /** Mot tapé dans la carte « commentaire » de l'appel à l'action (celui de l'écran de fin). */
  motCle?: string;
  historique?: readonly HistoriqueVideo[];
  /** Hauteur des yeux dans la prise (descente prévue par le contrôle du rythme) ; absente : 0,34. */
  prise?: { yeux?: number };
}

/** Ce que décide le réalisateur (le reste du plan — dimensions, sons, sous-titres, fin — est rempli par le code). */
export interface MiseEnScene {
  cartes: CartePlan[];
  fenetres: FenetrePlan[];
  calques: CalquePlan[];
  /** Motions (15/10) : les 12 familles « motion design » hors cartes. */
  motions: MotionPlan[];
  /** Toujours vide : aucun zoom depuis la décision de Will du 15/10 (« ça bouge trop »). */
  zooms: [number, number, number][];
  /** Toujours vide (même décision). */
  mouvements: MouvementPlan[];
  /** Mots illustrés : ils passent sur plaque dans les sous-titres. */
  motsForts: string[];
}

/* ---------------- Réglages ---------------- */

const arrondi = (x: number) => Math.round(x * 1000) / 1000;
const BLANC_PHRASE_SEC = 1.5;
const PHRASE_MAX_SEC = 8.5;
const CARTE_MIN_SEC = 1.5;
/** Des mots sont ajoutés dans une carte dès que deux sous-éléments sont à plus de 0,6 s (revue passe 2 du 15/10). */
const ECART_SOUS_ELEMENTS_SEC = 0.6;
/**
 * Une carte n'attend jamais plus de 0,7 s un nouveau sous-élément (contrôle : 0,8 s au plus, conseil 0,7 s, revue
 * passe 2 du 15/10) : sans zoom, seuls ses sous-éléments font vivre une carte ; au-delà, elle sort plus tôt.
 */
const ECART_CARTE_MAX_SEC = 0.62;
/** Une carte qui n'a plus rien à montrer sort 0,7 s au plus après son dernier sous-élément. */
const TENUE_APRES_DERNIER_SEC = 0.7;
/** Une carte sort au plus 0,5 s après son dernier sous-élément (passe 3 : la tenue immobile est un trou à la mesure). */
const TENUE_FIN_CARTE_SEC = 0.5;
/** Premier sous-élément 0,15 s au plus après l'entrée de la carte (contrôle : 0,2 s). */
const CARTE_VIDE_VISEE_SEC = 0.15;
/** Fenêtres : 1,2 s au moins (contrôle : 1 à 3 s). */
const FENETRE_MIN_SEC = 1.2;
const ENTREES_CARTE = ["chute", "glisse", "surgit"] as const;
const ENTREES_FENETRE = ["droite", "zoom", "droite", "bas"] as const;
const FONDS = ["orange", "ivoire", "encre"] as const;
/** Rotation des cartes « génériques » (une phrase pleine de noms) et des énumérations. */
const ROTATION = ["graphique", "liste", "frise", "grille", "calendrier", "chat", "statuts"] as const satisfies readonly TypeCarte[];
const CAPACITE: Record<TypeCarte, number> = { liste: 5, grille: 6, frise: 10, calendrier: 10, graphique: 7, statuts: 6, chat: 5, commentaire: 5, calcul: 0, logos: 0 };

/** Icône d'un mot (forme simplifiée ; les pluriels en « s » suivent le singulier). */
const ICONES_MOTS: Record<string, NomIcone> = {
  temps: "horloge", minute: "horloge", minutes: "horloge", heure: "horloge", heures: "horloge", soiree: "horloge", "apres-midi": "horloge",
  journee: "calendrier", jour: "calendrier", semaine: "calendrier", mois: "calendrier", calendrier: "calendrier", reservez: "calendrier", reserver: "calendrier", "rendez-vous": "calendrier",
  devis: "document", document: "document", contrat: "document", facture: "euro", relance: "mail", mail: "mail", email: "mail", "e-mail": "mail",
  chiffre: "graphique", statistique: "graphique", resultat: "graphique", croissance: "tendance", fuite: "tendance",
  dirigeant: "utilisateur", embauche: "utilisateur", recrutement: "utilisateur", recruter: "utilisateur", client: "utilisateur",
  equipe: "utilisateurs", salarie: "utilisateurs", collaborateur: "utilisateurs", entreprise: "batiment", structure: "batiment", groupe: "reseau", reseau: "reseau",
  ia: "robot", robot: "robot", automatise: "eclair", automatiser: "eclair", automatisation: "eclair", outil: "plus",
  audite: "loupe", audit: "loupe", auditer: "loupe", diagnostic: "loupe", trouver: "loupe", regarde: "loupe",
  forme: "former", former: "former", formation: "former", accompagne: "boussole", accompagnement: "boussole", etape: "boussole",
  visio: "video", video: "video", appel: "telephone", telephone: "telephone", gratuit: "etoile", priorite: "etoile", miracle: "etincelles",
  argent: "euro", euro: "euro", cout: "euro", coute: "euro", prix: "euro", message: "message", commentaire: "message", commentez: "message",
  administratif: "dossier", dossier: "dossier", tableau: "tableur", tableur: "tableur", ecran: "ecran", ordinateur: "ecran", site: "globe",
  lien: "lien", partage: "partage", envoyer: "envoyer", "week-end": "coeur", probleme: "cloche", alerte: "cloche", securite: "cadenas",
};
const ICONES_DE_SECOURS: readonly NomIcone[] = ["etoile", "coche", "eclair", "document", "etincelles", "boussole"];

/**
 * Mots concrets (actions, lieux, choses) → la SCÈNE que la fenêtre montre, sujet + action + lieu, et s'il faut une
 * mini-vidéo (recherche Mes images → Pexels → Pixabay). Chaque scène reprend le mot (contrôle anti-métaphore).
 */
const SCENES: Record<string, { scene: string; video: boolean }> = {
  entreprise: { scene: "équipe au travail dans les bureaux d'une entreprise", video: true },
  journee: { scene: "salarié qui finit sa journée tard au bureau", video: true },
  travail: { scene: "personne qui travaille sur un ordinateur au bureau", video: true },
  fuite: { scene: "robinet qui fuit goutte à goutte dans une cuisine", video: true },
  soiree: { scene: "dirigeant qui travaille seul au bureau le soir", video: true },
  devis: { scene: "artisan qui tape un devis sur son ordinateur", video: true },
  relance: { scene: "personne qui écrit un e-mail de relance au bureau", video: true },
  main: { scene: "mains qui écrivent à la main sur un carnet au bureau", video: true },
  chiffre: { scene: "comptable qui consulte des chiffres sur un écran", video: true },
  dirigeant: { scene: "dirigeant qui travaille à son bureau", video: true },
  charge: { scene: "dirigeant chargé de dossiers qui s'empilent sur son bureau", video: false },
  temps: { scene: "horloge de bureau qui montre le temps qui passe", video: true },
  jour: { scene: "dirigeant qui coche chaque jour son agenda au bureau", video: true },
  equipe: { scene: "équipe en réunion autour d'une table de bureau", video: true },
  ia: { scene: "personne qui écrit à une IA sur son ordinateur", video: true },
  outil: { scene: "gérant qui passe d'un outil à l'autre au bureau", video: true },
  embauche: { scene: "dirigeant qui fait passer un entretien d'embauche au bureau", video: true },
  recrutement: { scene: "dirigeant qui fait passer un entretien de recrutement", video: true },
  recruter: { scene: "dirigeant qui reçoit un candidat à recruter au bureau", video: true },
  administratif: { scene: "gérant qui trie des dossiers administratifs au bureau", video: false },
  "apres-midi": { scene: "salariés qui quittent le bureau l'après-midi", video: true },
  "week-end": { scene: "famille qui se promène au parc le week-end", video: true },
  visio: { scene: "réunion en visio sur un ordinateur portable", video: true },
  appel: { scene: "personne qui passe un appel téléphonique au bureau", video: true },
  telephone: { scene: "artisan qui répond au téléphone dans son atelier", video: true },
  reunion: { scene: "équipe en réunion dans une salle de bureau", video: true },
  client: { scene: "gérant qui reçoit un client dans son bureau", video: true },
  facture: { scene: "gérant qui saisit des factures papier au bureau", video: false },
  audit: { scene: "consultant qui audite les dossiers d'une PME au bureau", video: true },
  audite: { scene: "consultant qui audite les dossiers d'une PME au bureau", video: true },
  forme: { scene: "formateur qui forme une équipe en salle", video: true },
  formation: { scene: "formateur qui anime une formation en salle", video: true },
  accompagne: { scene: "consultant qui accompagne un dirigeant à son bureau", video: true },
  accompagnement: { scene: "consultant en accompagnement d'un dirigeant au bureau", video: true },
  diagnostic: { scene: "consultant qui fait un diagnostic avec un gérant au bureau", video: true },
  automatise: { scene: "écran d'ordinateur qui automatise des tâches au bureau", video: true },
  automatisation: { scene: "logiciel qui automatise des tâches sur un écran au bureau", video: true },
  structure: { scene: "petite structure artisanale avec son équipe au travail", video: true },
  croissance: { scene: "entreprise en croissance avec des cartons qui arrivent", video: true },
  groupe: { scene: "grand groupe avec ses bureaux et ses salariés", video: true },
  priorite: { scene: "dirigeant qui classe ses priorités sur un tableau", video: true },
  argent: { scene: "billets et pièces comptés sur un bureau", video: true },
  ordinateur: { scene: "personne qui tape sur un ordinateur portable", video: true },
  bureau: { scene: "bureau d'entreprise avec des salariés au travail", video: true },
  atelier: { scene: "artisan qui travaille dans son atelier", video: true },
  chantier: { scene: "ouvriers qui travaillent sur un chantier", video: true },
  tape: { scene: "mains qui tapent sur un clavier au bureau", video: true },
  taper: { scene: "mains qui tapent sur un clavier au bureau", video: true },
  signe: { scene: "dirigeant qui signe un contrat au bureau", video: true },
  signer: { scene: "dirigeant qui signe un contrat au bureau", video: true },
  livre: { scene: "livreur qui livre un colis à une entreprise", video: true },
  livrer: { scene: "livreur qui livre un colis à une entreprise", video: true },
  regarde: { scene: "consultant qui regarde des documents au bureau", video: true },
  reservez: { scene: "personne qui réserve un rendez-vous sur son téléphone", video: true },
  reserver: { scene: "personne qui réserve un rendez-vous sur son téléphone", video: true },
  salarie: { scene: "salariés qui travaillent dans un bureau", video: true },
  semaine: { scene: "agenda de la semaine rempli sur un bureau", video: false },
};

const VERBES_APPEL = new Set(["reservez", "commentez", "ecrivez", "cliquez", "abonnez-vous", "partagez", "telechargez", "contactez", "inscrivez-vous", "prenez", "appelez", "envoyez"]);
const MARQUES_PASSE = new Set(["avant", "autrefois", "abord"]);
const UNITES: Record<string, string> = { minute: " min", minutes: " min", heure: " h", heures: " h", euro: " €", euros: " €", jour: " j", jours: " jours", an: " ans", ans: " ans", pourcent: " %", "%": " %", semaine: " sem", semaines: " sem", mois: " mois" };

/* ---------------- Jetons, phrases, propositions ---------------- */

interface Jeton {
  w: string;
  propre: string;
  /** Minuscules sans accents, sans élision. */
  base: string;
  a: number;
  f: number;
  ponct: string | null;
  contenu: boolean;
  interdit: boolean;
}

/** Forme de recherche d'un mot dans les lexiques (singulier approximatif). */
function cles(j: Pick<Jeton, "base">): string[] {
  const b = j.base;
  return b.endsWith("s") || b.endsWith("x") ? [b, b.slice(0, -1)] : [b];
}
const chercher = <T>(lexique: Record<string, T>, j: Pick<Jeton, "base">): T | undefined => {
  for (const c of cles(j)) if (lexique[c] !== undefined) return lexique[c];
  return undefined;
};

function jetonsDe(mots: readonly MotTranscrit[]): Jeton[] {
  const r: Jeton[] = [];
  for (const m of [...mots].sort((x, y) => x.a - y.a)) {
    const propre = nettoyer(m.w);
    const ponct = ponctuationFinale(m.w);
    if (!propre) {
      // Un signe seul (« ? ») ferme le mot d'avant.
      const d = r[r.length - 1];
      if (d && ponct && (!d.ponct || d.ponct === ",")) d.ponct = ponct;
      continue;
    }
    r.push({ w: m.w, propre, base: simplifier(sansElision(propre)), a: m.a, f: m.f, ponct, contenu: !estMotOutil(m.w), interdit: motsInterditsDans(propre).length > 0 });
  }
  return r;
}

const finDePhrase = (p: string | null) => !!p && ".?!…".includes(p);

function decouperPhrases(jetons: Jeton[]): Jeton[][] {
  const phrases: Jeton[][] = [];
  let cur: Jeton[] = [];
  jetons.forEach((j, k) => {
    cur.push(j);
    const s = jetons[k + 1];
    if (!s || finDePhrase(j.ponct) || s.a - j.f > BLANC_PHRASE_SEC) {
      phrases.push(cur);
      cur = [];
    }
  });
  const r: Jeton[][] = [];
  const recouper = (p: Jeton[]) => {
    if (p.length < 2 || p[p.length - 1].f - p[0].a <= PHRASE_MAX_SEC) {
      r.push(p);
      return;
    }
    const milieu = (p[0].a + p[p.length - 1].f) / 2;
    let coupe = -1;
    for (let k = 0; k < p.length - 1; k++) if (p[k].ponct && (coupe < 0 || Math.abs(p[k].f - milieu) < Math.abs(p[coupe].f - milieu))) coupe = k;
    if (coupe < 0) coupe = p.findIndex((j) => j.a >= milieu) - 1;
    coupe = Math.max(0, Math.min(p.length - 2, coupe));
    recouper(p.slice(0, coupe + 1));
    recouper(p.slice(coupe + 1));
  };
  phrases.forEach(recouper);
  return r;
}

/** Propositions d'une phrase (coupure après « , ; : »). */
function propositions(p: Jeton[]): Jeton[][] {
  const r: Jeton[][] = [];
  let cur: Jeton[] = [];
  p.forEach((j, k) => {
    cur.push(j);
    if ((j.ponct && ",;:".includes(j.ponct)) || k === p.length - 1) {
      r.push(cur);
      cur = [];
    }
  });
  return r;
}

const MOTS_LIAISON_TETE = new Set(["et", "mais", "alors", "or", "donc", "puis", "ou"]);

/** Texte affiché à partir de jetons : sans mot interdit, liaisons de tête retirées, majuscule naturelle. */
function texteDe(js: Jeton[], max: number): string {
  let t = js.filter((j) => !j.interdit);
  while (t.length > 1 && MOTS_LIAISON_TETE.has(t[0].propre.toLowerCase())) t = t.slice(1);
  return tronquer(majuscule(t.map((j) => j.propre).join(" ")), max);
}

/** Coupe à `max` caractères sur une frontière de mot, sans finir sur un mot-outil. */
function tronquer(s: string, max: number): string {
  if (s.length <= max) return s;
  const morceaux = s.split(" ");
  const garde: string[] = [];
  for (const m of morceaux) {
    if ([...garde, m].join(" ").length > max) break;
    garde.push(m);
  }
  while (garde.length > 1 && estMotOutil(garde[garde.length - 1])) garde.pop();
  return garde.length ? garde.join(" ") : s.slice(0, max);
}

function estNegation(js: Jeton[], k: number): boolean {
  const b = simplifier(js[k].propre);
  if (["pas", "jamais", "sans", "aucun", "aucune", "rien"].includes(b)) return true;
  if (b !== "plus") return false;
  return js.slice(Math.max(0, k - 3), k).some((j) => /^n['’]/i.test(j.propre) || simplifier(j.propre) === "ne");
}

const estPasse = (j: Jeton) => MARQUES_PASSE.has(j.base) || (j.base.length >= 5 && /(ait|aient)$/.test(j.base) && j.contenu);

/** Valeur d'un nombre dit par un jeton (chiffres ou lettres), sauf l'article « un / une ». */
function nombreDe(j: Jeton): number | null {
  const chiffres = nombresDansTexte(j.propre);
  if (chiffres.length) return chiffres[0];
  if (j.base === "un" || j.base === "une") return null;
  return valeurEnLettres(j.propre);
}

/* ---------------- Segments et cartes ---------------- */

type Genre = "numerote" | "appel" | "enumeration" | "question" | "negation" | "simple";

interface Item {
  texte: string;
  a: number;
  icone: NomIcone;
  /** Élément de l'énumération ou de la série numérotée (les autres sont des mots ajoutés pour le rythme). */
  principal?: boolean;
  /** Numéro dit (« un, deux, trois »). */
  numero?: number;
}

interface Segment {
  jetons: Jeton[];
  genre: Genre;
  debut: number;
  fin: number;
  items: Item[];
  score: number;
  /** Nombre d'éléments numérotés (liste numérotée). */
  numeros?: number;
}

/** Forme verbale probable (« finissent », « repartez », « regardé ») : jamais un élément de carte ni une étiquette, sauf lexique. */
function estVerbe(j: Pick<Jeton, "base">): boolean {
  if (chercher(SCENES, j) !== undefined || chercher(ICONES_MOTS, j) !== undefined) return false;
  return /(ent|ez|ons|ait|aient|ant|er|ir|re|e|es)$/.test(j.base) ? /(ent|ez|ons|ait|aient|ant|er|ir)$/.test(j.base) && j.base.length > 4 : /(é|ée|és|ées|it|is|u|ue)$/.test(j.base) && j.base.length > 5;
}

/** Le nom le plus concret d'une suite de mots (lexiques d'abord, sinon le mot porteur le plus long) : un élément = une chose. */
function meilleurNom(js: readonly Jeton[]): Jeton | undefined {
  const utiles = js.filter((j) => j.contenu && !j.interdit && !TETES_TITRE_ABSTRAIT.includes(j.base) && nombreDe(j) === null);
  return utiles.find((j) => chercher(SCENES, j) !== undefined || chercher(ICONES_MOTS, j) !== undefined) ?? [...utiles].sort((x, y) => Number(estVerbe(x)) - Number(estVerbe(y)) || y.propre.length - x.propre.length)[0];
}

function iconePour(j: Jeton | undefined, k: number): NomIcone {
  return (j && chercher(ICONES_MOTS, j)) ?? ICONES_DE_SECOURS[k % ICONES_DE_SECOURS.length];
}

/** Ajoute des mots dans les trous de plus de 1,9 s entre sous-éléments (une carte ne reste jamais immobile). */
function completerEspacement(items: Item[], candidats: Jeton[], debut: number, fin: number, cap: number): Item[] {
  const r = [...items].sort((x, y) => x.a - y.a);
  for (let garde = 0; garde < 20 && r.length < cap; garde++) {
    const points = [debut, ...r.map((x) => x.a), fin];
    let meilleur: { j: Jeton; trou: number } | null = null;
    for (let k = 1; k < points.length; k++) {
      const trou = points[k] - points[k - 1];
      if (trou <= ECART_SOUS_ELEMENTS_SEC) continue;
      const milieu = (points[k] + points[k - 1]) / 2;
      const tous = candidats.filter((j) => j.a > points[k - 1] + 0.2 && j.a < points[k] - 0.2 && !r.some((x) => Math.abs(x.a - j.a) < 0.01));
      // Des noms d'abord (une carte montre des choses), un verbe seulement s'il n'y a rien d'autre.
      const dedans = tous.some((j) => !estVerbe(j)) ? tous.filter((j) => !estVerbe(j)) : tous;
      if (!dedans.length) continue;
      const j = dedans.reduce((x, y) => (Math.abs(y.a - milieu) < Math.abs(x.a - milieu) ? y : x));
      if (!meilleur || trou > meilleur.trou) meilleur = { j, trou };
    }
    if (!meilleur) break;
    r.push({ texte: texteDe([meilleur.j], 40), a: meilleur.j.a, icone: iconePour(meilleur.j, r.length) });
    r.sort((x, y) => x.a - y.a);
  }
  return r;
}

function segmentDe(jetons: Jeton[], genre: Genre, finDebut: number, numeros?: { valeur: number; k: number }[]): Segment {
  const debut = jetons[0].a;
  const fin = Math.min(jetons[jetons.length - 1].f, finDebut);
  const props = propositions(jetons);
  const utiles = jetons.filter((j) => j.contenu && !j.interdit);
  let items: Item[] = [];
  if (genre === "numerote" && numeros) {
    numeros.forEach((n, i) => {
      const suite = jetons.slice(n.k + 1, numeros[i + 1]?.k ?? jetons.length);
      const nom = meilleurNom(suite);
      if (!nom) return;
      // L'étape arrive sur le numéro dit ; son texte est LA chose nommée dans le point qui suit (jamais la phrase).
      items.push({ texte: texteDe([nom], 40), a: jetons[n.k].a, icone: iconePour(nom, i), principal: true, numero: n.valeur });
    });
  } else if (genre === "enumeration") {
    props.forEach((p, i) => {
      const nom = meilleurNom(p);
      if (nom) items.push({ texte: texteDe([nom], 40), a: nom.a, icone: iconePour(nom, i), principal: true });
    });
  } else if (genre === "appel") {
    items = jetons.filter((j) => !j.interdit).map((j, i) => ({ texte: texteDe([j], 40), a: j.a, icone: iconePour(j, i) }));
  } else {
    items = utiles.map((j, i) => ({ texte: texteDe([j], 40), a: j.a, icone: iconePour(j, i) }));
  }
  const duree = fin - debut;
  const base = { numerote: 90, appel: 85, enumeration: 60 + props.length, question: 25, negation: 30, simple: 10 }[genre];
  return { jetons, genre, debut, fin, items, score: base + Math.min(duree, 9), numeros: numeros?.length };
}

/** Repère les séries « un, deux, trois » / « premier, deuxième… » dites en tête de phrase. */
function seriesNumerotees(jetons: Jeton[]): { debut: number; positions: { valeur: number; index: number }[] }[] {
  const tetes = jetons
    .map((j, index) => ({ j, index, valeur: nombreDe(j) ?? (j.base === "un" || j.base === "une" ? 1 : null) }))
    .filter(({ j, index, valeur }) => valeur !== null && !!j.ponct && ",:.".includes(j.ponct) && (index === 0 || finDePhrase(jetons[index - 1].ponct) || jetons[index - 1].ponct === ":"));
  const series: { debut: number; positions: { valeur: number; index: number }[] }[] = [];
  for (let s = 0; s < tetes.length; s++) {
    if (tetes[s].valeur !== 1) continue;
    const pos = [{ valeur: 1, index: tetes[s].index }];
    for (let k = s + 1; k < tetes.length && tetes[k].valeur === pos.length + 1 && tetes[k].j.a - tetes[s].j.a < 25; k++) pos.push({ valeur: tetes[k].valeur!, index: tetes[k].index });
    if (pos.length >= 2) {
      series.push({ debut: tetes[s].j.a, positions: pos });
      s += pos.length - 1;
    }
  }
  return series;
}

function genreDe(js: Jeton[], finDebut: number): Genre {
  const props = propositions(js).filter((p) => p.some((j) => j.contenu && !j.interdit));
  if (js.some((j) => VERBES_APPEL.has(simplifier(j.propre))) && js[0].a >= 0.6 * finDebut) return "appel";
  if (props.length >= 3) return "enumeration";
  if (js[js.length - 1].ponct === "?") return "question";
  if (js.some((_, k) => estNegation(js, k))) return "negation";
  return "simple";
}

function segmentsDe(jetons: Jeton[], finDebut: number): Segment[] {
  const phrases = decouperPhrases(jetons);
  const indexDe = new Map(jetons.map((j, i) => [j, i] as const));
  const series = seriesNumerotees(jetons);
  const segments: Segment[] = [];
  let k = 0;
  for (const serie of series) {
    const premier = serie.positions[0].index;
    const dernier = serie.positions[serie.positions.length - 1].index;
    // Phrases avant la série.
    while (k < phrases.length && indexDe.get(phrases[k][phrases[k].length - 1])! < premier) {
      segments.push(segmentDe(phrases[k], genreDe(phrases[k], finDebut), finDebut));
      k++;
    }
    const avant = k < phrases.length ? phrases[k].filter((j) => indexDe.get(j)! < premier) : [];
    if (avant.length) segments.push(segmentDe(avant, genreDe(avant, finDebut), finDebut));
    // La série va jusqu'au bout de la phrase qui contient le dernier numéro.
    while (k < phrases.length && indexDe.get(phrases[k][phrases[k].length - 1])! < dernier) k++;
    const finSerie = k < phrases.length ? indexDe.get(phrases[k][phrases[k].length - 1])! : jetons.length - 1;
    k++;
    const bloc = jetons.slice(premier, finSerie + 1);
    segments.push(segmentDe(bloc, "numerote", finDebut, serie.positions.map((p) => ({ valeur: p.valeur, k: p.index - premier }))));
  }
  for (; k < phrases.length; k++) segments.push(segmentDe(phrases[k], genreDe(phrases[k], finDebut), finDebut));
  return segments.filter((s) => s.debut < finDebut - 0.5);
}

/** Titre d'une carte : le NOM de la chose montrée (« Devis », « Diagnostic »), « n questions » pour une série numérotée. */
function titreDe(s: Segment, debut: number, fin: number): string {
  if (s.genre === "numerote") return `${s.numeros} ${propositions(s.jetons).filter((p) => p[p.length - 1].ponct === "?").length >= 2 ? "questions" : "points"}`;
  if (s.genre === "appel") return "Commentaires";
  const dedans = s.jetons.filter((j) => j.a >= debut - 0.3 && j.a <= fin);
  const nom = meilleurNom(dedans.length ? dedans : s.jetons);
  return nom ? tronquer(majuscule(nom.propre), 32) : "Vos notes";
}

/** Les mots EXACTS dits sur [a, z] (≤ 60 caractères, coupés sur un mot) : le champ « illustre » d'un objet. */
function illustreDe(jetons: readonly Jeton[], a: number, z: number): string {
  const dits = jetons.filter((j) => j.a >= a - 1e-6 && j.a <= z + 1e-6 && !j.interdit).map((j) => j.propre);
  return tronquer(dits.join(" "), 60);
}

/** Sous-ensemble régulièrement réparti de `n` éléments. */
function repartir<T>(xs: T[], n: number): T[] {
  if (xs.length <= n) return xs;
  if (n <= 1) return xs.slice(0, 1);
  const idx = new Set<number>();
  for (let k = 0; k < n; k++) idx.add(Math.round((k * (xs.length - 1)) / (n - 1)));
  return [...idx].sort((x, y) => x - y).map((i) => xs[i]);
}

function contenuCarte(type: TypeCarte, s: Segment, items: Item[], jetonsCarte: Jeton[], fin: number, motCle: string): ContenuCarte | null {
  const cap = CAPACITE[type];
  const pris = repartir(items, cap);
  if (pris.length < 2) return null;
  const dernier = pris[pris.length - 1].a;
  const apres = (t: number) => jetonsCarte.find((j) => j.a >= t + 0.4 && j.a <= fin - 0.25 && !pris.some((x) => Math.abs(x.a - j.a) < 0.01));
  switch (type) {
    case "liste": {
      const coche = apres(dernier);
      return { type, lignes: pris.map((x) => ({ texte: tronquer(x.numero ? `${x.numero}. ${x.texte}` : x.texte, 32), icone: x.icone, a: x.a })), ...(coche ? { cocheA: coche.a } : {}) };
    }
    case "frise": {
      // Les éléments de l'énumération sont les étapes ; les mots ajoutés pour le rythme deviennent des puces (niveau 3).
      const principaux = items.filter((x) => x.principal).slice(0, 5);
      if (principaux.length >= 2) {
        // Une puce au plus par étape (deux débordent de la carte) : celle du milieu de l'étape.
        const candidates = items.filter((x) => !x.principal && x.a > principaux[0].a && x.a <= principaux[principaux.length - 1].a + 2.5);
        const etapeDe = (x: Item) => Math.max(0, principaux.filter((p) => p.a <= x.a).length - 1);
        const autres = principaux
          .map((p, k) => {
            const fin = principaux[k + 1]?.a ?? p.a + 2.5;
            const dans = candidates.filter((x) => etapeDe(x) === k);
            return dans.sort((x, y) => Math.abs(x.a - (p.a + fin) / 2) - Math.abs(y.a - (p.a + fin) / 2))[0];
          })
          .filter((x): x is Item => !!x);
        const coche = apres(Math.max(...[...principaux, ...autres].map((x) => x.a)));
        return {
          type,
          etapes: principaux.map((x) => ({ texte: tronquer(x.texte, 28), icone: x.icone, a: x.a })),
          ...(autres.length ? { puces: autres.map((x) => ({ etape: Math.max(0, principaux.filter((p) => p.a <= x.a).length - 1), texte: tronquer(x.texte, 18), a: x.a })) } : {}),
          ...(coche ? { cocheA: coche.a } : {}),
        };
      }
      const coche = apres(dernier);
      return { type, etapes: repartir(pris, 5).map((x) => ({ texte: tronquer(x.texte, 22), icone: x.icone, a: x.a })), ...(coche ? { cocheA: coche.a } : {}) };
    }
    case "grille":
      return {
        type,
        colonnes: pris.length <= 4 ? 2 : 3,
        vignettes: pris.map((x, k) => {
          const legende = tronquer(x.texte, 18);
          const genre = k % 4;
          // Littéralité (passe 3) : « ecran » et « image » seulement pour un écran ou une image DITS ; sinon la fiche
          // porte l'icône de la chose (jamais un pictogramme générique).
          const dit = (re: RegExp) => motsSimples(legende).some((w) => re.test(w));
          const contenu =
            genre === 1 && dit(LEGENDES_ECRAN) ? { type: "ecran" as const, barres: 3 } : genre === 3 && legende.length <= 12 ? { type: "texte" as const, titre: legende } : genre === 0 && dit(LEGENDES_IMAGE) ? { type: "image" as const } : { type: "fiche" as const, lignes: 3, icone: x.icone };
          return { a: x.a, legende, contenu };
        }),
      };
    case "calendrier":
      return {
        type,
        jours: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
        rangees: pris.length > 5 ? 2 : 1,
        pastilles: pris.map((x, k) => ({ jour: k % 5, rangee: Math.floor(k / 5), icone: x.icone, a: x.a, ...(k === pris.length - 1 ? { accent: true } : {}) })),
      };
    case "graphique":
      return {
        type,
        baseA: pris[0].a,
        barres: pris.map((x, k) => {
          const libelle = x.texte.length <= 10 ? x.texte : undefined;
          return { hauteur: Math.round((0.35 + (0.6 * (k + 1)) / pris.length) * 100) / 100, a: x.a, ...(libelle ? { libelle } : {}), ...(k === pris.length - 1 ? { accent: true } : {}) };
        }),
        mention: "Illustration",
      };
    case "statuts": {
      const fin2 = apres(dernier);
      return {
        type,
        avant: { texte: "À faire" },
        apres: { texte: "Fait", icone: "coche" },
        lignes: pris.map((x, k) => {
          const bascule = k < pris.length - 1 ? pris[k + 1].a : fin2?.a;
          return { nom: tronquer(x.texte, 24), a: x.a, ...(bascule !== undefined ? { bascule } : {}) };
        }),
      };
    }
    case "chat": {
      if (pris.length < 3) return null;
      const premiere = propositions(s.jetons)[0];
      return {
        type,
        indication: "Votre question…",
        message: { texte: texteDe(premiere, 40) || pris[0].texte, a: pris[0].a },
        reponse: { a: pris[1].a, lignes: 2, icone: "etincelles" },
        puces: pris.slice(1, 5).map((x) => ({ texte: tronquer(x.texte, 20), icone: x.icone, a: x.a })),
      };
    }
    case "commentaire": {
      if (items.length < 4) return null;
      const [x0, x1, x2, x3, x4] = items;
      return {
        type,
        champ: { indication: "Votre commentaire…", a: x0.a },
        saisie: { texte: (motCle || x1.texte).slice(0, 16), debut: x1.a, fin: Math.min(x1.a + 0.8, (x2.a + x1.a) / 2 + 0.2, fin - 0.1) },
        bouton: { texte: "Publier", a: x2.a },
        commentaire: { auteur: "Vous", a: x3.a },
        ...(x4 && x4.a <= fin - 0.2 ? { notification: { titre: "Nouveau message", texte: "Votre lien de réservation", a: x4.a } } : {}),
      };
    }
    default:
      return null;
  }
}

/* ---------------- Le réalisateur ---------------- */

/**
 * CARTE JAMAIS IMMOBILE (revue passe 2 du 15/10 : 0,8 s au plus entre deux sous-éléments). Dans la parole, deux noms
 * sont souvent à 0,8-1 s l'un de l'autre : les mots ajoutés (`completerEspacement`) ne suffisent pas. Chaque écart de
 * plus de `ECART_CARTE_MAX_SEC` est comblé par un ÉVÉNEMENT SANS TEXTE de la carte, ancré sur le début d'un mot dit
 * dans l'écart (n'importe lequel) : pastille de plus (calendrier, icône de la dernière chose dite), barre sans libellé
 * (graphique), bascule d'une ligne (statuts), icône d'une fiche qui rebondit (grille), cases cochées (liste, frise),
 * « j'aime » du commentaire publié (commentaire).
 * Rien n'est inventé : aucun texte ni chiffre n'est ajouté.
 */
function rythmerContenu(c: ContenuCarte, jetonsCarte: readonly Jeton[], debut: number, fin: number): ContenuCarte {
  const instantsDe = (x: ContenuCarte) =>
    objetsDuPlan({ cartes: [{ debut, fin, titre: "x", icone: "etoile", entree: "chute", contenu: x }], fenetres: [], calques: [] })[0]
      .sous.filter((s) => s.ancre)
      .map((s) => s.a)
      .sort((a, b) => a - b);
  let r: ContenuCarte = JSON.parse(JSON.stringify(c));
  for (let garde = 0; garde < 24; garde++) {
    const pts = instantsDe(r);
    const k = pts.findIndex((t, i) => i > 0 && t - pts[i - 1] > ECART_CARTE_MAX_SEC);
    if (k <= 0) break;
    const [a, z] = [pts[k - 1], pts[k]];
    const milieu = (a + z) / 2;
    // Instants possibles : le début d'un mot, ou 0,13 s autour (dans la tolérance d'ancrage de 0,15 s) — pendant un blanc
    // de la parole de 0,8 s, l'événement se pose juste après le dernier mot dit.
    const possibles = jetonsCarte
      .flatMap((x) => [x.a, x.a + 0.13, x.a - 0.13])
      .map((t) => Math.round(t * 1000) / 1000)
      .filter((t) => t > a + 0.1 && t < z - 0.1 && t < fin - 0.15)
      .sort((x, y) => Math.abs(x - milieu) - Math.abs(y - milieu));
    if (!possibles.length) break;
    const j = { a: possibles[0] };
    const avant = r;
    switch (r.type) {
      case "calendrier": {
        const n = r.pastilles.length;
        if (n >= 10) break;
        const prec = [...r.pastilles].filter((x) => x.a <= a + 1e-6).sort((x, y) => x.a - y.a).pop();
        const jours = r.jours.length;
        const rangees = Math.max(r.rangees, Math.ceil((n + 1) / jours));
        if (rangees > 2) break;
        const pastilles = [...r.pastilles.map(({ icone, a: t }) => ({ icone, a: t })), { icone: prec?.icone ?? "etoile", a: j.a }]
          .sort((x, y) => x.a - y.a)
          .map((x, i, all) => ({ ...x, jour: i % jours, rangee: Math.floor(i / jours), ...(i === all.length - 1 ? { accent: true } : {}) }));
        r = { ...r, rangees, pastilles };
        break;
      }
      case "graphique": {
        if (r.barres.length >= 7) break;
        const barres = [...r.barres, { hauteur: 0.5, a: j.a }].sort((x, y) => x.a - y.a);
        r = { ...r, barres: barres.map((b, i) => ({ ...b, hauteur: Math.round((0.35 + (0.6 * (i + 1)) / barres.length) * 100) / 100, accent: i === barres.length - 1 ? true : undefined })).map(({ accent, ...b }) => (accent ? { ...b, accent } : b)) };
        break;
      }
      case "statuts": {
        // La ligne arrivée juste avant l'écart bascule DANS l'écart (au lieu de basculer avec l'arrivée de la suivante).
        const i = r.lignes.findIndex((l, q) => l.a <= a + 1e-6 && (r.type === "statuts" && (q === r.lignes.length - 1 || r.lignes[q + 1].a >= z - 1e-6)));
        if (i < 0) break;
        const l = r.lignes[i];
        if (l.bascule !== undefined && l.bascule > a + 1e-6 && l.bascule < z - 1e-6) break;
        r = { ...r, lignes: r.lignes.map((x, q) => (q === i ? { ...x, bascule: j.a } : x)) };
        break;
      }
      case "grille": {
        const i = r.vignettes.map((v, q) => ({ v, q })).filter(({ v }) => v.a <= a + 1e-6 && v.contenu.type === "fiche" && !!v.contenu.icone).sort((x, y) => y.v.a - x.v.a)[0]?.q;
        if (i === undefined) break;
        const v = r.vignettes[i];
        if (v.contenu.type !== "fiche" || (v.contenu.iconeA !== undefined && v.contenu.iconeA > a + 1e-6)) break;
        r = { ...r, vignettes: r.vignettes.map((x, q) => (q === i && x.contenu.type === "fiche" ? { ...x, contenu: { ...x.contenu, iconeA: j.a } } : x)) };
        break;
      }
      case "commentaire": {
        // Le commentaire publié reçoit son « j'aime » dans l'écart.
        if (r.commentaire.jaimeA !== undefined || r.commentaire.a > a + 1e-6) break;
        r = { ...r, commentaire: { ...r.commentaire, jaimeA: j.a } };
        break;
      }
      case "liste":
      case "frise": {
        // Les cases se cochent dans l'écart, une fois tout montré.
        const derniers = r.type === "liste" ? r.lignes.map((x) => x.a) : r.etapes.map((x) => x.a);
        if (r.cocheA !== undefined || Math.max(...derniers) > a + 1e-6) break;
        r = { ...r, cocheA: j.a };
        break;
      }
    }
    if (r === avant) break;
  }
  return r;
}

/* ---------------- Cartes : construction ---------------- */

/**
 * Une carte d'un type sur [debut, fin] : jamais vide (elle entre 0,05 s avant son premier sous-élément) ni immobile
 * (au-delà de 0,7 s sans sous-élément, elle sort plus tôt), littérale (recopie ≤ 50 %, un de ses mots dit juste avant
 * son entrée). Null si elle ne tient pas (durée, 3 sous-éléments).
 */
function construireCarte(jetons: Jeton[], mots: readonly MotTranscrit[], s: Segment, type: TypeCarte, debut0: number, fin0: number, motCle: string, entree: CartePlan["entree"]): { carte: CartePlan; items: Item[] } | null {
  let [debut, fin] = [debut0, fin0];
  for (let garde = 0; garde < 16; garde++) {
    if (fin - debut < CARTE_MIN_SEC) return null;
    const jetonsCarte = jetons.filter((j) => j.a >= debut && j.a <= fin - 0.1);
    const candidatsMots = jetonsCarte.filter((j) => j.contenu && !j.interdit);
    let items = s.items.filter((x) => x.a >= debut && x.a <= fin - 0.1);
    if (type !== "commentaire") items = completerEspacement(items, candidatsMots, debut, fin, CAPACITE[type]);
    const contenu0 = contenuCarte(type, s, items, jetonsCarte, fin, motCle);
    if (!contenu0) return null;
    const contenu = rythmerContenu(contenu0, jetonsCarte, debut, fin);
    const illustre = illustreDe(jetons, debut, fin);
    const carte: CartePlan = { debut: arrondi(debut), fin: arrondi(fin), titre: titreDe(s, debut, fin), ...(illustre ? { illustre } : {}), icone: s.items[0]?.icone ?? "etincelles", entree, contenu };
    const instants = objetsDuPlan({ cartes: [carte], fenetres: [], calques: [] })[0].sous.filter((x) => x.ancre).map((x) => x.a).sort((x, y) => x - y);
    if (instants.length < 3) return null;
    if (instants[0] > debut + Math.min(CARTE_VIDE_VISEE_SEC, SEUILS.carteVideMaxSec - 0.05)) {
      debut = Math.max(debut, instants[0] - 0.05);
      continue;
    }
    const k = instants.findIndex((t, i) => i > 0 && t - instants[i - 1] > ECART_CARTE_MAX_SEC);
    if (k > 0) {
      fin = Math.min(fin, instants[k - 1] + TENUE_APRES_DERNIER_SEC, instants[k] - 0.15);
      continue;
    }
    const dernier = instants[instants.length - 1];
    if (fin > dernier + TENUE_FIN_CARTE_SEC + 1e-6 && dernier + TENUE_FIN_CARTE_SEC - debut >= CARTE_MIN_SEC) {
      fin = dernier + TENUE_FIN_CARTE_SEC;
      continue;
    }
    if (!schemaCarte.safeParse(carte).success) return null;
    const copie = copieCarte(carte, mots);
    if (copie && copie.part > SEUILS.copieSousTitresMax) return null;
    if (!motCleAvantEntree(carte, mots)) return null;
    return { carte, items };
  }
  return null;
}

/* ---------------- Lexiques des familles « motion » (formes simplifiées, sans accents) ---------------- */

const MOTS_TEMPS = /^(temps|heures?|minutes?|soirs?|soirees?|journees?|jours?|semaines?|mois|week-end|weekend|tard|nuits?|apres-midi|vendredis?|samedis?|dimanches?|lundis?|delais?|horaires?)$/;
const UNITES_TEMPS: Record<string, string> = { minute: "min", minutes: "min", heure: "h", heures: "h", jour: "j", jours: "j", semaine: "sem", semaines: "sem", mois: "mois", seconde: "s", secondes: "s" };
const MOTS_TELEPHONE: Record<string, "mail" | "message" | "agenda" | "visio" | "notification" | "lien"> = {
  mail: "mail", mails: "mail", email: "mail", "e-mail": "mail", "e-mails": "mail", relance: "mail", relances: "mail", courriel: "mail",
  message: "message", messages: "message", sms: "message", commentaire: "message", commentaires: "message", commentez: "message",
  "rendez-vous": "agenda", reservez: "agenda", reserver: "agenda", reservation: "agenda", agenda: "agenda",
  visio: "visio", lien: "lien", liens: "lien", appel: "notification", appels: "notification", telephone: "notification", appelez: "notification",
};
const MOTS_FRANCE_FORTS = /^(france|partout|distance|territoire|regions?|nationale?s?|visio)$/;
const MOTS_FRANCE_FAIBLES = /^(entreprises?|structures?|groupes?|dirigeants?|pme|tpe|clients?|equipes?|votre|vos)$/;
const MOTS_TACHES = /^(devis|relances?|factures?|appels?|mails?|e-mails?|messages?|chiffres?|dossiers?|administratif|commandes?|rendez-vous|recrutements?|embauches?|outils?|tableurs?|plannings?|reunions?|soirees?)$/;
const MOTS_JAUGE = /^(charges?|trop|niveaux?|urgen\w*|priorit\w*|pleine?s?|beaucoup|normale?s?|debord\w*|claires?|classees?|surcharg\w*|limites?|maximum|enormes?|vraie|bonne|complet|plus|moins|tout|toute|tous|vraiment|encore|toujours)$/;
const MOTS_CHOC = /^(fuite|stop|gratuit|miracle|diagnostic|probleme|jamais|rien|perte|automatise|avance|bruit|reflexe|priorites)$/;
const MARQUES_OPPOSITION = /^(mais|sans|pas|plutot|lieu|avant|apres|contre)$/;
const MARQUES_PARTIE = /^(chez|alors|prenez|donc|bref|concretement|ensuite|reservez|voici|si|le|un)$/;
const INTERROGATIFS = /^(pourquoi|comment|combien|quoi|qu'est-ce|quel|quelle|quels|quelles)$/;

/* ---------------- Le réalisateur par familles (règles R1 à R7 du directeur artistique, 15/10) ---------------- */

/** Durée d'une apparition : 0,9 à 2,5 s (une nouvelle entrée toutes les 3 s au plus, R5d). */
const APPARITION_MAX_SEC = 2.3;
/** Écart entre la sortie d'un objet et l'entrée du suivant (deux pics distincts pour la mesure). */
const ECART_OBJETS_SEC = 0.1;
/** Un objet peut entrer jusqu'à 0,45 s après la sortie du précédent (il se cale sur son mot). */
const RETARD_ENTREE_MAX_SEC = 0.45;
/** Variantes essayées (graine de rotation) : la première sans erreur est gardée. */
const VARIANTES = 5;

interface Pose {
  famille: Famille;
  debut: number;
  fin: number;
  /** Force du déclencheur (le mot qui appelle cette famille) : 0 (rien de particulier) à 3 (exactement son cas). */
  force: number;
  carte?: CartePlan;
  fenetre?: FenetrePlan;
  calque?: CalquePlan;
  motion?: MotionPlan;
  motsForts: string[];
  /** Type de carte (R4c). */
  typeCarte?: TypeCarte;
}

/** Une apparition posée (pour les contrôles en cours de route). */
interface Posee {
  famille: Famille;
  debut: number;
  fin: number;
  couvre: boolean;
  pousse: boolean;
  plein: boolean;
  place: string;
  entree: string;
}

const hashFamille = (f: string) => [...f].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7);

export function realiserParRegles(e: EntreeReglesFixes): MiseEnScene {
  const jetons = jetonsDe(e.mots);
  const horizon = Math.min(e.finDebut, e.dureeSec);
  if (!jetons.length) return { cartes: [], fenetres: [], calques: [], motions: [], zooms: [], mouvements: [], motsForts: [] };
  const segments = segmentsDe(jetons, horizon);
  const decalage = (e.historique?.length ?? 0) * 2;
  // Plusieurs variantes rapides ; la meilleure est reprise en profondeur (défauts restants traités un à un).
  let meilleure: { scene: MiseEnScene; erreurs: number; variante: number } | null = null;
  for (let variante = 0; variante < VARIANTES; variante++) {
    const scene = planifier(e, jetons, segments, horizon, decalage + variante, false);
    // Les trous se réparent ensuite : la variante est jugée sur le reste (diversité, ordre, nombres d'objets).
    const erreurs = erreursDuPlan(e, scene, horizon).filter((x) => !/^(Trou de|Énergie)/.test(x)).length;
    if (!meilleure || erreurs < meilleure.erreurs) meilleure = { scene, erreurs, variante: decalage + variante };
    if (!erreurs) break;
  }
  const reprise = planifier(e, jetons, segments, horizon, meilleure!.variante, true);
  return reprise;
}

/** Le plan tel qu'il sera assemblé (sous-titres, bruitages, écran de fin), pour le contrôle complet. */
function planProvisoire(e: EntreeReglesFixes, scene: MiseEnScene, horizon: number, groupes?: PlanFacecamAnimee["groupes"]): PlanFacecamAnimee {
  const fin = { debut: horizon, marque: "Axion-IA", adresse: "axion-ia.com", motCle: e.motCle ?? "DIAGNOSTIC", tuiles: ["loupe", "eclair", "former", "boussole"] };
  const base = { cartes: scene.cartes, fenetres: scene.fenetres, calques: scene.calques, zooms: [] as [number, number, number][], ...(scene.motions.length ? { motions: scene.motions } : {}), fin };
  return {
    version: VERSION_PLAN_FACECAM_ANIMEE,
    charte: "interface-claire/1",
    duree: e.dureeSec,
    fps: 25,
    largeur: 1080,
    hauteur: 1920,
    prise: { src: "prise.mp4", finSec: e.dureeSec, ...(e.prise?.yeux !== undefined ? { yeux: e.prise.yeux } : {}) },
    groupes: groupes ?? groupesSousTitres(e.mots, { motsForts: scene.motsForts }),
    ...base,
    sons: bruitagesDuPlan(base),
  };
}

const erreursDuPlan = (e: EntreeReglesFixes, scene: MiseEnScene, horizon: number) => verifierPlan(planProvisoire(e, scene, horizon), e.mots, { historique: e.historique }).erreurs;

/**
 * UNE mise en scène : les apparitions sont posées de gauche à droite, une toutes les 2 s environ, chacune dans la famille
 * la mieux appelée par les mots dits à cet instant, parmi celles que les règles R1 à R7 permettent (ouverture sur le visage
 * entier, temps de visage, jamais deux fois la même famille de suite, plafonds, variété, historique). Ensuite, les trous
 * (> 0,7 s sans changement visible) sont réparés en déplaçant les bords des objets ou en ajoutant un élément sur un mot.
 */
function planifier(e: EntreeReglesFixes, jetons: Jeton[], segments: Segment[], horizon: number, variante: number, profond: boolean): MiseEnScene {
  const D = DIVERSITE;
  const posees: Posee[] = [];
  const poses: Pose[] = [];
  const comptes = new Map<Famille, number>();
  const typesCartes = new Set<TypeCarte>();
  const scenesPrises = new Set<string>();
  const precedente = e.historique?.[0];
  const premieresInterdites = new Set((e.historique ?? []).slice(0, D.premiereFamilleVideos).map((h) => h.familles?.[0]).filter((x): x is string => !!x));
  const couplesAnciens = new Set(
    (e.historique ?? []).slice(0, D.premiereFamilleVideos).flatMap((h) => {
      const fs = (h.familles ?? []).filter((_, i) => (h.debutsFamilles?.[i] ?? 0) < D.couplesDebutSec);
      return fs.slice(1).map((f, k) => `${fs[k]} → ${f}`);
    }),
  );
  const absentesAvant = new Set(FAMILLES.filter((f) => precedente?.familles && !precedente.familles.includes(f)));

  const topAvant = (() => {
    const c = precedente?.comptesFamilles;
    if (!c) return null;
    const max = Math.max(0, ...Object.values(c));
    return Object.keys(c).find((k) => c[k] === max) ?? null;
  })();
  const nEstime = Math.max(5, Math.round(horizon / 2.15));
  const plafond20 = Math.max(1, Math.floor(D.partFamilleMax * nEstime + 1e-9));
  const plafond = (f: Famille) => plafondFamille(f, e.dureeSec, precedente);
  const nb = (f: Famille) => comptes.get(f) ?? 0;
  /** Longs blancs de la parole (≥ 2,5 s) : une mini-vidéo leur est gardée (rien d'autre ne bouge en continu sans mots). */
  // Fin « utile » d'un mot : 0,8 s au plus après son début (un mot étiré par la transcription n'occupe pas l'image).
  const finMot = (j: Jeton) => Math.min(j.f, j.a + 0.8);
  const longsBlancs = jetons.slice(1).filter((j, k) => j.a - finMot(jetons[k]) >= 2.5 && jetons[k].a < horizon - 1).map((j) => finMot(jetons[jetons.indexOf(j) - 1]));

  /* ---- Mots ---- */
  /** Premier indice dont le début est ≥ x (les jetons sont triés). */
  const indice = (x: number) => {
    let [g, d] = [0, jetons.length];
    while (g < d) {
      const m = (g + d) >> 1;
      if (jetons[m].a < x) g = m + 1;
      else d = m;
    }
    return g;
  };
  const motsEntre = (a: number, z: number) => jetons.slice(indice(a - 1e-6), indice(z + 2e-6));
  const porteursEntre = (a: number, z: number) => motsEntre(a, z).filter((j) => j.contenu && !j.interdit && nombreDe(j) === null && j.base.length >= 3);
  const nomsEntre = (a: number, z: number) => porteursEntre(a, z).filter((j) => !estVerbe(j) && !TETES_TITRE_ABSTRAIT.includes(j.base));
  /** Instants de sous-éléments : les mots donnés, puis des débuts de mots (± 0,13 s) dans les écarts de plus de 0,6 s. */
  const rythmer = (instants: number[], debut: number, fin: number): number[] => {
    const r = [...new Set(instants.map((t) => arrondi(t)))].filter((t) => t >= debut - 1e-6 && t <= fin - 0.1).sort((x, y) => x - y);
    for (let garde = 0; garde < 12; garde++) {
      const pts = [debut, ...r, fin];
      const k = pts.findIndex((t, i) => i > 0 && t - pts[i - 1] > 0.6);
      if (k <= 0) break;
      const [a, z] = [pts[k - 1], pts[k]];
      const milieu = (a + z) / 2;
      const possibles = motsEntre(a, z).flatMap((j) => [j.a, j.a + 0.13, j.a - 0.13]).map((t) => arrondi(t)).filter((t) => t > a + 0.25 && t < z - 0.25 && t >= debut && t <= fin - 0.1).sort((x, y) => Math.abs(x - milieu) - Math.abs(y - milieu));
      if (!possibles.length) break;
      r.push(possibles[0]);
      r.sort((x, y) => x - y);
    }
    return r;
  };
  /** Fin d'un objet : 0,45 s après son dernier sous-élément, entre `min` et `max` après le début. */
  const finApres = (debut: number, instants: number[], limite: number, min = 1, max = APPARITION_MAX_SEC) => {
    // Un objet immobile entre deux éléments ne traverse pas un blanc : il sort avant (son dernier élément avant l'écart).
    const tries = [...instants].sort((x, y) => x - y);
    const k = tries.findIndex((x, i) => i > 0 && x - tries[i - 1] > 0.75);
    const dernier = (k > 0 ? tries[k - 1] : tries[tries.length - 1]) ?? debut;
    return arrondi(Math.min(limite, debut + max, Math.max(debut + min, dernier + 0.35)));
  };
  /** Les candidats pris À LA SUITE (chacun 0,25 à 0,75 s après le précédent, le premier 0,7 s au plus après `debut`) : un élément toutes les 0,75 s au plus, jamais de trou dans la motion. */
  const chaine = (cands: readonly Jeton[], debut: number, max: number) => {
    const r: Jeton[] = [];
    for (const j of [...cands].sort((x, y) => x.a - y.a)) {
      if (r.length >= max) break;
      if (!r.length) {
        if (j.a >= debut - 1e-6 && j.a <= debut + 0.7) r.push(j);
        continue;
      }
      const e = j.a - r[r.length - 1].a;
      if (e < 0.25) continue;
      if (e > 0.75) break;
      r.push(j);
    }
    return r;
  };
  /** Plus long blanc de la parole (entre deux débuts de mots) qui touche [a, z]. */
  const blancDans = (a: number, z: number) => {
    const debuts = [a, ...jetons.filter((j) => j.a > a && j.a < z).map((j) => j.a), z];
    const avant = jetons.filter((j) => j.a <= a).pop();
    const apres = jetons.find((j) => j.a >= z);
    if (avant) debuts[0] = Math.max(a, Math.min(avant.f, avant.a + 0.8));
    let m = 0;
    for (let k = 1; k < debuts.length; k++) m = Math.max(m, debuts[k] - debuts[k - 1]);
    return apres ? m : Math.max(m, z - debuts[debuts.length - 2]);
  };
  const illustre = (a: number, z: number) => illustreDe(jetons, a, z);

  /* ---- Les constructeurs, un par famille : la pose sur [t, …], ou null ---- */
  const construire: Record<Famille, (t: number, limite: number) => Pose | null> = {
    etiquette: (t, limite) => {
      // Le mot affiché peut venir d'être dit (0,6 s avant) : l'étiquette le reprend juste après.
      const fenetre = [...motsEntre(t, t + 0.9), ...motsEntre(t - 0.6, t - 0.01).reverse()].filter((j) => j.contenu && !j.interdit && nombreDe(j) === null);
      const nombre = motsEntre(t, t + 0.6).find((j) => (nombreDe(j) ?? 0) >= 2);
      const kNeg = motsEntre(t - 0.3, t + 0.9).findIndex((_, k, l) => estNegation(l, k));
      const negation = kNeg >= 0 ? motsEntre(t - 0.3, t + 0.9)[kNeg] : undefined;
      const apresNeg = negation ? jetons.find((j) => j.a > negation.a && j.a <= t + 1.2 && j.contenu && !j.interdit) : undefined;
      const mot = apresNeg ?? fenetre.find((j) => estMotFort(j.w)) ?? fenetre.sort((x, y) => Number(estVerbe(x)) - Number(estVerbe(y)))[0];
      if (!nombre && !mot) return null;
      const debut = arrondi(t);
      if (nombre) {
        const fin = arrondi(Math.min(limite, debut + 1.6));
        if (fin - debut < SEUILS.calque.min) return null;
        const suivant = jetons[jetons.indexOf(nombre) + 1];
        const unite = suivant ? UNITES[simplifier(suivant.propre)] : undefined;
        const calque: CalquePlan = { type: "compteur", debut, fin, de: 0, a: nombreDe(nombre)!, dureeDefilement: arrondi(Math.min(1.2, (fin - debut) * 0.6)), ...(unite ? { suffixe: unite } : {}), fond: FONDS[variante % 3] };
        return schemaCalque.safeParse(calque).success ? { famille: "etiquette", debut, fin, force: 2.5, calque, motsForts: [nombre.propre] } : null;
      }
      // Deux objets « en haut » viennent de passer (R4c : une même place 2 fois de suite au plus) : le rôle glisse du bord droit.
      if (posees.length >= 2 && posees.slice(-2).every((y) => y.place === "haut") && !apresNeg) {
        const fin = arrondi(Math.min(limite, debut + 1.1));
        const glisse: CalquePlan = { type: "glisse", debut, fin, texte: texteDe([mot!], 40), icone: iconePour(mot, variante) };
        return fin - debut >= SEUILS.calque.min && schemaCalque.safeParse(glisse).success ? { famille: "etiquette", debut, fin, force: estMotFort(mot!.w) ? 1 : 0.3, calque: glisse, motsForts: [mot!.propre] } : null;
      }
      const icones = rythmer(motsEntre(debut + 0.3, debut + 1.6).filter((j) => j !== mot).map((j) => j.a), debut + 0.3, debut + 1.7).slice(0, 4);
      const fin = finApres(debut, icones, limite, 1, 1.7);
      if (fin - debut < SEUILS.calque.min) return null;
      const barre = apresNeg ? jetons.find((j) => j.a > apresNeg.a + 0.05 && j.a <= fin - 0.1)?.a : undefined;
      const calque: CalquePlan = {
        type: "etiquette",
        debut,
        fin,
        texte: texteDe([mot!], 40),
        fond: FONDS[(variante + nb("etiquette")) % 3],
        ...(icones.filter((a) => a < fin - 0.1 && a !== barre).length ? { icones: icones.filter((a) => a < fin - 0.1 && a !== barre).map((a, k) => ({ nom: iconePour(jetons.find((j) => Math.abs(j.a - a) < 0.14), k + variante), a })) } : {}),
        ...(barre !== undefined ? { barreA: barre } : {}),
      };
      return schemaCalque.safeParse(calque).success ? { famille: "etiquette", debut, fin, force: apresNeg ? 2 : estMotFort(mot!.w) ? 1 : 0.3, calque, motsForts: [mot!.propre] } : null;
    },

    carte: (t, limite) => {
      if (t < D.premiereCarteSec) return null;
      const debut0 = arrondi(t);
      const fin0 = arrondi(Math.min(limite, debut0 + APPARITION_MAX_SEC));
      const candidats = segments.filter((s) => s.fin > debut0 + 0.6 && s.debut < fin0 - 0.6).sort((x, y) => y.score - x.score);
      const ordre = [...ROTATION, "liste", "frise", "grille", "calendrier", "commentaire"] as TypeCarte[];
      for (const s of candidats) {
        const prefere: TypeCarte | null = s.genre === "numerote" ? "frise" : s.genre === "appel" ? "commentaire" : s.genre === "question" ? "chat" : s.genre === "negation" ? "statuts" : null;
        const types = [...new Set([...(prefere ? [prefere] : []), ...ordre.slice(variante % ROTATION.length), ...ordre])].filter((x) => !typesCartes.has(x));
        const entree = ENTREES_CARTE[(variante + nb("carte")) % 3];
        for (const type of types) {
          const r = construireCarte(jetons, e.mots, s, type, Math.max(debut0, s.debut - 0.05), fin0, e.motCle ?? "", entree);
          if (!r || r.carte.debut > debut0 + RETARD_ENTREE_MAX_SEC) continue;
          const force = s.genre === "simple" ? 1.5 : 3;
          return { famille: "carte", debut: r.carte.debut, fin: r.carte.fin, force, carte: r.carte, motsForts: r.items.map((x) => x.texte), typeCarte: type };
        }
      }
      return null;
    },

    fenetre: (t, limite) => {
      if (t < D.ouvertureSec) return null;
      const debut = arrondi(t);
      // Dans un blanc de la parole, la mini-vidéo tient jusqu'à 2,9 s (elle bouge en continu).
      const fin = arrondi(Math.min(limite, debut + (blancDans(debut, debut + 2.9) >= 1.2 ? 2.9 : 2.2)));
      if (fin - debut < FENETRE_MIN_SEC) return null;
      const n = nb("fenetre");
      const surVisage = posees.filter((p) => p.famille === "fenetre" && p.couvre).length;
      for (const mot of jetons.filter((j) => j.a >= debut - 1.4 && j.a <= fin + 0.9 && j.contenu && !j.interdit)) {
        const sc = chercher(SCENES, mot);
        if (!sc || scenesPrises.has(sc.scene)) continue;
        // « illustre » : la phrase dite qui FINIT sur le mot montré (au plus 1,6 s avant lui).
        const ill = illustreDe(jetons, Math.max(mot.a - 1.6, debut - SEUILS.illustreAvantSec + 0.05), mot.a + 0.01);
        const ditsAutour = jetons.filter((j) => j.a >= debut - SEUILS.illustreAvantSec && j.a <= fin + SEUILS.illustreApresSec).map((j) => j.base);
        if (metaphoresDe(sc.scene, ditsAutour).length || (ill && exigencesScene(ill, sc.scene).length)) continue;
        // R4d : la moitié au plus sur le visage, la moitié au plus avec une étiquette ; R1c : rien sur le visage avant 5 s.
        const cadrage = debut >= D.premiereCouvertureSec && surVisage + 1 <= (n + 1) / 2 + 1e-9 && (n + variante) % 2 === 0 ? "sur-le-visage" : "au-dessus";
        const avecEtiquettes = poses.filter((p) => p.fenetre?.etiquette).length;
        const passe = jetons.find((j) => estPasse(j) && j.a >= debut + 0.2 && j.a <= fin - 0.2);
        const etiq = avecEtiquettes + 1 <= (n + 1) / 2 + 1e-9 ? jetons.find((j) => j.contenu && !j.interdit && j.a >= debut + 0.4 && j.a <= fin - 0.3 && estMotFort(j.w) && (!passe || Math.abs(j.a - passe.a) >= 0.3)) : undefined;
        const f: FenetrePlan = {
          debut,
          fin,
          media: "fenetre",
          recherche: sc.scene,
          ...(ill ? { illustre: ill } : {}),
          ...(sc.video || poses.filter((p) => p.fenetre && !p.fenetre.video).length >= 1 ? { video: true } : {}),
          entree: ENTREES_FENETRE[(n + variante) % ENTREES_FENETRE.length],
          cadrage,
          ...(passe ? { noirEtBlancA: passe.a } : {}),
          ...(etiq ? { etiquette: { texte: texteDe([etiq], 40), a: etiq.a } } : {}),
        };
        if (!schemaFenetre.safeParse(f).success) continue;
        return { famille: "fenetre", debut, fin, force: 2, fenetre: f, motsForts: [mot.propre, ...(etiq ? [etiq.propre] : [])] };
      }
      return null;
    },

    "trait-dessine": (t, limite) => {
      const forts = porteursEntre(t, t + 1.9).filter((j) => estMotFort(j.w) || !estVerbe(j));
      if (!forts.length || forts[0].a > t + 0.9) return null;
      const debut = arrondi(Math.max(t, forts[0].a - 0.3));
      const choisis = chaine(forts, debut, 3);
      if (!choisis.length) return null;
      const fin = finApres(debut, choisis.map((j) => j.a), limite, 1, 2.2);
      const traits = choisis.filter((j) => j.a <= fin - 0.1).map((j) => ({ mot: j.propre.slice(0, 30), a: j.a }));
      const motion: MotionPlan = { debut, fin, famille: "trait-dessine", contenu: { forme: (["souligne", "encadre", "entoure"] as const)[(variante + nb("trait-dessine")) % 3], traits }, illustre: illustre(debut, fin) };
      return { famille: "trait-dessine", debut, fin, force: choisis.some((j) => estMotFort(j.w)) ? 1 : 0.4, motion, motsForts: choisis.map((j) => j.propre) };
    },

    "chiffre-eclate": (t, limite) => {
      const n = motsEntre(t, t + 1.2).find((j) => (nombreDe(j) ?? 0) >= 2);
      if (!n) return null;
      const debut = arrondi(Math.max(t, n.a - 0.3));
      const suivant = jetons[jetons.indexOf(n) + 1];
      const unite = suivant ? UNITES[simplifier(suivant.propre)]?.trim() : undefined;
      const eclat = jetons.find((j) => j.a >= n.a + 0.3 && j.a <= n.a + 0.8);
      const instants = rythmer([n.a, ...(eclat ? [eclat.a] : [])], debut, debut + 2);
      const fin = finApres(debut, instants, limite, 1.1, 2);
      const legende = suivant && !unite && suivant.contenu && !suivant.interdit ? tronquer(suivant.propre, 20) : undefined;
      const motion: MotionPlan = { debut, fin, famille: "chiffre-eclate", contenu: { valeur: nombreDe(n)!, a: n.a, ...(unite ? { suffixe: unite } : {}), ...(legende ? { legende } : {}), ...(eclat && eclat.a < fin - 0.1 ? { eclatA: eclat.a } : {}) }, illustre: illustre(debut, fin) };
      return { famille: "chiffre-eclate", debut, fin, force: 3, motion, motsForts: [n.propre] };
    },

    horloge: (t, limite) => {
      const declencheur = motsEntre(t, t + 1.4).find((j) => MOTS_TEMPS.test(j.base));
      if (!declencheur) return null;
      const debut = arrondi(Math.max(t, declencheur.a - 0.3));
      const k = jetons.indexOf(declencheur);
      const nombre = [jetons[k - 1], jetons[k - 2]].find((j) => j && (nombreDe(j) ?? 0) >= 1 && UNITES_TEMPS[declencheur.base]);
      const reperes = rythmer(motsEntre(declencheur.a + 0.3, debut + 2.4).map((j) => j.a), declencheur.a + 0.3, debut + 2.5).slice(0, 4);
      // Continue (les aiguilles tournent) : elle peut couvrir un blanc de la parole.
      const tenue = blancDans(declencheur.a, debut + 2.9) >= 1.1 ? 2.9 : APPARITION_MAX_SEC;
      const fin = arrondi(Math.min(limite, debut + tenue, Math.max(debut + (tenue > APPARITION_MAX_SEC ? tenue : 1.6), (reperes[reperes.length - 1] ?? declencheur.a) + 0.6)));
      const motion: MotionPlan = {
        debut,
        fin,
        famille: "horloge",
        contenu: { mode: nombre ? "minuteur" : "horloge", a: declencheur.a, ...(reperes.filter((a) => a < fin - 0.1).length ? { reperes: reperes.filter((a) => a < fin - 0.1).map((a) => ({ a })) } : {}), ...(nombre ? { duree: { valeur: nombreDe(nombre)!, unite: UNITES_TEMPS[declencheur.base] } } : {}) },
        illustre: illustre(debut, fin),
      };
      return { famille: "horloge", debut, fin, force: 3, motion, motsForts: [declencheur.propre] };
    },

    bulles: (t, limite) => {
      // Une question DITE (« ? ») dont le début tombe dans [t − 0,2, t + 1,2].
      const questions: { texte: string; a: number }[] = [];
      let k0 = jetons.findIndex((j) => j.a >= t - 1);
      while (k0 >= 0 && k0 < jetons.length && jetons[k0].a <= t + 2.2 && questions.length < 2) {
        let k = k0;
        while (k < jetons.length - 1 && !finDePhrase(jetons[k].ponct) && jetons[k + 1].a - jetons[k].f < BLANC_PHRASE_SEC) k++;
        const phrase = jetons.slice(k0, k + 1);
        const question = jetons[k].ponct === "?" || phrase.some((j) => INTERROGATIFS.test(j.base));
        const debutPhrase = k0 === 0 || finDePhrase(jetons[k0 - 1].ponct) || jetons[k0 - 1].ponct === ":" || jetons[k0 - 1].ponct === ",";
        if (question && debutPhrase && (questions.length || phrase[0].a <= t + 1.2)) {
          const utiles = phrase.filter((j) => !/^\d+$/.test(j.propre) && valeurEnLettres(j.propre) === null);
          // La bulle surgit sur le premier mot de la question dit à partir de l'entrée.
          const pop = utiles.find((j) => j.a >= t - 1e-6);
          if (utiles.length && pop) questions.push({ texte: tronquer(`${texteDe(utiles, 38)}${jetons[k].ponct === "?" ? " ?" : ""}`, 40), a: pop.a });
        }
        k0 = k + 1;
      }
      if (!questions.length) return null;
      const debut = arrondi(Math.max(t, Math.min(questions[0].a - 0.25, t + 0.6)));
      const fin = finApres(debut, questions.map((q) => q.a), limite, 1.2, APPARITION_MAX_SEC);
      const garde = questions.filter((q) => q.a <= fin - 0.1);
      if (garde.length < 1 || garde[0].a < debut) return null;
      const motion: MotionPlan = { debut, fin, famille: "bulles", contenu: { questions: garde }, illustre: illustre(debut, fin) };
      return { famille: "bulles", debut, fin, force: 3, motion, motsForts: [] };
    },

    telephone: (t, limite) => {
      const declencheur = motsEntre(t, t + 1.2).find((j) => chercher(MOTS_TELEPHONE, j) !== undefined);
      if (!declencheur) return null;
      // Le téléphone s'allume juste avant le mot (0,6 s au plus) : l'écran s'éclaire, puis la ligne arrive sur le mot.
      const debut = arrondi(Math.max(t, declencheur.a - 0.6));
      const lignes = chaine(nomsEntre(debut, debut + 2.2), debut, 4);
      if (!lignes.length) return null;
      const fin = finApres(debut, lignes.map((j) => j.a), limite, 1.1);
      const garde = lignes.filter((j) => j.a <= fin - 0.1);
      const motion: MotionPlan = { debut, fin, famille: "telephone", contenu: { appli: chercher(MOTS_TELEPHONE, declencheur)!, lignes: garde.map((j, k) => ({ texte: tronquer(majuscule(j.propre), 28), a: j.a, icone: iconePour(j, k) })) }, illustre: illustre(debut, fin) };
      return garde.length ? { famille: "telephone", debut, fin, force: 3, motion, motsForts: garde.map((j) => j.propre) } : null;
    },

    "carte-france": (t, limite) => {
      const fort = motsEntre(t, t + 1.2).find((j) => MOTS_FRANCE_FORTS.test(j.base));
      const faible = motsEntre(t, t + 1.2).find((j) => MOTS_FRANCE_FAIBLES.test(j.base));
      const declencheur = fort ?? faible;
      if (!declencheur) return null;
      const debut = arrondi(Math.max(t, declencheur.a - 0.3));
      const points = rythmer(motsEntre(declencheur.a, debut + 2.2).map((j) => j.a), declencheur.a, debut + 2.3);
      const pris = points.filter((a, k) => k === 0 || a - points[k - 1] >= 0.25).slice(0, 8);
      if (pris.length < 2) return null;
      const fin = finApres(debut, pris, limite, 1.2);
      const garde = pris.filter((a) => a <= fin - 0.1);
      if (garde.length < 2) return null;
      const partout = motsEntre(debut - 1, fin).find((j) => j.base === "partout");
      const motion: MotionPlan = { debut, fin, famille: "carte-france", contenu: { points: garde.map((a) => ({ a })), ...(partout ? { legende: "Partout" } : {}) }, illustre: illustre(debut, fin) };
      return { famille: "carte-france", debut, fin, force: fort ? 3 : 1.2, motion, motsForts: [declencheur.propre] };
    },

    "pile-notifications": (t, limite) => {
      const debut = arrondi(t);
      const taches = nomsEntre(debut, debut + 2.3).filter((j) => MOTS_TACHES.test(j.base) || chercher(ICONES_MOTS, j) !== undefined);
      const forts = taches.filter((j) => MOTS_TACHES.test(j.base)).length;
      const choisies = chaine(taches, debut, 5);
      if (choisies.length < 2) return null;
      const fin = finApres(debut, choisies.map((j) => j.a), limite, 1.2);
      const garde = choisies.filter((j) => j.a <= fin - 0.1);
      if (garde.length < 2) return null;
      const motion: MotionPlan = { debut, fin, famille: "pile-notifications", contenu: { notifications: garde.map((j, k) => ({ titre: tronquer(majuscule(j.propre), 24), icone: iconePour(j, k + variante), a: j.a })) }, illustre: illustre(debut, fin) };
      return { famille: "pile-notifications", debut, fin, force: forts >= 2 ? 3 : 1, motion, motsForts: garde.map((j) => j.propre) };
    },

    jauge: (t, limite) => {
      const declencheur = motsEntre(t, t + 1).find((j) => MOTS_JAUGE.test(j.base) && !j.interdit);
      if (!declencheur) return null;
      const debut = arrondi(Math.max(t, declencheur.a - 0.3));
      const niveaux = rythmer([declencheur.a, ...motsEntre(declencheur.a + 0.3, debut + 2.2).map((j) => j.a)], declencheur.a, debut + 2.3);
      const pris = niveaux.filter((a, k) => k === 0 || a - niveaux[k - 1] >= 0.3).slice(0, 4);
      const fin = finApres(debut, pris, limite, 1.2);
      const garde = pris.filter((a) => a <= fin - 0.1);
      const motion: MotionPlan = { debut, fin, famille: "jauge", contenu: { forme: (variante + nb("jauge")) % 2 ? "barre" : "cadran", legende: texteDe([declencheur], 40), niveaux: garde.map((a, k) => ({ niveau: arrondi(Math.min(0.95, 0.35 + (0.6 * (k + 1)) / garde.length)), a })) }, illustre: illustre(debut, fin) };
      return garde.length ? { famille: "jauge", debut, fin, force: 2.5, motion, motsForts: [declencheur.propre] } : null;
    },

    ruban: (t, limite) => {
      const debut = arrondi(t);
      const mots = chaine(porteursEntre(debut, debut + 2.8), debut, 8);
      if (mots.length < 3) return null;
      // Il défile en continu : dans un blanc de la parole, il tient jusqu'à 2,9 s.
      const fin = finApres(debut, mots.map((j) => j.a), limite, 1.4, blancDans(debut, debut + 2.9) >= 1.1 ? 2.9 : APPARITION_MAX_SEC);
      const garde = mots.filter((j) => j.a <= fin - 0.1);
      if (garde.length < 3) return null;
      const motion: MotionPlan = { debut, fin, famille: "ruban", contenu: { mots: garde.map((j) => ({ texte: tronquer(majuscule(j.propre), 20), a: j.a })) }, illustre: illustre(debut, fin) };
      return { famille: "ruban", debut, fin, force: garde.length >= 4 ? 2 : 1, motion, motsForts: garde.map((j) => j.propre) };
    },

    "mot-geant": (t, limite) => {
      if (t < D.premierPleinEcranSec) return null;
      const tranche = Math.floor(t / D.trancheMotGeantSec);
      if (poses.some((p) => p.famille === "mot-geant" && Math.floor(p.debut / D.trancheMotGeantSec) === tranche)) return null;
      const candidats = porteursEntre(t, t + 0.9).filter((j) => MOTS_CHOC.test(j.base) || estMotFort(j.w));
      const mot = candidats.find((j) => MOTS_CHOC.test(j.base)) ?? candidats[0];
      if (!mot) return null;
      const debut = arrondi(Math.max(t, mot.a - 0.2));
      const second = porteursEntre(mot.a + 0.3, mot.a + 0.9).find((j) => j.base.length >= 3);
      const mots = [mot, ...(second ? [second] : [])];
      // Un mot géant est un coup de poing : 0,7 s suffit (il ne reste pas immobile avant un blanc).
      const fin = finApres(debut, mots.map((j) => j.a), limite, 0.7, 1.6);
      const motion: MotionPlan = { debut, fin, famille: "mot-geant", contenu: { mots: mots.filter((j) => j.a <= fin - 0.1).map((j) => ({ texte: tronquer(majuscule(j.propre), 16), a: j.a })), fond: (["orange", "encre", "ivoire"] as const)[(variante + nb("mot-geant")) % 3] }, illustre: illustre(debut, fin) };
      return { famille: "mot-geant", debut, fin, force: MOTS_CHOC.test(mot.base) ? 3 : 1, motion, motsForts: mots.map((j) => j.propre) };
    },

    volet: (t, limite) => {
      if (t < D.premierPleinEcranSec) return null;
      // Début d'une partie : un début de phrase après un blanc, de préférence sur une marque (« Chez », « Alors », « Prenez »…).
      const k = jetons.findIndex((j, i) => j.a >= t - 0.1 && j.a <= t + 0.6 && i > 0 && (finDePhrase(jetons[i - 1].ponct) || j.a - jetons[i - 1].f > 0.9));
      if (k < 0) return null;
      const phrase = jetons.slice(k, k + 8).filter((j) => j.a <= jetons[k].a + 1.5);
      const nom = meilleurNom(phrase);
      if (!nom) return null;
      const debut = arrondi(Math.max(t, jetons[k].a - 0.2));
      const fin = finApres(debut, [nom.a], limite, 0.9, 1.3);
      if (nom.a > fin - 0.1) return null;
      const motion: MotionPlan = { debut, fin, famille: "volet", contenu: { titre: tronquer(majuscule(nom.propre), 24), a: nom.a, couleur: (["orange", "encre", "sable"] as const)[(variante + nb("volet")) % 3] }, illustre: illustre(debut, fin) };
      return { famille: "volet", debut, fin, force: MARQUES_PARTIE.test(jetons[k].base) ? 2.5 : 1, motion, motsForts: [nom.propre] };
    },

    "ecran-partage": (t, limite) => {
      if (t < D.premierPleinEcranSec) return null;
      const debut = arrondi(t);
      const fenetre = motsEntre(debut, debut + 2.4);
      const k = fenetre.findIndex((j, i) => MARQUES_OPPOSITION.test(j.base) || (j.base === "alors" && fenetre[i + 1]?.base === "que"));
      if (k < 0) return null;
      const avant = fenetre.slice(0, k).filter((j) => j.contenu && !j.interdit && !estVerbe(j) && nombreDe(j) === null && j.base.length >= 3);
      const apres = fenetre.slice(k + 1).filter((j) => j.contenu && !j.interdit && !estVerbe(j) && nombreDe(j) === null && j.base.length >= 3);
      if (!avant.length || !apres.length) return null;
      const g = avant[avant.length - 1];
      const d = apres[0];
      const extras = rythmer([g.a, d.a], debut, debut + 2.4).filter((a) => Math.abs(a - g.a) > 0.05 && Math.abs(a - d.a) > 0.05);
      const fin = finApres(debut, [g.a, d.a, ...extras].sort((x, y) => x - y), limite, 1.6);
      const elements = extras.filter((a) => a <= fin - 0.1).slice(0, 4).map((a) => {
        const j = jetons.find((x) => Math.abs(x.a - a) < 0.14 && x.contenu && !x.interdit);
        return j ? { cote: a < d.a ? ("gauche" as const) : ("droite" as const), texte: tronquer(majuscule(j.propre), 40), a } : null;
      }).filter((x): x is { cote: "gauche" | "droite"; texte: string; a: number } => !!x);
      const motion: MotionPlan = { debut, fin, famille: "ecran-partage", contenu: { gauche: { titre: tronquer(majuscule(g.propre), 40), a: g.a }, droite: { titre: tronquer(majuscule(d.propre), 40), a: d.a }, ...(elements.length ? { elements } : {}) }, illustre: illustre(debut, fin) };
      return d.a <= fin - 0.1 && g.a >= debut ? { famille: "ecran-partage", debut, fin, force: 2.5, motion, motsForts: [g.propre, d.propre] } : null;
    },
  };

  /* ---- Ce que les règles permettent ---- */
  const fiche = (f: Famille) => CATALOGUE_FAMILLES[f];
  const versPosee = (p: Pose): Posee => {
    const visageFenetre = p.fenetre ? (p.fenetre.cadrage ?? "sur-le-visage") === "sur-le-visage" : false;
    const fi = fiche(p.famille);
    const couvre = p.famille === "fenetre" ? visageFenetre : fi.visage === "couvert";
    const place = p.fenetre ? (visageFenetre ? "centre" : "haut") : p.calque ? (p.calque.type === "glisse" ? "droite" : p.calque.type === "tuile" ? "gauche" : "haut") : fi.place;
    const entree = p.carte ? p.carte.entree : p.fenetre ? (p.fenetre.entree ?? "droite") : p.calque ? (p.calque.type === "glisse" ? "glisse-gauche" : "pop") : fi.entree;
    return { famille: p.famille, debut: p.debut, fin: p.fin, couvre, pousse: !couvre && (p.famille === "carte" || p.famille === "etiquette" || p.famille === "fenetre"), plein: fi.pleinEcran, place, entree };
  };
  const couvertEntre = (a: number, b: number, en: Posee[]) => en.filter((x) => x.couvre).reduce((s, x) => s + Math.max(0, Math.min(b, x.fin) - Math.max(a, x.debut)), 0);
  /** Vrai si la pose respecte les règles (niveau 0 : toutes ; 1 : sans le couple R3c ni les cadences ; 2 : l'essentiel seul). */
  const permise = (p: Pose, niveau: number): boolean => {
    const x = versPosee(p);
    const prec = posees[posees.length - 1];
    if (x.debut < D.rienAvantSec - 1e-6) return false;
    if (x.debut < D.ouvertureSec && (x.couvre || !fiche(x.famille).ouverture)) return false;
    if (x.couvre && x.debut < D.premiereCouvertureSec) return false;
    if (x.famille === "carte" && x.debut < D.premiereCarteSec) return false;
    if (x.plein && x.debut < D.premierPleinEcranSec) return false;
    if (prec && prec.famille === x.famille) return false;
    if (prec && prec.couvre && x.couvre) return false;
    if (prec && x.debut - prec.debut < D.debutsEcartMinSec) return false;
    if (!posees.length && premieresInterdites.has(x.famille)) return false;
    // R7b : dans les 20 premières secondes, moins de la moitié des enchaînements reprennent ceux des vidéos précédentes.
    if (prec && x.debut < D.couplesDebutSec && couplesAnciens.size && niveau < 3) {
      const suite = [...posees.filter((y) => y.debut < D.couplesDebutSec).map((y) => y.famille), x.famille];
      const couples = suite.slice(1).map((fa, k) => `${suite[k]} → ${fa}`);
      if (couples.filter((c) => couplesAnciens.has(c)).length >= D.couplesPartagesMax * Math.max(couples.length, 4)) return false;
    }
    if (x.couvre) {
      const dernier = [...posees].reverse().find((y) => y.couvre);
      if (dernier && x.debut - dernier.fin < D.visageEntreCouverturesSec) return false;
      if (couvertEntre(x.fin - D.fenetreCouvertureSec, x.fin, [...posees, x]) > D.couvertDansFenetreMax * D.fenetreCouvertureSec - 0.2) return false;
    }
    if (nb(x.famille) + 1 > plafond(x.famille)) return false;
    if (x.famille === "fenetre") {
      const aGarder = longsBlancs.filter((b) => b > x.fin + 0.5).length;
      if (nb("fenetre") + 1 + aGarder > plafond("fenetre")) return false;
    }
    if (p.typeCarte && typesCartes.has(p.typeCarte)) return false;
    const deux = posees.slice(-2);
    if (deux.length === 2 && deux.every((y) => y.place === x.place)) return false;
    if (deux.length === 2 && deux.every((y) => y.entree === x.entree)) return false;
    if (niveau >= 3) return true;
    const quatre = posees.slice(-(D.suiteMemeFamille - 1));
    if (quatre.filter((y) => y.famille === x.famille).length + 1 > D.memeFamilleDansSuiteMax) return false;
    if (nb(x.famille) + 1 > plafond20) return false;
    if (niveau >= 2) return true;
    if (prec) {
      const couple = `${prec.famille} → ${x.famille}`;
      const recents = posees.slice(-D.coupleRevientApres - 1);
      for (let k = 1; k < recents.length; k++) if (`${recents[k - 1].famille} → ${recents[k].famille}` === couple) return false;
    }
    if (niveau >= 1) return true;
    // Cadence des plafonds : une famille ne s'épuise pas avant la fin de la vidéo (sinon plus rien ne peut entrer à la fin).
    if (nb(x.famille) + 1 > Math.ceil(plafond(x.famille) * Math.min(1, x.fin / horizon)) + 1) return false;
    // Cadences du temps de visage (R2a) : couvert ≤ 28 % et visage hors de sa place ≤ 52 % au fil de la vidéo.
    const tous = [...posees, x];
    const couvert = tous.filter((y) => y.couvre).reduce((s, y) => s + y.fin - y.debut, 0);
    const hors = tous.filter((y) => y.couvre || y.pousse).reduce((s, y) => s + y.fin - y.debut, 0);
    if (couvert > 0.28 * Math.max(x.fin, 25)) return false;
    if (hors > 0.52 * Math.max(x.fin, 20) + 1.5) return false;
    return true;
  };
  /** Note d'une pose : force du déclencheur, familles peu servies, variété d'une vidéo à l'autre. */
  const note = (p: Pose): number => {
    const f = p.famille;
    const prec = posees[posees.length - 1];
    const recents = posees.slice(-6).filter((y) => y.famille === f).length;
    let s = 10 * p.force - 4 * nb(f) - 3 * recents;
    if (!nb(f)) s += 4;
    if (absentesAvant.has(f)) s += nb(f) ? 2 : 8;
    if (prec && p.debut < D.couplesDebutSec && couplesAnciens.has(`${prec.famille} → ${f}`)) s -= 8;
    if (topAvant === f) s -= 3 * nb(f);
    // Cadence des plafonds : une famille ne s'épuise pas avant la fin (sinon, plus rien ne peut entrer à la fin).
    const usage = (nb(f) + 1) / Math.max(1, plafond(f));
    if (usage > p.debut / horizon + 0.3) s -= 8;
    // Atteindre un plafond coûte un de moins à la vidéo suivante (R7d) : la dernière place se prend en dernier recours.
    if (nb(f) + 1 >= plafond(f)) s -= 6;
    // Un blanc de la parole arrive : ce qui bouge en continu (mini-vidéo, horloge, ruban) le couvre.
    const continu = fiche(f).continu || !!p.fenetre?.video;
    const blanc = blancDans(p.debut, p.fin + 0.6);
    if (blanc >= 1.1 && continu) s += 14;
    // Un objet immobile qui laisse derrière lui un long blanc : rien ne pourra le suivre à temps.
    if (!continu && blancDans(p.fin - 0.2, p.fin + 2.2) >= 2) s -= 10;
    // Les cartes et les fenêtres doivent tenir leur nombre (bande, une fenêtre toutes les 20 s).
    if (f === "fenetre" && p.debut > (nb("fenetre") + 1) * 14) s += 10;
    if (f === "carte" && p.debut > (nb("carte") + 1) * 16) s += 8;
    s += ((hashFamille(f) + variante * 7 + posees.length * 3) % 5) * 0.4;
    return s;
  };
  const poser = (p: Pose) => {
    poses.push(p);
    posees.push(versPosee(p));
    comptes.set(p.famille, nb(p.famille) + 1);
    if (p.typeCarte) typesCartes.add(p.typeCarte);
    if (p.fenetre) scenesPrises.add(p.fenetre.recherche);
  };

  /* ---- Pose de gauche à droite ---- */
  let t = D.rienAvantSec + 0.05;
  for (let garde = 0; garde < 400 && t < horizon - 0.9; garde++) {
    const prec = posees[posees.length - 1];
    // R5d : le prochain objet entre au plus 2,9 s après le précédent.
    const auPlusTard = prec ? prec.debut + D.sansEvenementMaxSec - 0.1 : D.sansEvenementMaxSec - 0.1;
    const limite = horizon - 0.05;
    let choisi: Pose | null = null;
    // Les poses possibles ne dépendent que de (famille, instant) : calculées une fois pour les 4 niveaux.
    const cache = new Map<string, Pose | null>();
    const poseEn = (f: Famille, d: number) => {
      const cle = `${f}@${d}`;
      if (!cache.has(cle)) {
        // Inutile de construire une famille épuisée, ou celle qui vient de passer (R3a).
        const epuisee = nb(f) >= plafond(f) || prec?.famille === f;
        cache.set(cle, epuisee ? null : construire[f](d, limite));
      }
      return cache.get(cle)!;
    };
    // Niveaux : 0 toutes les règles ; 1 sans les cadences ; 2 sans le couple R3c ; 3 l'essentiel ; 4 l'essentiel, plus
    // tard que 3 s après l'objet précédent (mieux vaut un écart de trop qu'une vidéo qui s'arrête).
    for (let niveau = 0; niveau <= 4 && !choisi; niveau++) {
      const candidats: Pose[] = [];
      const borne = Math.max(t, auPlusTard);
      const dernierDepart = niveau < 4 ? Math.min(t + RETARD_ENTREE_MAX_SEC + 0.6, borne) : t + 3;
      for (let d = t; d <= dernierDepart + 1e-6; d += 0.15) {
        for (const f of FAMILLES) {
          const p = poseEn(f, arrondi(d));
          if (p && (niveau === 4 || p.debut <= borne + 1e-6) && p.fin <= limite + 1e-6 && p.fin - p.debut >= SEUILS.motion.min - 1e-6 && permise(p, Math.min(niveau, 3))) candidats.push(p);
        }
      }
      // Entrer tôt vaut mieux (le temps libre entre deux objets n'a aucun mouvement) : −4 par seconde de retard.
      const valeur = (p: Pose) => note(p) - 4 * (p.debut - t);
      if (candidats.length) choisi = candidats.sort((x, y) => valeur(y) - valeur(x) || x.debut - y.debut)[0];
    }
    if (!choisi) {
      t = arrondi(t + 0.3);
      continue;
    }
    poser(choisi);
    t = arrondi(choisi.fin + ECART_OBJETS_SEC);
  }

  const scene = (): MiseEnScene => ({
    cartes: poses.flatMap((p) => (p.carte ? [p.carte] : [])),
    fenetres: poses.flatMap((p) => (p.fenetre ? [p.fenetre] : [])).map((f, k) => ({ ...f, media: `fenetre-${k + 1}` })),
    calques: poses.flatMap((p) => (p.calque ? [p.calque] : [])),
    motions: poses.flatMap((p) => (p.motion ? [p.motion] : [])),
    zooms: [],
    mouvements: [],
    motsForts: [...new Set(poses.flatMap((p) => p.motsForts))],
  });

  /* ---- Trous comptés comme la mesure : les bords des objets bougent pour que leur entrée ou leur sortie tombe dedans ---- */
  const groupes = groupesSousTitres(e.mots, { motsForts: scene().motsForts });
  const rythmeDe = () => {
    const s = scene();
    return rythmePrevu({ cartes: s.cartes, fenetres: s.fenetres, calques: s.calques, motions: s.motions, groupes, duree: e.dureeSec, fin: { debut: horizon }, prise: e.prise ?? {} });
  };
  const exces = (r: RythmePrevu) => r.trous.reduce((s, [d]) => s + Math.max(0, d - SEUILS.trouMaxSec), 0);
  const sousDe = (p: Pose) => (p.motion ? instantsMotion(p.motion) : objetsDuPlan({ cartes: p.carte ? [p.carte] : [], fenetres: p.fenetre ? [p.fenetre] : [], calques: p.calque ? [p.calque] : [] })[0]?.sous.map((x) => x.a) ?? []);
  const avecBords = (p: Pose, debut: number, fin: number): Pose | null => {
    debut = arrondi(debut);
    fin = arrondi(fin);
    const sous = sousDe(p);
    if (sous.some((a) => a < debut - 1e-6 || a > fin - 0.05)) return null;
    const borne = p.carte ? SEUILS.carte : p.fenetre ? SEUILS.fenetre : p.motion ? SEUILS.motion : SEUILS.calque;
    // Ce qui bouge en continu (mini-vidéo, horloge, ruban) peut tenir jusqu'à 2,95 s (une nouvelle entrée toutes les 3 s).
    const continu = !!p.fenetre?.video || CATALOGUE_FAMILLES[p.famille].continu;
    if (fin - debut < borne.min || fin - debut > Math.min(borne.max, continu ? 2.95 : APPARITION_MAX_SEC + 0.3)) return null;
    if (p.carte) {
      // Carte : jamais vide (1er sous-élément ≤ 0,2 s après l'entrée).
      if (Math.min(...sous) > debut + SEUILS.carteVideMaxSec - 0.02) return null;
      return { ...p, debut, fin, carte: { ...p.carte, debut, fin } };
    }
    if (p.fenetre) return { ...p, debut, fin, fenetre: { ...p.fenetre, debut, fin } };
    if (p.calque) return schemaCalque.safeParse({ ...p.calque, debut, fin }).success ? { ...p, debut, fin, calque: { ...p.calque, debut, fin } as CalquePlan } : null;
    if (p.motion) return { ...p, debut, fin, motion: { ...p.motion, debut, fin } };
    return null;
  };
  /** Écarts d'ordre (chevauchements, plus de 3 s ou moins de 0,4 s entre deux débuts) : une retouche ne les aggrave jamais. */
  const ecartsOrdre = () =>
    poses.reduce((n, p, i) => {
      if (!i) return n + (p.debut > D.sansEvenementMaxSec ? 1 : 0);
      const e = p.debut - poses[i - 1].debut;
      return n + (p.debut < poses[i - 1].fin + 0.02 ? 1 : 0) + (e > D.sansEvenementMaxSec - 0.05 ? 1 : 0) + (e < D.debutsEcartMinSec ? 1 : 0);
    }, 0);
  /** Défauts de diversité (R1 à R7) du plan courant : une retouche de bords ne doit pas en créer. */
  const defautsDiversite = () => controlerDiversite(planProvisoire(e, scene(), horizon, groupes), { historique: e.historique }).erreurs.length;
  const essayer = (k: number, n: Pose, avant: number): boolean => {
    const ancien = poses[k];
    const e0 = ecartsOrdre();
    const d0 = defautsDiversite();
    poses[k] = n;
    posees[k] = versPosee(n);
    if (ecartsOrdre() <= e0 && exces(rythmeDe()) < avant - 1e-6 && defautsDiversite() <= d0) return true;
    poses[k] = ancien;
    posees[k] = versPosee(ancien);
    return false;
  };
  /** Un élément de plus dans une motion, sur l'instant `t` (début d'un mot ± 0,13 s) : null si la famille ne s'y prête pas. */
  const avecElement = (p: Pose, t: number): Pose | null => {
    const m = p.motion;
    if (!m || t <= p.debut + 0.1 || t >= p.fin - 0.1) return null;
    const mot = jetons.find((j) => Math.abs(j.a - t) < 1e-6 && j.contenu && !j.interdit && nombreDe(j) === null && j.base.length >= 3);
    const c = m.contenu as Record<string, unknown>;
    const liste = (cle: string) => [...((c[cle] as Record<string, unknown>[] | undefined) ?? [])];
    const trier = (l: Record<string, unknown>[]) => l.sort((x, y) => Number(x.a) - Number(y.a));
    let contenu: Record<string, unknown> | null = null;
    switch (m.famille) {
      case "carte-france":
        if (liste("points").length < 8) contenu = { ...c, points: trier([...liste("points"), { a: t }]) };
        break;
      case "jauge": {
        const l = trier([...liste("niveaux"), { a: t, niveau: 0.5 }]);
        if (l.length <= 4) contenu = { ...c, niveaux: l.map((x, k) => ({ ...x, niveau: arrondi(Math.min(0.95, 0.35 + (0.6 * (k + 1)) / l.length)) })) };
        break;
      }
      case "horloge":
        if (liste("reperes").length < 4) contenu = { ...c, reperes: trier([...liste("reperes"), { a: t }]) };
        break;
      case "ruban":
        if (mot && liste("mots").length < 8) contenu = { ...c, mots: trier([...liste("mots"), { texte: tronquer(majuscule(mot.propre), 20), a: t }]) };
        break;
      case "pile-notifications":
        if (mot && liste("notifications").length < 5) contenu = { ...c, notifications: trier([...liste("notifications"), { titre: tronquer(majuscule(mot.propre), 24), icone: iconePour(mot, liste("notifications").length), a: t }]) };
        break;
      case "telephone":
        if (mot && liste("lignes").length < 4) contenu = { ...c, lignes: trier([...liste("lignes"), { texte: tronquer(majuscule(mot.propre), 28), a: t }]) };
        break;
      case "trait-dessine":
        if (mot && liste("traits").length < 3) contenu = { ...c, traits: trier([...liste("traits"), { mot: mot.propre.slice(0, 30), a: t }]) };
        break;
      case "chiffre-eclate":
        if (c.eclatA === undefined && t > Number(c.a) + 0.2) contenu = { ...c, eclatA: t };
        break;
      case "ecran-partage":
        if (mot && liste("elements").length < 4) contenu = { ...c, elements: trier([...liste("elements"), { cote: t < Number((c.droite as { a: number }).a) ? "gauche" : "droite", texte: tronquer(majuscule(mot.propre), 40), a: t }]) };
        break;
      case "mot-geant":
        if (mot && liste("mots").length < 3) contenu = { ...c, mots: trier([...liste("mots"), { texte: tronquer(majuscule(mot.propre), 16), a: t }]) };
        break;
    }
    if (!contenu) return null;
    const n: MotionPlan = { ...m, contenu };
    return schemaMotion.safeParse(n).success ? { ...p, motion: n } : null;
  };
  for (let garde = 0; profond && garde < 60; garde++) {
    const r = rythmeDe();
    const avant = exces(r);
    if (avant <= 1e-6) break;
    let repare = false;
    for (const [d, a, z] of r.trous) {
      if (d <= SEUILS.trouMaxSec + 1e-6 || repare) continue;
      const milieu = (a + z) / 2;
      // Plusieurs instants visés dans le trou (la durée minimale d'un objet en écarte parfois un).
      const k = poses.findIndex((p) => p.debut <= milieu && p.fin >= milieu);
      const auPlusCourt = k >= 0 ? [poses[k].debut + (poses[k].carte ? SEUILS.carte.min : poses[k].fenetre ? SEUILS.fenetre.min : poses[k].motion ? SEUILS.motion.min : SEUILS.calque.min) + 0.01] : [];
      const cibles = [...new Set([a + 0.35, a + 0.45, a + 0.55, milieu, z - 0.35, ...auPlusCourt].filter((x) => x > a + 0.2 && x < z - 0.1).map(arrondi))];
      const variantes: [number, number, number][] = [];
      if (k >= 0) {
        const p = poses[k];
        // Un élément de plus sur un mot du trou (motions qui s'y prêtent).
        const instants = jetons.flatMap((j) => [j.a, j.a + 0.13, j.a - 0.13]).map((x) => arrondi(x)).filter((x) => x > a + 0.15 && x < z - 0.15).sort((x, y) => Math.abs(x - milieu) - Math.abs(y - milieu));
        for (const x of instants) {
          const n = avecElement(p, x);
          if (n && essayer(k, n, avant)) {
            repare = true;
            break;
          }
        }
        if (repare) continue;
        for (const cible of cibles) {
          // L'objet qui couvre le trou sort plus tôt (le suivant peut alors entrer plus tôt) …
          variantes.push([k, p.debut, cible]);
          // … ou il entre plus tard (son entrée tombe dans le trou).
          variantes.push([k, cible, p.fin]);
        }
      } else {
        const kp = poses.findIndex((p, i) => p.fin <= milieu && (poses[i + 1]?.debut ?? Infinity) >= milieu);
        for (const cible of cibles) {
          if (kp >= 0) variantes.push([kp, poses[kp].debut, cible]);
          if (kp + 1 < poses.length && kp >= -1) variantes.push([kp + 1, cible, poses[kp + 1].fin]);
        }
      }
      for (const [i, debut, fin] of variantes) {
        const n = avecBords(poses[i], debut, fin);
        if (!n) continue;
        // Le voisin suit : l'objet suivant peut entrer plus tôt (0,1 s après), le précédent sortir plus tard.
        if (essayer(i, n, avant)) {
          repare = true;
          break;
        }
        const suivant = poses[i + 1];
        if (suivant && fin < poses[i].fin) {
          // Le suivant entre 0,1 s après ; s'il devient trop long, il sort plus tôt aussi.
          const ns = avecBords(suivant, fin + ECART_OBJETS_SEC, suivant.fin) ?? avecBords(suivant, fin + ECART_OBJETS_SEC, suivant.fin - (poses[i].fin - fin));
          if (ns) {
            const ancien = poses[i];
            poses[i] = n;
            posees[i] = versPosee(n);
            if (essayer(i + 1, ns, avant)) {
              repare = true;
              break;
            }
            poses[i] = ancien;
            posees[i] = versPosee(ancien);
          }
        }
      }
    }
    if (!repare) break;
  }
  if (profond) reprendre();
  return scene();

  /**
   * REPRISE (meilleure variante seulement) : chaque défaut restant — trou de plus de 0,7 s, plus de 3 s sans nouvel objet,
   * règle de diversité — est traité en REMPLAÇANT l'objet en cause par une autre famille, en INSÉRANT un objet dans un
   * temps libre ; une retouche n'est gardée que si le compte des défauts baisse (ou, à compte égal, l'excès des trous).
   */
  function reprendre() {
    const planDe = () => planProvisoire(e, scene(), horizon, groupes);
    const defauts = () => {
      const plan = planDe();
      const r = rythmePrevu(plan);
      const trous = r.trous.filter(([d]) => d > SEUILS.trouMaxSec + 1e-6);
      const div = controlerDiversite(plan, { historique: e.historique }).erreurs;
      return { n: trous.length + div.length + (r.grosParMinute < SEUILS.grosMouvementsParMinuteMin ? 1 : 0), exces: exces(r), trous, div };
    };
    const resynchroniser = () => {
      posees.splice(0, posees.length, ...poses.map(versPosee));
      comptes.clear();
      for (const p of poses) comptes.set(p.famille, nb(p.famille) + 1);
      typesCartes.clear();
      for (const p of poses) if (p.typeCarte) typesCartes.add(p.typeCarte);
    };
    /** Contrôle rapide d'une suite de poses (ordre, plafonds, jamais la même famille de suite) avant l'évaluation. */
    const tient = (l: Pose[]) =>
      l.every((p, i) => {
        if (i && p.debut < l[i - 1].fin + 0.02) return false;
        if (i && l[i - 1].famille === p.famille) return false;
        if (p.fin > horizon - 0.05 + 1e-6) return false;
        if (p.typeCarte && l.filter((x) => x.typeCarte === p.typeCarte).length > 1) return false;
        return l.filter((x) => x.famille === p.famille).length <= plafond(p.famille);
      });
    const essayerSuite = (l: Pose[], d0: ReturnType<typeof defauts>) => {
      if (!tient(l)) return false;
      const avant = [...poses];
      poses.splice(0, poses.length, ...l);
      resynchroniser();
      const d1 = defauts();
      if (d1.n < d0.n || (d1.n === d0.n && d1.exces < d0.exces - 1e-6)) return true;
      poses.splice(0, poses.length, ...avant);
      resynchroniser();
      return false;
    };
    for (let garde = 0; garde < 30; garde++) {
      const d0 = defauts();
      if (!d0.n) return;
      const zones: [number, number][] = d0.trous.map(([, a, z]) => [a, z]);
      const debuts = [0, ...poses.map((p) => p.debut), horizon];
      for (let k = 1; k < debuts.length; k++) if (debuts[k] - debuts[k - 1] > DIVERSITE.sansEvenementMaxSec - 0.05) zones.push([debuts[k - 1], debuts[k]]);
      for (const x of d0.div) {
        const m = /à (\d+),(\d+) s/.exec(x);
        if (m) zones.push([Number(`${m[1]}.${m[2]}`) - 0.05, Number(`${m[1]}.${m[2]}`) + 0.05]);
        // R7e (la famille la plus utilisée, comme la fois d'avant) : une de ses apparitions change de famille.
        const top = /^R7e — « ([^»]+) »/.exec(x)?.[1];
        if (top) for (const p of poses.filter((y) => y.famille === top)) zones.push([p.debut - 0.05, p.debut + 0.05]);
      }
      let ameliore = false;
      for (const [a, z] of zones) {
        const milieu = (a + z) / 2;
        const k = poses.findIndex((p) => p.fin >= milieu - 1e-6);
        const essais: Pose[][] = [];
        // 1. Insérer un objet dans le temps libre qui touche la zone.
        const iLibre = poses.findIndex((p, i) => p.fin <= z && (poses[i + 1]?.debut ?? horizon) >= a && (poses[i + 1]?.debut ?? horizon) - p.fin >= 1);
        if (iLibre >= 0) {
          const debut = arrondi(poses[iLibre].fin + ECART_OBJETS_SEC);
          const limite = arrondi((poses[iLibre + 1]?.debut ?? horizon) - ECART_OBJETS_SEC);
          for (const f of FAMILLES) {
            const p = construire[f](debut, limite);
            if (p && p.fin <= limite + 1e-6) essais.push([...poses.slice(0, iLibre + 1), p, ...poses.slice(iLibre + 1)]);
          }
        }
        // 2. Glisser : l'objet qui suit la zone entre plus tôt, ou celui qui la précède entre plus tard (bords seulement).
        const kz = poses.findIndex((p) => p.debut >= z - 0.05);
        if (kz >= 0) {
          for (const debut of [(poses[kz - 1]?.fin ?? 0) + ECART_OBJETS_SEC, a + DIVERSITE.sansEvenementMaxSec - 0.05, milieu]) {
            const n = avecBords(poses[kz], debut, poses[kz].fin);
            if (n) essais.push([...poses.slice(0, kz), n, ...poses.slice(kz + 1)]);
          }
        }
        const ka = poses.findIndex((p) => Math.abs(p.debut - a) < 0.06);
        if (ka >= 0) {
          for (const d of [0.2, 0.4, 0.6]) {
            const n = avecBords(poses[ka], poses[ka].debut + d, poses[ka].fin + d);
            if (n) essais.push([...poses.slice(0, ka), n, ...poses.slice(ka + 1)]);
            // … et l'objet suivant entre juste après lui (deux bords d'un coup).
            const apres = poses[ka + 1];
            const na = n && apres ? avecBords(apres, n.fin + ECART_OBJETS_SEC, apres.fin) : null;
            if (n && na) essais.push([...poses.slice(0, ka), n, na, ...poses.slice(ka + 2)]);
            const n2 = avecBords(poses[ka], poses[ka].debut + d, poses[ka].fin);
            if (n2) essais.push([...poses.slice(0, ka), n2, ...poses.slice(ka + 1)]);
          }
        }
        // 3. Remplacer l'objet en cause par une autre famille (même place dans le temps).
        if (k >= 0) {
          const debut = arrondi(Math.min(poses[k].debut, Math.max((poses[k - 1]?.fin ?? 0) + ECART_OBJETS_SEC, a + 0.1)));
          const limite = arrondi((poses[k + 1]?.debut ?? horizon) - ECART_OBJETS_SEC);
          for (const f of FAMILLES) {
            if (f === poses[k].famille) continue;
            for (const d of [...new Set([debut, poses[k].debut])]) {
              const p = construire[f](d, limite);
              if (p && p.fin <= limite + 1e-6) essais.push([...poses.slice(0, k), p, ...poses.slice(k + 1)]);
            }
          }
        }
        for (const l of essais) {
          if (essayerSuite(l, d0)) {
            ameliore = true;
            break;
          }
        }
        if (ameliore) break;
      }
      if (!ameliore) return;
    }
  }
}
