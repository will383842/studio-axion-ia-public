/**
 * LES PHOTOS ET LOGOS (lot D) — REQUÊTES, PUR.
 *
 * Depuis la `recherche` française d'une fenêtre (« devis papier sur un bureau »), on tire :
 *  - les mots français (Mes images, captures du site : leurs mots-clés sont en français) ;
 *  - 2 ou 3 requêtes anglaises LITTÉRALES (action + sujet + lieu : « job interview manager office ») par le lexique des
 *    scènes de PME ci-dessous (retour de Will du 14/10 : « chaque animation représente ce que la personne dit ») ;
 *  - sans scène reconnue : la requête mot à mot par une petite table du métier d'Axion-IA (expressions d'abord, puis
 *    mots), complétée par la table déjà en service au studio (`domaine/illustrations`) ;
 *  - en dernier recours (aucun mot traduit), les mots français tels quels : la banque fera de son mieux.
 * Et l'ORDRE des sources : Mes images → Pexels → Pixabay → Wikimedia (CC0 / CC-BY) → capture du site. Jamais de banque
 * payante, jamais d'image générée (la liste ci-dessous est FERMÉE : une autre source est ignorée partout dans ce lot).
 */
import { motsAnglais, motsSignificatifs } from "@/domaine/illustrations";

/* ---------------- Sources ---------------- */

/**
 * Les SEULES sources permises, dans l'ordre (règle de Will : Mes images d'abord, rien de payant, rien de généré).
 * Wikimedia Commons sert de repli sans clé, et seulement pour les fichiers CC0 ou CC-BY (licence vérifiée fichier par
 * fichier, voir `choisir.ts`).
 */
export const ORDRE_SOURCES = ["mes-images", "pexels", "pixabay", "wikimedia", "capture-site"] as const;
export type SourceImage = (typeof ORDRE_SOURCES)[number];

/** Une source est-elle permise ? (garde à l'exécution : un adaptateur ne peut pas glisser une banque payante) */
export function sourcePermise(s: string): s is SourceImage {
  return (ORDRE_SOURCES as readonly string[]).includes(s);
}

/** Ce que chaque source sait donner (une capture du site est une image fixe). */
export const GENRES_PAR_SOURCE: Record<SourceImage, readonly ("photo" | "video")[]> = {
  "mes-images": ["video", "photo"],
  pexels: ["video", "photo"],
  pixabay: ["video", "photo"],
  wikimedia: ["video", "photo"],
  "capture-site": ["photo"],
};

/** Sources qui cherchent par requête anglaise (les autres lisent les mots français de la Bibliothèque). */
export const SOURCES_EN_ANGLAIS: readonly SourceImage[] = ["pexels", "pixabay", "wikimedia"];

/**
 * Ordre des sources pour une fenêtre. Quand le réalisateur demande une capture (`capture: true`), la capture du site
 * passe en tête ; Mes images reste devant les banques dans tous les cas.
 */
export function ordreDesSources(f: { capture?: boolean }): SourceImage[] {
  if (!f.capture) return [...ORDRE_SOURCES];
  return ["capture-site", ...ORDRE_SOURCES.filter((s) => s !== "capture-site")];
}

/* ---------------- Traduction mot à mot ---------------- */

/** Expressions entières du métier (cherchées d'abord, sans accents ni apostrophes). */
const EXPRESSIONS: [RegExp, string][] = [
  [/entretien d.?embauche/, "job interview"],
  [/reunion en visio|visio ?conference|appel video/, "video call laptop"],
  [/reunion d.?equipe/, "team meeting"],
  [/rendez.?vous client/, "client meeting"],
  [/travail(ler)? tard|tard le soir/, "working late night office"],
  [/longue journee/, "long workday office"],
  [/week.?end en famille/, "family weekend"],
  [/intelligence artificielle/, "artificial intelligence"],
  [/baguette magique/, "magic wand"],
  [/robinet qui fuit/, "leaking faucet"],
  [/courbe de croissance/, "growth chart"],
  [/pile de dossiers?/, "stack of files"],
  [/billets? et pieces?/, "cash money coins"],
  [/formation en salle/, "training classroom"],
  [/petite entreprise/, "small business"],
  [/grand groupe/, "corporate office building"],
  [/liste de priorites?/, "to do list"],
  [/outils? numeriques?/, "digital tools laptop"],
  [/tableau de chiffres/, "spreadsheet numbers"],
  [/appel telephonique/, "phone call"],
  [/ordinateur portable/, "laptop"],
  [/devis papier/, "paper quote document"],
  [/relance par e.?mail/, "email follow up"],
  [/bureau d.?entreprise/, "company office"],
];

