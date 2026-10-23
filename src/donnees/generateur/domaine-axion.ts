/**
 * LE DOMAINE D'AXION-IA (addendum du 02/10, §2 quater, ordre de Will du 03/10 ; lot G4). PUR.
 *
 * Le « type avocat » est un STYLE de vidéo, jamais un contenu juridique : chaque sujet parle d'Axion-IA et de ses clients.
 * Source : `Axion-IA/OFFRE-CLIENT-AXION-IA.md` (« Nous installons l'IA dans votre entreprise pour vous faire gagner du
 * temps et de l'argent »), lignes 9-46 (cinq façons de travailler) et 119-137 (catalogue des automatisations par
 * fonction). AUCUN prix n'est repris ici.
 *
 * Ces piliers sont PROPOSÉS (migration idempotente, `ContexteAxion.piliersProposes`) : ils ne deviennent les thèmes de
 * Will qu'après son toucher. L'étape 0 (gratuite) rattache chaque sujet à un pilier (validés d'abord, sinon proposés) ;
 * sans rattachement : arrêt « Hors du domaine d'Axion-IA », le pilier le plus proche proposé, 0 €.
 */
import type { ContexteAxion } from "@/domaine/types";

export const PILIERS_ACTIVITES_AXION: ContexteAxion["piliers"] = [
  { id: "former-equipes-ia", nom: "Former vos équipes à l'IA", motsCles: ["formation", "former", "formateur", "apprendre", "atelier", "equipe", "equipes", "salaries", "collaborateurs", "chatgpt", "prompt", "copilot", "intelligence artificielle", "ia"] },
  { id: "audit-ia", nom: "Savoir quoi automatiser (audit)", motsCles: ["audit", "diagnostic", "quoi automatiser", "par ou commencer", "priorite", "priorites", "taches repetitives", "temps perdu", "gagner du temps"] },
  { id: "automatiser-service-client", nom: "Automatiser : service et relation client", motsCles: ["service client", "relation client", "chatbot", "standard telephonique", "satisfaction", "avis clients", "centre d'aide", "repondre aux mails", "tri des mails"] },
  { id: "automatiser-ventes", nom: "Automatiser : ventes et prospection", motsCles: ["devis", "prospection", "prospect", "prospects", "leads", "lead", "relance", "relances", "pipeline", "commercial", "commerciaux", "signature", "linkedin"] },
  { id: "automatiser-marketing", nom: "Automatiser : marketing et communication", motsCles: ["marketing", "newsletter", "posts", "reseaux sociaux", "articles", "seo", "visuels", "publicite", "pubs"] },
  { id: "automatiser-administratif", nom: "Automatiser : administratif et back-office", motsCles: ["administratif", "back-office", "factures", "facture", "saisie", "ressaisie", "ressaisir", "recopier", "pieces jointes", "contrats", "bons de commande", "pdf", "rapprochement bancaire", "comptes-rendus", "compte rendu", "copier coller", "excel"] },
  { id: "automatiser-rh", nom: "Automatiser : ressources humaines", motsCles: ["rh", "recrutement", "cv", "candidats", "candidat", "onboarding", "conges", "plannings", "fiches de poste", "procedures rh"] },
  { id: "automatiser-donnees-pilotage", nom: "Automatiser : données et pilotage", motsCles: ["tableau de bord", "tableaux de bord", "excel", "tableur", "tableurs", "donnees", "chiffres", "pilotage", "piloter", "indicateurs", "indicateur", "previsions", "anomalies", "reporting", "rapports", "synthese", "fichiers"] },
  { id: "automatiser-metier", nom: "Automatiser : métier et production", motsCles: ["chantier", "chiffrage", "production", "controle qualite", "tournees", "maintenance", "stocks", "stock", "documentation technique"] },
  { id: "automatiser-communication-interne", nom: "Automatiser : communication interne", motsCles: ["communication interne", "recherche interne", "bot interne", "traduction", "faq interne", "procedures qualite", "decisions"] },
  { id: "accompagnement-dirigeant", nom: "Accompagnement individuel du dirigeant", motsCles: ["dirigeant", "dirigeants", "accompagnement", "un-a-un", "coaching", "patron", "chef d'entreprise"] },
  { id: "sites-logiciels-ia", nom: "Sites et logiciels dopés à l'IA", motsCles: ["site", "site web", "saas", "logiciel", "application", "plateforme", "console"] },
];

