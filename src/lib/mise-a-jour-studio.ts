/**
 * PAGE OUVERTE AVANT UNE MISE EN LIGNE (constat prod du 10/10). Chaque construction change les identifiants des actions
 * serveur : une page restée ouverte appelle un identifiant que le nouveau studio ne connaît plus. Next 16 répond alors
 * 404 avec l'en-tête `x-nextjs-action-not-found: 1`, SANS exécuter quoi que ce soit (action-handler de Next), puis le
 * client lève une `UnrecognizedActionError` (« Server Action "…" was not found on the server »).
 *
 * Filet central (navigateur) : `fetch` est enveloppé une fois (`RepriseMiseAJour`, layout racine). Sur cette réponse,
 * avant que l'erreur ne remonte : les textes saisis sont gardés (sessionStorage), un message s'affiche, la page se
 * recharge (une fois par minute au plus : jamais de boucle) et l'appel reste en attente (aucune erreur à l'écran).
 * Après le rechargement, chaque champ inscrit reprend son texte ; le fil du monteur renvoie son message UNE fois (le
 * premier envoi n'a jamais atteint le serveur : aucun doublon possible).
 */

export const MESSAGE_MISE_A_JOUR = "Le studio vient d'être mis à jour : la page se recharge, votre message est gardé.";

/** En-têtes de Next 16 (client/components/app-router-headers.js). */
const ENTETE_ACTION = "next-action";
const ENTETE_ACTION_INTROUVABLE = "x-nextjs-action-not-found";

const CLE_RECHARGEMENT = "studio:maj:rechargement";
const CLE_SAISIES = "studio:maj:saisies";
/** Une seule recharge automatique par minute : si l'action manque encore juste après, on laisse l'erreur s'afficher. */
export const DELAI_ENTRE_RECHARGEMENTS_MS = 60_000;
/** Une saisie gardée plus vieille que ça n'est plus remise (autre visite, autre contexte). */
export const DUREE_SAISIE_MS = 10 * 60_000;

export interface Stockage {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
}

export interface SaisieGardee {
  texte: string;
  /** Vrai : le message n'est jamais parti (envoi refusé avant exécution) ; le composant le renvoie une fois. */
  renvoyer?: boolean;
  /** Réglages de l'envoi (ex. dicté, à garder pour les prochaines vidéos). */
  options?: Record<string, unknown>;
  le: number;
}

/** L'appel était-il une action serveur que le studio (nouvelle version) ne connaît plus ? */
export function estReponseActionIntrouvable(init: RequestInit | undefined, reponse: Response): boolean {
  if (reponse.headers.get(ENTETE_ACTION_INTROUVABLE) !== "1") return false;
  const entetes = init?.headers;
  if (!entetes) return false;
  if (entetes instanceof Headers) return entetes.has(ENTETE_ACTION);
  if (Array.isArray(entetes)) return entetes.some(([k]) => k.toLowerCase() === ENTETE_ACTION);
  return Object.keys(entetes).some((k) => k.toLowerCase() === ENTETE_ACTION);
}

/** L'erreur levée par Next quand l'action est introuvable (`UnrecognizedActionError`, code E715). */
export function estErreurActionIntrouvable(erreur: unknown): boolean {
  if (!erreur || typeof erreur !== "object") return false;
  const e = erreur as { name?: unknown; message?: unknown };
  return e.name === "UnrecognizedActionError" || (typeof e.message === "string" && /Server Action "[^"]*" was not found on the server/.test(e.message));
}

/** Rechargement permis ? (pas déjà fait il y a moins d'une minute). Le note quand il est permis. */
export function rechargementPermis(stockage: Stockage, maintenant: number): boolean {
  const dernier = Number(stockage.getItem(CLE_RECHARGEMENT));
  if (Number.isFinite(dernier) && dernier > 0 && maintenant - dernier < DELAI_ENTRE_RECHARGEMENTS_MS) return false;
  stockage.setItem(CLE_RECHARGEMENT, String(maintenant));
  return true;
}