/** Mots courants du métier d'Axion-IA (racine de `motsSignificatifs` : sans accents, pluriel simple retiré). */
const MOTS_METIER: Record<string, string> = {
  dirigeant: "manager",
  patron: "manager",
  equipe: "team",
  salarie: "employees",
  collaborateur: "coworkers",
  entreprise: "office",
  reunion: "meeting",
  visio: "video call",
  embauche: "hiring",
  recrutement: "hiring",
  journee: "workday",
  soir: "evening",
  soiree: "evening",
  tard: "late",
  famille: "family",
  priorite: "priorities",
  croissance: "growth",
  courbe: "chart",
  fuite: "leak",
  robinet: "faucet",
  formation: "training",
  salle: "classroom",
  audit: "audit",
  diagnostic: "analysis",
  numerique: "digital",
  outil: "tools",
  administratif: "paperwork",
  devi: "quote document",
  facture: "invoice",
  relance: "follow up email",
  prospect: "sales call",
  commercial: "sales",
  artisan: "craftsman workshop",
  boulangerie: "bakery",
  restaurant: "restaurant",
  cabinet: "office",
  agence: "agency office",
  artificielle: "artificial intelligence",
  chatgpt: "artificial intelligence laptop",
  automatisation: "automation",
  gain: "time saving",
  stress: "stressed",
  fatigue: "tired",
  bureau: "desk",
  horloge: "wall clock",
  sablier: "hourglass",
  paperasse: "paperwork",
};

export interface RequetesFenetre {
  /** Mots français significatifs (Mes images, captures du site). */
  motsFr: string[];
  /** Requête anglaise des banques (6 mots au plus) : la 1re requête littérale quand le lexique reconnaît la scène. */
  requeteEn: string;
  /** 2 ou 3 requêtes anglaises LITTÉRALES (action + sujet + lieu), de la plus précise à la plus large. */
  litterales: string[];
  /** Faux quand aucun mot n'a pu être traduit : `requeteEn` porte alors les mots français (repli). */
  traduite: boolean;
}

const sansAccents = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ");

/** Traduction mot à mot (sans lexique des scènes). */
function motAMot(recherche: string): string[] {
  let reste = sansAccents(recherche);
  const en: string[] = [];
  for (const [motif, traduction] of EXPRESSIONS) {
    if (!motif.test(reste)) continue;
    en.push(...traduction.split(" "));
    reste = reste.replace(motif, " ");
  }
  for (const m of motsSignificatifs(reste)) {
    const t = Object.hasOwn(MOTS_METIER, m) ? MOTS_METIER[m] : undefined;
    if (t) en.push(...t.split(" "));
    else en.push(...motsAnglais(m)); // table du studio (contrat, facture, calendrier…)
  }
  return Array.from(new Set(en.filter(Boolean)));
}

/** Les requêtes d'une recherche française de fenêtre (`illustre` : les mots exacts dits, en appoint). */
export function requetesDe(recherche: string, illustre?: string): RequetesFenetre {
  const motsFr = motsSignificatifs(recherche);
  const litterales = requetesLitterales(recherche, illustre);
  const uniques = motAMot(recherche);
  if (litterales.length && (scene(recherche) || !uniques.length)) return { motsFr, requeteEn: litterales[0], litterales, traduite: true };
  if (!uniques.length) {
    const brut = motsFr.slice(0, 4).join(" ");
    return { motsFr, requeteEn: brut, litterales: brut ? [brut] : [], traduite: false };
  }
  const requeteEn = uniques.slice(0, 6).join(" ");
  return { motsFr, requeteEn, litterales: Array.from(new Set([requeteEn, ...litterales])).slice(0, 3), traduite: true };
}

/* ---------------- Requêtes LITTÉRALES (mini-vidéos) ---------------- */

/**
 * Une scène = une ACTION filmable, en anglais littéral, avec le sujet et le lieu par défaut et une variante plus large
 * (secours quand la banque a peu de vidéos pour la requête complète). Motifs écrits sans accents ni apostrophes.
 */
export interface ScenePme {
  motif: RegExp;
  action: string;
  sujet?: string;
  lieu?: string;
  variante?: string;
  /**
   * Passe 4 (« ne plus jamais supprimer une fenêtre ») : autres formulations anglaises de la MÊME scène filmable,
   * essayées après les requêtes littérales quand rien ne convient (`requetesElargies`).
   */
  synonymes?: readonly string[];
}

