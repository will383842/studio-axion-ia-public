// MG-0 — contrat PUR avec le catalogue du site (guides et adresses de page, liaisons mot → cible).
// Aucun import serveur, aucun accès réseau ni base : seulement des constantes, des types et des lectures défensives.
import { normaliserMot } from "./mot-normalise";

/** Chemins du site (liste des cibles, liaisons mot → cible, création/modification d'une cible). */
export const CHEMIN_CATALOGUE_RESEAU = "/api/interne/catalogue-reseau";
export const CHEMIN_MOTS_CIBLES = "/api/interne/mots-cibles";
export const CHEMIN_CIBLES_RESEAU = "/api/interne/cibles-reseau";

/** Règle de code d'une cible côté site : `gde-` (guide) ou `adr-` (adresse) + 6 à 24 caractères minuscules, chiffres ou tirets. */
export const RE_CODE_CIBLE = /^(gde|adr)-[a-z0-9-]{6,24}$/;
/** Exception : la fiche de départ du site garde son ancien code. */
export const CODE_GUIDE_DEPART = "guide-ia";

export type TypeElement = "guide" | "adresse";
/** Réseaux connus du site pour une liaison ; « tous » = valable pour chaque réseau sans ligne propre. */
export type ReseauSite =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "tiktok"
  | "tous";
const RESEAUX_SITE: readonly ReseauSite[] = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "tous",
];

/** Une cible du catalogue. Jamais d'adresse ni de chemin de PDF ici : le Studio ne les voit pas. */
export interface ElementCatalogue {
  readonly code: string;
  readonly type: TypeElement;
  readonly titre: string;
  readonly actif: boolean;
  /** Cible d'essai : proposée en dernier. */
  readonly test: boolean;
}

/** Une ligne « mot → cible » ; le mot est au format du Studio (MAJUSCULES). */
export interface LiaisonMot {
  readonly mot: string;
  readonly reseau: ReseauSite;
  readonly codeCible: string;
  readonly actif: boolean;
}

/** Compteurs par fenêtre : 7 derniers jours, 30 derniers jours, depuis toujours. */
export interface Fenetres {
  readonly j7: number;
  readonly j30: number;
  readonly total: number;
}

/** Statistiques d'un mot : combien de personnes l'ont écrit, combien ont reçu le guide, combien suivent le compte. */
export interface StatsMot {
  readonly mot: string;
  readonly ecrits: Fenetres;
  readonly envoyes: Fenetres;
  readonly suivent: Fenetres;
}

/** Une ligne de l'écran des mots. */
export interface LigneTableauMot {
  readonly mot: string;
  readonly reseau: ReseauSite;
  readonly cible: ElementCatalogue | null;
  readonly source: "reseau" | "tous" | null;
  /** Vrai si la cible du site et celle que le Studio attendait ne sont pas la même. */
  readonly divergent: boolean;
  readonly actif: boolean;
  readonly stats: StatsMot | null;
}