function normaliser(t: string): string {
  return ` ${t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\b(l|d|j|m|n|s|t|c|qu)'/g, "$1 ")
    .replace(/[^a-z0-9' -]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((m) => (m.length > 3 ? m.replace(/(s|x)$/, "") : m))
    .join(" ")} `;
}

/** Termes d'une liste présents dans un texte (mots entiers, pluriels ramenés, accents et élisions ignorés). */
function trouver(texte: string, termes: readonly string[]): string[] {
  const t = normaliser(texte);
  return [...new Set(termes.filter((m) => t.includes(normaliser(m))).map((m) => normaliser(m).trim()))];
}

/** Score d'un pilier sur un texte : nombre de mots-clés présents (mots entiers, pluriels ramenés). */
export function scorePilier(texte: string, pilier: { motsCles: string[] }): number {
  return trouver(texte, pilier.motsCles).length;
}

/**
 * MOTS D'ACTIVITÉ d'Axion-IA (ordre de Will du 03/10 : un sujet se rattache par le SENS, jamais par un mot isolé).
 * Un mot générique (« dirigeant », « équipe », « site », « chiffres », « fichiers », « décisions »…) ne compte JAMAIS.
 * - FORTS (2 points) : ils disent à eux seuls ce qu'Axion fait (IA, automatisation, logiciels, process d'entreprise).
 * - FAIBLES (1 point) : ils n'en parlent que dans un cadre d'entreprise (« planning », « procédure », « atelier »,
 *   « diagnostic », « facture »… : « le planning des repas » ou « le diagnostic immobilier » ne sont pas des sujets).
 * - CONTEXTE D'ENTREPRISE : ne compte jamais seul ; ajoute 1 point à un mot faible.
 * Il faut au moins 2 points (un mot fort, deux faibles, ou un faible dans un cadre d'entreprise).
 */
export const MOTS_ACTIVITE_FORTS: readonly string[] = [
  "ia", "intelligence artificielle", "chatgpt", "gpt", "copilot", "prompt", "agent ia", "agents ia", "chatbot", "assistant ia", "assistant virtuel", "modele de langage", "llm", "machine learning",
  "automatiser", "automatise", "automatisee", "automatisation", "workflow", "zapier", "n8n", "api",
  "base de donnees", "tableau de bord", "tableaux de bord", "reporting", "kpi", "excel", "tableur", "google sheets", "crm", "erp", "logiciel", "saas", "site web", "site internet", "digitaliser", "digitalisation", "dematerialiser", "dematerialisation", "ocr",
  "ressaisie", "ressaisir", "recopier", "recopie", "copier coller", "copier-coller", "taches repetitives", "tache repetitive", "prospection", "prospects", "leads", "comptes rendus", "compte rendu", "comptes-rendus", "bons de commande", "bon de commande", "rapprochement bancaire", "tri des cv", "service client", "relation client", "support client", "centre d'aide", "standard telephonique", "back-office", "base de connaissances", "documentation technique", "maintenance predictive", "onboarding", "seo",
];
export const MOTS_ACTIVITE_FAIBLES: readonly string[] = [
  "robot", "bot", "algorithme", "automatique", "automatiquement", "claude", "mistral", "gemini", "integration", "synchroniser", "synchronisation",
  "donnees", "indicateurs", "outil", "outils", "application", "appli", "plateforme", "numerique", "digital", "pdf", "mails", "e-mails", "emails", "boite mail", "messagerie",
  "processus", "procedure", "saisie", "a la main", "cv", "candidat", "candidats", "temps perdu", "gagner du temps", "productivite", "devis", "facture", "facturation", "relance", "relancer", "pipeline", "recrutement", "planning", "newsletter", "administratif", "paperasse", "documentation", "veille", "traduction", "transcription", "chiffrage", "stocks", "inventaire", "controle qualite", "linkedin", "marketing", "reseaux sociaux",
  "formation", "former", "formateur", "atelier", "monter en competence", "competences", "acculturation", "accompagnement", "audit", "diagnostic", "transformation",
];
/**
 * OUTILS (E2E-2 parcours n° 10) : des mots d'activité qui disent l'OUTIL, pas le travail d'une entreprise. Un sujet qui
 * n'a QUE des outils (« Automatiser avec Excel la déclaration d'impôts de mon foyer », « Le CRM idéal pour mon club de
 * pétanque ») ne parle pas d'Axion-IA : il lui faut un cadre d'entreprise, un geste de métier (relance, saisie, devis…)
 * ou, au moins, de s'adresser au spectateur (« vos fichiers Excel ») sans parler de soi (« mon », « ma », « mes »).
 */