/** Lexique des scènes de PME, de la plus précise à la plus générale (la première qui correspond l'emporte). */
export const LEXIQUE_SCENES: readonly ScenePme[] = [
  { motif: /equipes? en formation|formation (des|de l.?|d.?une) equipes?|form\w* (une|les|ses|nos|des|vos|son|leur) equipes?|format(eur|rice)/, action: "corporate training", sujet: "team", lieu: "office", variante: "team training workshop", synonymes: ["employees training seminar", "presentation to team office", "teacher explaining adults classroom"] },
  // Passe 3 : scènes du texte de la vidéo 3 que le lexique ne savait pas filmer (« chart », « manager » seuls).
  { motif: /tableau blanc|paperboard|whiteboard/, action: "writing on whiteboard", lieu: "office", variante: "whiteboard presentation" },
  { motif: /one.?to.?one|tete.?a.?tete|rendez.?vous individuel|entretien individuel/, action: "one-on-one meeting", lieu: "office", variante: "two business people talking", synonymes: ["mentoring session office", "business coaching session", "consultant advising client"] },
  // Passe 4 : scènes de la vidéo 4 cherchées avec « manager desk », « desk », « paperwork desk » (fenêtres supprimées).
  { motif: /accompagn\w*|conseill\w* (un|une|le|la|les|des|son|sa|ses|leur) |coach\w*|mentor\w*/, action: "business coaching", lieu: "office", variante: "consultant advising client", synonymes: ["mentor talking to manager", "two colleagues discussing laptop", "business consultant meeting client"] },
  { motif: /commenc\w* (un|une|le|la) (rendez.?vous|reunion|diagnostic|entretien|seance)|propos\w* (un|une|le|la) (plan|rendez.?vous|diagnostic)/, action: "business meeting", sujet: "consultant", lieu: "office", variante: "consultant meeting client", synonymes: ["two business people talking office", "client meeting table office"] },
  { motif: /(cherch|trouv|traqu|detect|repere)\w* (la|une|les|des) (fuite|perte)s? (dans|de) (les|des|ses|leurs|la|sa) (comptes|dossiers?|chiffres|documents?|comptabilite)/, action: "reviewing financial documents", sujet: "consultant", lieu: "office", variante: "examining paperwork", synonymes: ["accountant checking documents", "business people reviewing papers"] },
  { motif: /(examin|verifi|epluch|inspect|controle|scrut)\w* (les|des|ses|leurs|un|une|le|la) (documents?|dossiers?|comptes|papiers?|factures?|chiffres)/, action: "reviewing documents", lieu: "office", variante: "examining paperwork", synonymes: ["checking documents office", "accountant reviewing papers"] },
  { motif: /(tri|class|rang|archiv)\w* (des|les|ses|de|leurs) (papiers?|documents?|dossiers?|feuilles)/, action: "sorting documents", lieu: "office", variante: "filing papers", synonymes: ["organizing files office", "woman sorting papers desk"] },
  { motif: /regard\w* (sa|la|leur|son) montre|regard\w* l.?heure/, action: "checking watch", sujet: "businessman", lieu: "office", variante: "businessman checking watch", synonymes: ["man looking at watch hurry"] },
  { motif: /\bpress(e|ee|es|ees)\b|cour(t|ent|ir) (dans|apres|vers|entre|contre)|march\w* vite|se depech\w*|en retard/, action: "businessman in a hurry", lieu: "office", variante: "man walking fast", synonymes: ["rushing to work", "busy businessman walking", "woman walking fast corridor"] },
  { motif: /(deux|2) (personnes|collegues|hommes|femmes).{0,30}(discut|parl|echang)\w*|discut\w* (face a face|en tete.?a.?tete)|conversation (a deux|en tete)/, action: "two people talking", lieu: "office", variante: "business conversation", synonymes: ["colleagues discussing office", "business conversation table"] },
  { motif: /quitt\w* (le|leur|son) bureau|sort\w* du bureau|rentr\w* chez (eux|lui|elle|soi)|fin de (la )?journee/, action: "employees leaving office", variante: "people leaving work", synonymes: ["colleagues leaving office", "people walking out of office building", "coworkers going home"] },
  { motif: /\baudit\w*|analys\w* (les|des|ses|leurs) (donnees|chiffres|processus)/, action: "analyzing data laptop", sujet: "consultant", lieu: "office", variante: "business analysis computer", synonymes: ["consultant reviewing documents laptop", "audit documents office", "business analysis meeting"] },
  { motif: /(\blit\b|\blis\w*|regard\w*).{0,40}(ordinateur|ecran)/, action: "reading laptop screen", sujet: "businessman", lieu: "office", variante: "man looking at laptop" },
  { motif: /travail\w* seul|seul (au|a son|dans son) bureau/, action: "working alone laptop", sujet: "businessman", lieu: "office", variante: "man working on computer" },
  { motif: /plombier|(repar|trouv|cherch|detect|localis)\w* (une|la|les|cette|des) fuites?|colmat\w*/, action: "plumber fixing leak", sujet: "plumber", lieu: "under sink", variante: "plumber repairing pipe" },
  { motif: /tableau de bord.{0,40}ordinateur portable|ordinateur portable.{0,40}tableau de bord|(ou|comment) part\w* (le|leur|son|votre|notre) temps|suivi du temps|temps passe (sur|a)/, action: "analyzing data laptop", sujet: "businessman", lieu: "office", variante: "laptop dashboard analytics" },
  { motif: /gouttes? d.?eau|fuite (d.?eau|dans|au|sous)/, action: "water leak dripping", variante: "water drop falling" },
  { motif: /entretien d.?embauche|entretien de recrutement|passer un entretien|recrut\w*/, action: "job interview", sujet: "manager", lieu: "office", variante: "job interview candidate", synonymes: ["hiring interview office", "recruiter interviewing candidate", "candidate interview manager"] },
  { motif: /temps qui (s.?echappe|file|passe)|(le|du) temps (vous|nous|leur|lui|m|t) ?echappe|courir apres le temps|manqu\w* de temps/, action: "checking watch", sujet: "businessman", lieu: "office", variante: "busy manager working late", synonymes: ["businessman checking watch", "busy businessman walking", "rushing to work"] },
  { motif: /signature (d.?un |du |de |des )?contrats?|sign\w* (un |le |son |les |des )?contrats?|contrat signe/, action: "signing contract", sujet: "hands", lieu: "desk", variante: "contract signature" },
  { motif: /tap\w* (au|sur (le|un|son)) clavier|clavier|saisi\w* (de |des )?donnees/, action: "typing keyboard", sujet: "hands", lieu: "office", variante: "typing on laptop" },
  { motif: /reunion en visio|visio ?conference|appel video|en visio/, action: "video call", sujet: "laptop", lieu: "office", variante: "video conference" },
  { motif: /appel telephonique|au telephone|coup de (fil|telephone)|telephon\w*|rappel\w* (un|le|son|ses|des) clients?/, action: "phone call", sujet: "businessman", lieu: "office", variante: "talking on phone", synonymes: ["woman talking on phone office", "using smartphone office"] },
  { motif: /reunions?|point d.?equipe|seminaire/, action: "team meeting", lieu: "office", variante: "business meeting", synonymes: ["business meeting conference room", "coworkers discussion office"] },
  { motif: /open.?space|grands? groupes?|grande entreprise/, action: "busy open space office", variante: "office workers open space", synonymes: ["coworkers busy office", "corporate office employees"] },
  { motif: /poignee de main|serr\w* la main/, action: "handshake", sujet: "business", lieu: "office", variante: "business handshake" },
  { motif: /boite (mail|e.?mail|de reception)|e.?mails? (non lus|en attente)|mails? qui s.?entassent|courriels?/, action: "email inbox", sujet: "laptop screen", variante: "checking email" },
  { motif: /tableau de bord|indicateurs|statistiques|reporting/, action: "dashboard analytics", sujet: "computer screen", variante: "business analytics" },
  { motif: /famille (le|au|du|en) week.?end|week.?end en famille|temps en famille|avec (sa|ses|leur) (famille|enfants)/, action: "family weekend", lieu: "home", variante: "family together", synonymes: ["father playing with kids park", "family walking park"] },
  { motif: /factures?/, action: "invoice paperwork", lieu: "desk", variante: "paying bills" },
  { motif: /devis/, action: "paper quote document", lieu: "desk", variante: "business document" },
  { motif: /paperasse|pile de dossiers?|dossiers? empiles|tas de papiers?|administratif/, action: "paperwork stack", lieu: "office", variante: "pile of documents" },
  { motif: /livraison|livreur|colis|expedi\w*/, action: "delivery package", sujet: "courier", variante: "parcel delivery" },
  { motif: /chantier/, action: "construction worker", lieu: "construction site", variante: "building site" },
  { motif: /atelier|artisan au travail|etabli/, action: "craftsman working", lieu: "workshop", variante: "workshop tools", synonymes: ["carpenter workshop", "artisans working together workshop"] },
  { motif: /horloge|pendule/, action: "wall clock", variante: "clock ticking" },
  { motif: /sablier/, action: "hourglass sand", lieu: "desk", variante: "hourglass time" },
  { motif: /robinet|fuite d.?eau|goutte a goutte|qui fuit/, action: "leaking faucet", variante: "water dripping tap" },
  { motif: /calculatrice|fai\w* (les|ses) comptes|comptabilite/, action: "calculator accounting", sujet: "hands", lieu: "desk", variante: "doing accounts" },
  { motif: /bureau (la|de) nuit|bureau.{0,24}(soir|nuit)|travail\w* (tard|la nuit|le soir)|tard le soir|tard (au|du) bureau|tard (dans|a) (son|le|leur|un|sa) bureau|prolong\w* (ses|leurs|sa|nos|vos) journees?|fini\w* (ses|sa|leurs) journees? tard|heures sup/, action: "working late", lieu: "office", variante: "office at night", synonymes: ["businessman working late night", "man laptop night office", "tired worker evening office"] },
  { motif: /agenda|calendrier|planning/, action: "writing in planner", sujet: "hands", lieu: "desk", variante: "calendar planner" },
  { motif: /entrepot|inventaire/, action: "warehouse inventory", lieu: "warehouse", variante: "warehouse worker" },
  { motif: /formation|former (son|ses|l.?)|form\w* (des|les|ses) (salaries|employes|collaborateurs)/, action: "training session", lieu: "classroom", variante: "workshop training", synonymes: ["employees training seminar", "teacher explaining adults classroom"] },
  { motif: /caisse|encaiss\w*|paiement/, action: "card payment", lieu: "shop", variante: "cash register" },
  { motif: /cuisine|cuisin\w*|restaurant/, action: "chef cooking", lieu: "kitchen", variante: "restaurant kitchen" },
  { motif: /intelligence artificielle|chatgpt|\bia\b|automatis\w*/, action: "artificial intelligence", sujet: "laptop", variante: "automation technology" },
  { motif: /courbe|croissance|chiffre d.?affaires/, action: "growth chart", sujet: "screen", variante: "rising graph" },
  { motif: /argent|billets|tresorerie/, action: "counting money", sujet: "hands", variante: "cash money" },
];