/** Ce que l'écran affiche : les lignes, plus le nombre de lignes du site que le Studio n'a pas pu lire. */
export interface VueTableauMots {
  readonly lignes: readonly LigneTableauMot[];
  readonly ignores: number;
  /** Vrai si le site n'a pas répondu ou a répondu dans une forme illisible. */
  readonly indisponible: boolean;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function codeValide(code: string): boolean {
  return code === CODE_GUIDE_DEPART || RE_CODE_CIBLE.test(code);
}

/** Lit la réponse du site. Forme illisible (pas un tableau) → null. Ligne refusée → ignorée et comptée. Seuls 5 champs sont gardés : `url` et `cheminPdf` sont jetés. */
export function lireCatalogue(
  json: unknown,
): { elements: ElementCatalogue[]; ignores: number } | null {
  if (!Array.isArray(json)) return null;
  const elements: ElementCatalogue[] = [];
  let ignores = 0;
  for (const l of json) {
    if (
      !estObjet(l) ||
      typeof l.code !== "string" ||
      !codeValide(l.code) ||
      (l.type !== "guide" && l.type !== "adresse") ||
      typeof l.titre !== "string" ||
      typeof l.actif !== "boolean" ||
      typeof l.test !== "boolean"
    ) {
      ignores++;
      continue;
    }
    elements.push({
      code: l.code,
      type: l.type,
      titre: l.titre,
      actif: l.actif,
      test: l.test,
    });
  }
  return { elements, ignores };
}

/** Lit les liaisons du site. Le mot passe par `normaliserMot` du Studio ; une ligne refusée est ignorée et comptée. */
export function lireLiaisons(
  json: unknown,
): { liaisons: LiaisonMot[]; ignores: number } | null {
  if (!Array.isArray(json)) return null;
  const liaisons: LiaisonMot[] = [];
  let ignores = 0;
  for (const l of json) {
    const mot = estObjet(l) ? normaliserMot(l.mot) : null;
    if (
      mot === null ||
      !estObjet(l) ||
      typeof l.reseau !== "string" ||
      !(RESEAUX_SITE as readonly string[]).includes(l.reseau) ||
      typeof l.codeCible !== "string" ||
      !codeValide(l.codeCible) ||
      typeof l.actif !== "boolean"
    ) {
      ignores++;
      continue;
    }
    liaisons.push({
      mot,
      reseau: l.reseau as ReseauSite,
      codeCible: l.codeCible,
      actif: l.actif,
    });
  }
  return { liaisons, ignores };
}

/** Mot au format du site (minuscules), ou null si le mot est invalide ou d'arrêt. */
export function motVersSite(mot: unknown): string | null {
  const m = normaliserMot(mot);
  return m === null ? null : m.toLowerCase();
}

/** Cible d'un mot pour un réseau : la ligne propre au réseau l'emporte sur « tous ». `divergent` : la ligne existe mais sa cible est absente du catalogue ou inactive. */
export function cibleDuMot(
  mot: string,
  reseau: ReseauSite,
  liaisons: readonly LiaisonMot[],
  catalogue: readonly ElementCatalogue[],
): {
  element: ElementCatalogue | null;
  source: "reseau" | "tous" | null;
  divergent: boolean;
} {
  const m = normaliserMot(mot);
  if (m === null) return { element: null, source: null, divergent: false };
  const propre = liaisons.find(
    (l) => l.actif && l.mot === m && l.reseau === reseau && reseau !== "tous",
  );
  const commune = liaisons.find(
    (l) => l.actif && l.mot === m && l.reseau === "tous",
  );
  const ligne = propre ?? commune;
  if (!ligne) return { element: null, source: null, divergent: false };
  const element = catalogue.find((e) => e.code === ligne.codeCible) ?? null;
  return {
    element,
    source: propre ? "reseau" : "tous",
    divergent: element === null || !element.actif,
  };
}

/** Réseau Zernio → réseau du site. Inconnu → null. */
export function reseauSite(reseauZernio: string): ReseauSite | null {
  switch (reseauZernio) {
    case "linkedin":
    case "linkedin_page":
    case "linkedin_profil":
      return "linkedin";
    case "facebook":
    case "instagram":
    case "tiktok":
      return reseauZernio;
    default:
      return null;
  }
}

const sansAccents = (s: string): string =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Cherche dans les titres, sans tenir compte des accents ni de la casse. Cibles actives seulement ; cibles d'essai en dernier. */
export function rechercherCibles(
  catalogue: readonly ElementCatalogue[],
  texte: string,
  options: { type?: TypeElement; max?: number } = {},
): ElementCatalogue[] {
  const max = options.max ?? 20;
  const q = sansAccents(texte).trim();
  const trouves = catalogue.filter(
    (e) =>
      e.actif &&
      (options.type === undefined || e.type === options.type) &&
      sansAccents(e.titre).includes(q),
  );
  const normaux = trouves.filter((e) => !e.test);
  const essais = trouves.filter((e) => e.test);
  return [...normaux, ...essais].slice(0, max);
}

/** Une phrase simple pour chaque refus du site (clé = code d'erreur renvoyé ; `site_eteint` = 404, `trop_de_demandes` = 429). */
export const PHRASES_REFUS_SITE: Readonly<Record<string, string>> = {
  mot_invalide:
    "Ce mot n'est pas accepté : de 2 à 20 lettres ou chiffres, pas seulement des chiffres, et pas un mot d'arrêt.",
  cible_inconnue: "Cette cible n'existe pas dans le catalogue.",
  cible_inactive: "Cette cible est désactivée : choisissez-en une active.",
  titre_invalide: "Le titre n'est pas accepté : de 3 à 120 caractères.",
  code_invalide: "Le code de la cible n'est pas accepté.",
  corps_invalide: "La demande est incomplète ou contient un champ inconnu.",
  corps_illisible: "La demande n'a pas pu être lue par le site.",
  signature_invalide: "Le site a refusé la signature de la demande.",
  guide_sans_adresse: "Un guide n'a pas d'adresse de page.",
  chemin_pdf_invalide: "Le chemin du fichier du guide n'est pas accepté.",
  adresse_sans_pdf: "Une adresse de page n'a pas de fichier de guide.",
  adresse_vide: "L'adresse est vide.",
  adresse_trop_longue: "L'adresse est trop longue.",
  adresse_caracteres_interdits:
    "L'adresse contient un espace ou un caractère interdit.",
  adresse_illisible: "L'adresse n'est pas lisible.",
  adresse_https_obligatoire: "L'adresse doit commencer par https.",
  adresse_identifiants_interdits:
    "L'adresse ne doit contenir ni identifiant ni mot de passe.",
  adresse_fragment_interdit:
    "L'adresse ne doit pas contenir de partie après #.",
  adresse_port_interdit: "L'adresse ne doit pas contenir de numéro de port.",
  adresse_hote_non_autorise:
    "Le site de cette adresse n'est pas dans la liste autorisée.",
  site_eteint: "Le site est éteint pour le moment : rien n'a été enregistré.",
  trop_de_demandes:
    "Trop de demandes d'un coup : attendez un moment, puis réessayez.",
};