export const MOTS_OUTILS: readonly string[] = [
  "ia", "intelligence artificielle", "chatgpt", "gpt", "copilot", "prompt", "agent ia", "agents ia", "chatbot", "assistant ia", "assistant virtuel", "modele de langage", "llm", "machine learning",
  // Outils grand public seulement : « tableau de bord », « CRM », « ERP », « reporting » disent déjà l'entreprise.
  "automatiser", "automatise", "automatisee", "automatisation", "workflow", "zapier", "n8n", "api", "excel", "tableur", "google sheets", "logiciel", "site web", "site internet",
  "robot", "bot", "algorithme", "automatique", "automatiquement", "claude", "mistral", "gemini", "integration", "synchroniser", "synchronisation", "donnees", "outil", "outils", "application", "appli", "plateforme", "numerique", "digital", "pdf",
];

/** Tous les mots d'activité (forts et faibles). */
export const MOTS_ACTIVITE_AXION: readonly string[] = [...MOTS_ACTIVITE_FORTS, ...MOTS_ACTIVITE_FAIBLES];
export const MOTS_CONTEXTE_ENTREPRISE: readonly string[] = [
  "entreprise", "entreprises", "pme", "tpe", "eti", "startup", "societe", "boite", "cabinet", "agence", "equipe", "equipes", "salaries", "salarie", "collaborateurs", "employes", "dirigeant", "dirigeants", "patron", "chef d'entreprise", "manager", "managers", "daf", "drh", "rh", "direction",
  "commerciaux", "commercial", "client", "clients", "fournisseur", "fournisseurs", "comptable", "comptabilite", "service", "metier", "bureau", "chantier", "technicien", "techniciens", "artisan", "artisans", "industrie", "usine", "magasin", "boutique", "commerce", "commercant", "restaurant", "hotel", "collectivite", "association", "b2b", "chiffre d'affaires",
];

/**
 * DOMAINES ÉTRANGERS (3 points par terme) : le sujet sort du domaine d'Axion-IA quand l'un d'eux PRÉDOMINE (autant de
 * points ou plus que l'activité), ou dès qu'il est présent sans aucun cadre d'entreprise (« un prompt ChatGPT pour faire
 * annuler une amende » : le sujet est l'amende, pas l'IA). Le droit est un STYLE pour Axion (type avocat), jamais un
 * contenu. « avocat » n'y figure pas : « l'IA dans un cabinet d'avocats » est un sujet d'Axion.
 */