/** Sujets (qui fait l'action). */
const SUJETS: [RegExp, string][] = [
  [/dirigeant|patron|chef d.?entreprise|gerant|directeur|entrepreneur/, "manager"],
  [/artisan|plombier|electricien|menuisier/, "craftsman"],
  [/salarie|employe|collaborat\w*|secretaire|assistante?/, "employee"],
  [/comptable/, "accountant"],
  [/consultante?/, "consultant"],
  [/format(eur|rice)/, "trainer"],
  [/commercia\w*|vendeu\w*/, "salesman"],
  [/equipe/, "team"],
  [/clients?/, "customer"],
  [/enfants?/, "kids"],
];

/** États du sujet (dits devant lui en anglais). */
const ETATS: [RegExp, string][] = [
  [/debord\w*|submerg\w*|surcharg\w*|noye/, "overwhelmed"],
  [/stress\w*/, "stressed"],
  [/fatigu\w*|epuis\w*/, "tired"],
  [/soulag\w*|heureu\w*/, "happy"],
];

/** Lieux (où). « sur un bureau » est un meuble (desk), « au bureau » un lieu (office). */
const LIEUX: [RegExp, string][] = [
  [/sur (un|le|son|mon|votre) bureau/, "desk"],
  [/bureau/, "office"],
  [/atelier/, "workshop"],
  [/entrepot/, "warehouse"],
  [/chantier/, "construction site"],
  [/maison|domicile|salon/, "home"],
  [/cuisine/, "kitchen"],
  [/magasin|boutique|commerce/, "shop"],
  [/voiture|camion/, "car"],
  [/parc|jardin/, "park"],
];