function lireSaisies(stockage: Stockage): Record<string, SaisieGardee> {
  try {
    const brut = JSON.parse(stockage.getItem(CLE_SAISIES) ?? "{}") as unknown;
    return brut && typeof brut === "object" && !Array.isArray(brut) ? (brut as Record<string, SaisieGardee>) : {};
  } catch {
    return {};
  }
}

/** Garde les saisies non vides (ajoutées à celles déjà gardées). */
export function garderSaisies(stockage: Stockage, saisies: Record<string, Omit<SaisieGardee, "le">>, maintenant: number) {
  const tout = lireSaisies(stockage);
  for (const [cle, s] of Object.entries(saisies)) if (s.texte.trim()) tout[cle] = { ...s, le: maintenant };
  stockage.setItem(CLE_SAISIES, JSON.stringify(tout));
}

/** Reprend (et retire : une seule fois) la saisie gardée pour cette clé, si elle est récente. */
export function reprendreSaisie(stockage: Stockage, cle: string, maintenant: number): SaisieGardee | null {
  const tout = lireSaisies(stockage);
  const s = tout[cle];
  if (!s) return null;
  delete tout[cle];
  if (Object.keys(tout).length) stockage.setItem(CLE_SAISIES, JSON.stringify(tout));
  else stockage.removeItem(CLE_SAISIES);
  if (typeof s.texte !== "string" || !s.texte.trim() || !(maintenant - s.le < DUREE_SAISIE_MS)) return null;
  return s;
}

// --- Saisies ouvertes à l'écran (inscrites par les champs) et envois en cours (fil du monteur) ---

const champs = new Map<symbol, { cle: string; lire: () => string }>();
const envois = new Map<symbol, { cle: string; texte: string; options?: Record<string, unknown> }>();

/** Un champ de texte ouvert s'inscrit : son texte sera gardé si le studio se recharge. Renvoie la désinscription. */
export function inscrireChamp(cle: string, lire: () => string): () => void {
  const jeton = Symbol(cle);
  champs.set(jeton, { cle, lire });
  return () => void champs.delete(jeton);
}

/** Message en route vers le serveur (champ déjà vidé) : à renvoyer une fois s'il est refusé avant exécution. */
export function marquerEnvoi(cle: string, texte: string, options?: Record<string, unknown>): () => void {
  const jeton = Symbol(cle);
  envois.set(jeton, { cle, texte, options });
  return () => void envois.delete(jeton);
}

/** Toutes les saisies à garder maintenant : champs ouverts non vides, puis envois en cours (à renvoyer). */
export function saisiesAGarder(): Record<string, Omit<SaisieGardee, "le">> {
  const r: Record<string, Omit<SaisieGardee, "le">> = {};
  for (const { cle, lire } of champs.values()) {
    const texte = lire();
    if (texte.trim() && !r[cle]) r[cle] = { texte };
  }
  for (const { cle, texte, options } of envois.values()) r[cle] = { texte, renvoyer: true, ...(options ? { options } : {}) };
  return r;
}

/**
 * Enveloppe `fetch` : sur une action introuvable, `surIntrouvable()` décide. S'il renvoie vrai (rechargement lancé),
 * l'appel reste en attente pour toujours (la page part) : aucune erreur brute n'est affichée. Sinon la réponse passe.
 */
export function envelopperFetch(origine: typeof fetch, surIntrouvable: () => boolean): typeof fetch {
  return async function fetchStudio(entree, init) {
    const reponse = await origine(entree, init);
    if (estReponseActionIntrouvable(init, reponse) && surIntrouvable()) return new Promise<Response>(() => {});
    return reponse;
  };
}

/** Ce qui se passe à la détection : garder les saisies, prévenir, recharger (une fois par minute au plus). */
export function preparerRechargement(stockage: Stockage, maintenant: number): boolean {
  const permis = rechargementPermis(stockage, maintenant);
  // Même sans rechargement automatique, le texte est gardé : un rechargement à la main le remettra (sans renvoi).
  const saisies = saisiesAGarder();
  if (!permis) for (const s of Object.values(saisies)) delete s.renvoyer;
  garderSaisies(stockage, saisies, maintenant);
  return permis;
}