export const DOMAINES_ETRANGERS: readonly { id: string; nom: string; mots: readonly string[] }[] = [
  {
    id: "droit",
    nom: "le droit et les démarches des particuliers",
    mots: [
      "pv", "p v", "proces-verbal", "proces verbal", "amende", "contravention", "verbalise", "stationnement", "fourriere", "radar", "flashe", "exces de vitesse", "permis de conduire", "permis a point", "points de permis", "retrait de permis", "code de la route", "auto-ecole", "constat amiable", "assurance auto", "accident de voiture",
      "contester", "contestation", "faire annuler", "tribunal", "juge", "plainte", "porter plainte", "prud'hommes", "prudhommes", "licenciement", "licencie", "rupture conventionnelle", "droit du travail",
      "divorce", "garde des enfants", "pension alimentaire", "heritage", "succession", "testament", "notaire", "bail", "loyer", "locataire", "proprietaire", "expulsion", "voisin", "voisinage", "garde a vue", "casier judiciaire",
      "c'est legal", "est-ce legal", "est-il legal", "legal", "illegal", "a-t-il le droit", "ont-ils le droit", "mon employeur", "mon patron", "mon chef", "mon manager", "geolocaliser", "vie privee",
    ],
  },
  { id: "cuisine", nom: "la cuisine", mots: ["recette", "cuisine", "cuisiner", "plat", "gateau", "dessert", "patisserie", "menu de la semaine", "repas", "apero", "barbecue", "vin", "cocktail"] },
  { id: "fete", nom: "les fêtes et la vie privée", mots: ["mariage", "anniversaire", "bapteme", "fiancailles", "noel en famille", "cadeau", "rencontre amoureuse", "couple", "seduction", "mon ex", "son ex", "enfant", "enfants", "adoption", "fin de vie"] },
  { id: "sante", nom: "la santé et le sport", mots: ["regime", "maigrir", "perdre du poids", "minceur", "transformation physique", "musculation", "sport", "jogging", "yoga", "medecin", "maladie", "symptome", "grossesse", "bebe", "allergie"] },
  { id: "loisirs", nom: "les loisirs", mots: ["vacances", "voyage", "plage", "camping", "jardinage", "jardin", "potager", "bricolage", "decoration", "maquillage", "coiffure", "football", "match", "jeux video", "chien", "chat", "animaux"] },
  { id: "argent-perso", nom: "l'argent personnel", mots: ["bitcoin", "crypto", "cryptomonnaie", "bourse", "trading", "pari sportif", "paris sportifs", "loto", "casino", "horoscope", "astrologie", "tarot", "immobilier", "maison", "electricite"] },
  { id: "societe", nom: "la politique et la religion", mots: ["election", "president de la republique", "parti politique", "religion", "eglise", "mosquee", "manifestation", "greve"] },
  {
    id: "vie-perso",
    nom: "la vie personnelle",
    mots: [
      "foyer", "ma famille", "en famille", "mes enfants", "mon fils", "ma fille", "ma femme", "mon mari", "mes parents", "courses de la semaine", "liste de courses", "faire ses courses", "faire mes courses",
      "declaration d'impot", "declaration d'impots", "impot sur le revenu", "impots de mon", "playlist", "spotify", "netflix", "tinder", "site de rencontre", "petanque", "club de foot",
      "mon cv", "trouver un emploi", "chercher un emploi", "recherche d'emploi", "demandeur d'emploi", "pole emploi", "france travail", "arrosage", "budget familial", "mes economies",
    ],
  },
];

const POIDS_FORT = 2;
const POIDS_ETRANGER = 3;
/** Points d'activité qu'il faut au moins pour qu'un sujet parle d'Axion-IA (sans pilier choisi par Will). */
export const SEUIL_ACTIVITE = 2;