/** Qualité du lieu (dite devant lui) et moment (dit après) : « bureau vide le soir » → « empty office night ». */
const QUALITES: [RegExp, string][] = [[/\bvides?\b|desert/, "empty"]];
const MOMENTS: [RegExp, string][] = [[/la nuit|le soir|tard|nocturne/, "night"]];

const premier = (table: [RegExp, string][], texte: string) => table.find(([m]) => m.test(texte))?.[1];

/** Mots uniques, dans l'ordre, 6 au plus. */
function assembler(parties: (string | undefined)[], max = 6): string {
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const p of parties)
    for (const m of (p ?? "").split(" "))
      if (m && !vus.has(m)) {
        vus.add(m);
        sortie.push(m);
      }
  return sortie.slice(0, max).join(" ");
}

/** La scène de PME reconnue dans un texte français (null : rien dans le lexique). */
export function scene(texte: string): ScenePme | null {
  const t = sansAccents(texte);
  return LEXIQUE_SCENES.find((s) => s.motif.test(t)) ?? null;
}

/**
 * 2 ou 3 requêtes anglaises LITTÉRALES, de la plus précise à la plus large :
 *  1) action + sujet + moment + lieu (« dirigeant qui fait passer un entretien d'embauche » → « job interview manager office ») ;
 *  2) action + sujet (ou lieu) ;
 *  3) la variante large de la scène.
 * Le sujet dit remplace le sujet par défaut de la scène ; un état (« débordé ») le précède. Sans scène reconnue (ni
 * dans la recherche ni dans les mots dits) : la traduction mot à mot, entière puis réduite.
 */
export function requetesLitterales(recherche: string, illustre?: string): string[] {
  // Passe 3 (revue passe 2, point 2) : la requête se construit à partir de la SCÈNE DEMANDÉE (`recherche`, écrite par
  // le réalisateur pour être filmable), jamais de la phrase de Will (« chaque jour, sans bruit » → une fenêtre floue ;
  // « trouver la fuite » → un clavier). Les mots dits (`illustre`) ne servent que si la recherche ne dit rien au lexique
  // ni à la traduction ; la littéralité vis-à-vis des mots dits est jugée ensuite, sur l'image (`verification.ts`).
  const sR = scene(recherche);
  if (sR) return requetesScene(sR, sansAccents(recherche));
  const en = motAMot(recherche);
  if (en.length) return Array.from(new Set([en.slice(0, 5).join(" "), en.slice(0, 3).join(" "), en.slice(0, 2).join(" ")])).filter(Boolean).slice(0, 3);
  const sI = illustre ? scene(illustre) : null;
  return sI ? requetesScene(sI, sansAccents(illustre ?? "")) : [];
}

/**
 * Passe 4 — RECHERCHE ÉLARGIE (rien ne convenait avec les requêtes littérales) : les synonymes de la scène reconnue
 * dans la recherche, puis la scène reconnue dans les MOTS DITS (si elle diffère) et ses synonymes, puis l'action seule.
 * Toujours de l'anglais filmable, 6 mots au plus ; jamais une requête déjà essayée (`requetesLitterales`).
 */
export function requetesElargies(recherche: string, illustre?: string): string[] {
  const deja = new Set(requetesLitterales(recherche, illustre));
  const sR = scene(recherche);
  const sI = illustre ? scene(illustre) : null;
  const ext: string[] = [...(sR?.synonymes ?? [])];
  if (sI && sI !== sR) ext.push(...requetesScene(sI, sansAccents(illustre ?? "")), ...(sI.synonymes ?? []));
  if (sR) ext.push(sR.action);
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const q of ext.map((x) => assembler([x]))) {
    if (!q || deja.has(q) || vus.has(q)) continue;
    vus.add(q);
    sortie.push(q);
  }
  return sortie.slice(0, 6);
}

/** Les 2 ou 3 requêtes d'une scène reconnue, sujet / état / lieu / moment lus dans le texte `t` (sans accents). */
function requetesScene(s: ScenePme, t: string): string[] {
  const etat = premier(ETATS, t);
  const sujetDit = premier(SUJETS, t);
  // Les sujets « objets » (mains, écran) restent ; un état sans sujet dit qualifie une personne.
  const sujetObjet = s.sujet && /hands|screen|laptop|business|courier/.test(s.sujet);
  const sujet = sujetDit ?? (etat && !sujetObjet ? "manager" : s.sujet);
  const sujetComplet = assembler([etat, sujet]);
  const lieu = premier(LIEUX, t) ?? s.lieu;
  const complete = assembler([s.action, sujetComplet, premier(QUALITES, t), lieu, premier(MOMENTS, t)]);
  const moyenne = assembler([s.action, sujetComplet || lieu]);
  const large = s.variante ?? s.action;
  const r = Array.from(new Set([complete, moyenne, large].filter(Boolean)));
  if (r.length < 2) r.push(assembler([s.action, "closeup"]));
  return r.slice(0, 3);
}