export type LectureDuSens = {
  /** Mots d'activité trouvés (forts puis faibles). */
  activite: string[];
  forts: string[];
  faibles: string[];
  contexte: string[];
  /** Points d'activité (forts × 2 + faibles + 1 si un faible est dans un cadre d'entreprise). */
  points: number;
  etranger: { id: string; nom: string; mots: string[]; points: number } | null;
  /** E2E-2 parcours n° 10 : un geste de métier (pas seulement un outil) est présent. */
  metier: boolean;
  /** Le sujet parle de soi (« mon », « ma », « mes », « je ») / s'adresse au spectateur (« vous », « vos »). */
  personnel: boolean;
  spectateur: boolean;
};

/** Le sens d'un texte : mots d'activité d'Axion trouvés, cadre d'entreprise, domaine étranger le plus présent. */
export function lectureDuSens(texte: string): LectureDuSens {
  const forts = trouver(texte, MOTS_ACTIVITE_FORTS);
  // Un mot faible contenu dans un mot fort trouvé (« documentation » dans « documentation technique ») ne compte pas deux fois.
  const faibles = trouver(texte, MOTS_ACTIVITE_FAIBLES).filter((f) => !forts.some((x) => ` ${x} `.includes(` ${f} `)));
  const contexte = trouver(texte, MOTS_CONTEXTE_ENTREPRISE);
  const points = POIDS_FORT * forts.length + faibles.length + (faibles.length && contexte.length ? 1 : 0);
  const etrangers = DOMAINES_ETRANGERS.map((d) => {
    const mots = trouver(texte, d.mots);
    return { id: d.id, nom: d.nom, mots, points: POIDS_ETRANGER * mots.length };
  })
    .filter((d) => d.mots.length > 0)
    .sort((a, b) => b.points - a.points);
  const outils = new Set(MOTS_OUTILS.map((m) => normaliser(m).trim()));
  const metier = [...forts, ...faibles].some((m) => !outils.has(m));
  const brut = ` ${texte.toLowerCase().replace(/[’']/g, "' ")} `;
  const personnel = /[\s(«"](mon|ma|mes|moi|je|j'|perso|personnel|personnelle)[\s,.!?»"):]/.test(brut);
  const spectateur = /[\s(«"](vous|votre|vos)[\s,.!?»"):]/.test(brut);
  return { activite: [...forts, ...faibles], forts, faibles, contexte, points, etranger: etrangers[0] ?? null, metier, personnel, spectateur };
}

export type Rattachement =
  | { ok: true; pilierId: string; nom: string; source: "brief" | "valide" | "propose" }
  | { ok: false; plusProche: { id: string; nom: string }; raison: "sans-activite" | "domaine-etranger"; domaineEtranger?: string };

/**
 * Rattache un sujet au domaine d'Axion-IA PAR LE SENS (ordre de Will du 03/10) :
 * 1. un domaine étranger qui PRÉDOMINE (autant de points ou plus que l'activité), ou présent sans aucun cadre
 *    d'entreprise : hors du domaine, MÊME avec un pilier choisi ;
 * 2. un pilier choisi par Will (brief) : rattaché ;
 * 3. moins de 2 points d'activité (un mot fort, deux faibles, ou un faible dans un cadre d'entreprise) : hors du domaine ;
 *    de même pour des OUTILS seuls (IA, Excel, CRM…) sans cadre d'entreprise ni geste de métier, sauf s'ils
 *    s'adressent au spectateur (« vos fichiers Excel ») ; s'ils parlent de soi (« mon foyer »), même un pilier choisi
 *    ne les fait pas passer (E2E-2 parcours n° 10) ;
 * 4. sinon : le meilleur pilier VALIDÉ, puis le meilleur pilier PROPOSÉ, puis l'audit.
 * En cas de doute : arrêt gratuit, le pilier le plus proche proposé.
 */
export function rattacherAuDomaine(texte: string, piliers: { valides: ContexteAxion["piliers"]; proposes?: ContexteAxion["piliers"] }, pilierDuBrief?: string): Rattachement {
  const tous = [...piliers.valides, ...(piliers.proposes ?? []), ...PILIERS_ACTIVITES_AXION];
  const meilleur = (liste: ContexteAxion["piliers"]) =>
    liste
      .map((p) => ({ p, s: scorePilier(texte, p) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)[0]?.p;
  const audit = PILIERS_ACTIVITES_AXION.find((p) => p.id === "audit-ia")!;
  const proche = (pilierDuBrief ? tous.find((x) => x.id === pilierDuBrief) : undefined) ?? meilleur([...PILIERS_ACTIVITES_AXION]) ?? audit;
  const plusProche = { id: proche.id, nom: proche.nom };
  const sens = lectureDuSens(texte);
  if (sens.etranger && (sens.etranger.points >= sens.points || !sens.contexte.length)) return { ok: false, plusProche, raison: "domaine-etranger", domaineEtranger: sens.etranger.nom };
  // E2E-2 parcours n° 10 : des outils seuls, sans cadre d'entreprise ni geste de métier, ne font pas un sujet.
  const outilsSeuls = sens.points > 0 && !sens.contexte.length && !sens.metier;
  if (outilsSeuls && sens.personnel) return { ok: false, plusProche, raison: "sans-activite" };
  if (pilierDuBrief) {
    const p = tous.find((x) => x.id === pilierDuBrief);
    if (p) return { ok: true, pilierId: p.id, nom: p.nom, source: "brief" };
  }
  if (sens.points < SEUIL_ACTIVITE || (outilsSeuls && !sens.spectateur)) return { ok: false, plusProche, raison: "sans-activite" };
  const valide = meilleur(piliers.valides);
  if (valide) return { ok: true, pilierId: valide.id, nom: valide.nom, source: "valide" };
  const propose = meilleur([...(piliers.proposes ?? []), ...PILIERS_ACTIVITES_AXION]);
  if (propose) return { ok: true, pilierId: propose.id, nom: propose.nom, source: "propose" };
  // De l'activité sans pilier précis : l'audit (« savoir quoi automatiser ») est la porte d'entrée de toute demande.
  return { ok: true, pilierId: audit.id, nom: audit.nom, source: "propose" };
}

/** Phrase de l'arrêt gratuit « Hors du domaine » (la même partout). */
export function phraseHorsDomaine(plusProche: { nom: string }): string {
  return `Ce sujet s'éloigne des activités d'Axion-IA. Le thème le plus proche : « ${plusProche.nom} ».`;
}

/**
 * Cadre donné à chaque rôle de TOUS les formats (dans `<contexte_axion>`) : le style ne change jamais le domaine.
 * L'appel (Will, 14/10 : « Oui, un appel c'est permis ») : réserver un appel est permis, réserver ou acheter une
 * prestation en ligne ne l'est pas.
 */
export const CADRE_AXION = [
  "Axion-IA installe l'IA dans les entreprises pour leur faire gagner du temps et de l'argent, concrètement, en jours ou en semaines. « Nous » = Axion-IA ; Will parle au nom de l'entreprise.",
  "Le sujet est vu du côté du client d'Axion (dirigeant, DAF, équipe) : son problème, ce qu'Axion a fait ou fait, le résultat. L'appel renvoie vers Axion-IA. Interdit : réserver ou acheter une formation (ou toute prestation) directement en ligne. Permis : réserver un appel ou un échange avec Will (diagnostic gratuit), et écrire ; aucun prix, aucun engagement chiffré non validé.",
].join("\n");

/**
 * Cadre propre au format « type avocat » (Will, 14/10 : hors de la charte générale) : lu par la seule recette avocat,
 * via `parametresGenerateur(format).cadreFormat`, juste après `CADRE_AXION`.
 */
export const CADRE_TYPE_AVOCAT =
  "Le format « type avocat » est un STYLE de vidéo (face caméra, verdict posé, récit de cas client, à la manière de l'avocat de référence) : le contenu parle TOUJOURS d'Axion-IA, de ses clients et de leurs problèmes, jamais de droit ni d'un conseil personnalisé.";
