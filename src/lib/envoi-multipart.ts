/**
 * ENVOI PAR MORCEAUX, direct du navigateur vers le stockage (lot M1b, B.9 ter) : rushs de 1 à 2 Go,
 * Cloudflare refusant plus de 100 Mo par requête devant le studio. Le studio ne voit passer que les signatures
 * (`/api/depots`) ; les octets vont droit au seau R2.
 * - morceaux de 10 à 50 Mo, 3 envois en parallèle ;
 * - RÉSISTANT (essai réel du 17/10 : un redémarrage du studio coupait l'envoi à 8 %) : chaque appel (ouverture, signature,
 *   morceau, fin) est réessayé tout seul, avec une attente croissante (1 s, 2 s, 4 s, 8 s, 15 s, puis 30 s), pendant
 *   5 minutes au moins en cas de coupure réseau, de 502 / 503 / 504 ou de redémarrage ; les morceaux déjà reçus sont gardés :
 *   l'envoi reprend au morceau suivant, jamais depuis le début. Pendant l'attente, `onAttente` dit pourquoi ;
 * - au-delà, une `ErreurEnvoi` dit exactement le cas (n'a pas commencé / interrompu à X % / refusé) ; renvoyer le même
 *   fichier (« Reprendre l'envoi ») repart du dernier morceau reçu : l'état est gardé dans ce navigateur (et en mémoire
 *   si le stockage local est fermé) et le stockage dit quels morceaux il a déjà reçus ;
 * - sans R2 (simulation) : aucun octet n'est envoyé, le fichier est enregistré tel quel.
 * Le cœur (découpe, reprise, nouveaux essais) est pur et testé ; `envoyerFichier` s'exécute dans le navigateur.
 */
import { ErreurLisible, phraseLisible } from "./erreur-lisible";

export const MO = 1024 * 1024;
export const MORCEAU_MIN = 10 * MO;
export const MORCEAU_MAX = 50 * MO;
/** Limite S3 / R2 du nombre de morceaux d'un envoi. */
export const MORCEAUX_MAX = 10_000;
export const PARALLELE = 3;
/** Attentes successives entre deux essais d'un même appel (la dernière se répète). */
export const ATTENTES_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
/** Durée pendant laquelle un appel est réessayé avant d'abandonner (au moins 3 minutes : un redémarrage du studio). */
export const DUREE_REPRISES_MS = 5 * 60_000;

/** Taille des morceaux : 10 Mo, plus si le fichier l'exige (jamais plus de 10 000 morceaux), au plus 50 Mo. */
export function tailleMorceau(taille: number): number {
  return Math.min(MORCEAU_MAX, Math.max(MORCEAU_MIN, Math.ceil(taille / MORCEAUX_MAX / MO) * MO));
}

export interface Morceau {
  numero: number;
  debut: number;
  fin: number;
}

export function decouper(taille: number, morceau: number = tailleMorceau(taille)): Morceau[] {
  const res: Morceau[] = [];
  for (let debut = 0, numero = 1; debut < taille || numero === 1; debut += morceau, numero++) {
    res.push({ numero, debut, fin: Math.min(taille, debut + morceau) });
    if (taille === 0) break;
  }
  return res;
}

/** Morceaux encore à envoyer, d'après ceux déjà reçus par le stockage. */
export function morceauxRestants(tous: Morceau[], recus: { numero: number; taille?: number }[]): Morceau[] {
  const faits = new Map(recus.map((r) => [r.numero, r.taille]));
  return tous.filter((m) => {
    if (!faits.has(m.numero)) return true;
    const t = faits.get(m.numero);
    return t !== undefined && t !== m.fin - m.debut; // morceau incomplet : renvoyé
  });
}

/** Clé de reprise d'un fichier dans ce navigateur. */
export function cleReprise(f: { name: string; size: number; lastModified: number }, cible: { typeEntite: string; entiteId: string }): string {
  return `studio.envoi:${cible.typeEntite}:${cible.entiteId}:${f.name}:${f.size}:${f.lastModified}`;
}

/** Type d'un fichier d'après son extension, casse ignorée (.MOV, .mov, .MP4) : quand le navigateur n'en donne pas. PUR. */
export function typeDepuisNom(nom: string): string | undefined {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(nom)?.[1]?.toLowerCase();
  const types: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    pdf: "application/pdf",
  };
  return ext ? types[ext] : undefined;
}

/** Type envoyé au studio : celui du navigateur, sinon celui de l'extension, sinon « octets ». PUR. */
export function typeDuFichier(f: { name: string; type: string }): string {
  return f.type || typeDepuisNom(f.name) || "application/octet-stream";
}

export interface EtatEnvoi {
  fichierId: string;
  cle: string;
  idEnvoi?: string;
  simulation?: boolean;
  tailleMorceau: number;
  morceaux: { numero: number; etag: string }[];
}

/* ------------------------------------------------------------------ */
/* Erreurs : passagères (réessayées) ou définitives                     */
/* ------------------------------------------------------------------ */

/** Le studio ou le stockage n'a pas répondu (réseau coupé, 502 / 503 / 504, redémarrage) : appel réessayé. */
export class CoupurePassagere extends Error {
  constructor(
    readonly cause: "redemarrage" | "reseau",
    readonly statut?: number,
  ) {
    super(cause === "redemarrage" ? `studio indisponible (${statut ?? "?"})` : "réseau coupé");
    this.name = "CoupurePassagere";
  }
}

/** Réponse définitive du studio ou du stockage (fichier refusé, session expirée) : jamais réessayée. */
export class RefusEnvoi extends ErreurLisible {
  constructor(
    message: string,
    readonly session = false,
  ) {
    super(message);
    this.name = "RefusEnvoi";
  }
}

/** Statuts HTTP passagers : le studio redémarre ou est surchargé (Cloudflare : 520 à 524). PUR. */
export function statutPassager(statut: number): boolean {
  return statut === 408 || statut === 425 || statut === 429 || statut === 500 || statut === 502 || statut === 503 || statut === 504 || (statut >= 520 && statut <= 524);
}

/** Une erreur vaut-elle un nouvel essai ? Coupure passagère, échec réseau du navigateur (`TypeError` de `fetch`). PUR. */
export function erreurPassagere(e: unknown): e is CoupurePassagere | TypeError {
  return e instanceof CoupurePassagere || e instanceof TypeError;
}

export type CasEnvoi = "pas-commence" | "interrompu" | "pas-enregistre" | "refuse";

/** Envoi arrêté pour de bon : la phrase dit le cas exact. `reprenable` : « Reprendre l'envoi » a un sens. */
export class ErreurEnvoi extends ErreurLisible {
  constructor(
    message: string,
    readonly cas: CasEnvoi,
    readonly pourcentage: number,
    readonly reprenable: boolean,
  ) {
    super(message);
    this.name = "ErreurEnvoi";
  }
}

/** Phrase exacte d'un envoi arrêté, selon l'étape et la cause. PUR. */
export function phraseArret(etape: "commencer" | "morceaux" | "terminer", pourcentage: number, refus?: RefusEnvoi): { message: string; cas: CasEnvoi; reprenable: boolean } {
  if (refus?.session) return { message: "Votre session a expiré : reconnectez-vous, puis « Reprendre l'envoi » (il repart où il s'est arrêté).", cas: "refuse", reprenable: true };
  if (refus) return { message: `L'envoi a été refusé : ${refus.message}`, cas: "refuse", reprenable: false };
  if (etape === "commencer") return { message: "L'envoi n'a pas pu commencer : le studio ne répond pas depuis plusieurs minutes. Vérifiez la connexion, puis « Reprendre l'envoi ».", cas: "pas-commence", reprenable: true };
  if (etape === "terminer") return { message: "Le fichier est arrivé, mais le studio ne répond pas pour l'enregistrer. « Reprendre l'envoi » le termine sans rien renvoyer.", cas: "pas-enregistre", reprenable: true };
  return { message: `L'envoi s'est interrompu à ${pourcentage} % : le studio ne répond plus depuis plusieurs minutes. « Reprendre l'envoi » repart de ${pourcentage} %, pas du début.`, cas: "interrompu", reprenable: true };
}

/** Attente en cours (affichée sous la barre). */
export interface AttenteEnvoi {
  cause: "redemarrage" | "reseau";
  essai: number;
  dansMs: number;
}

/** Phrase de l'attente. PUR. */
export function phraseAttente(a: Pick<AttenteEnvoi, "cause">): string {
  return a.cause === "redemarrage" ? "Le studio redémarre, l'envoi reprend tout seul…" : "La connexion est coupée, l'envoi reprend tout seul…";
}

/** Attente avant le n-ième nouvel essai (0 = le premier). PUR. */
export function attenteAvantEssai(n: number): number {
  return ATTENTES_MS[Math.min(n, ATTENTES_MS.length - 1)];
}

type Appel = (corps: Record<string, unknown>) => Promise<Record<string, unknown>>;

async function appelerApi(corps: Record<string, unknown>): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await fetch("/api/depots", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corps) });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new CoupurePassagere("reseau");
  }
  if (statutPassager(r.status)) throw new CoupurePassagere("redemarrage", r.status);
  let donnees: Record<string, unknown>;
  try {
    donnees = (await r.json()) as Record<string, unknown>;
  } catch {
    // Page d'attente (HTML) servie pendant une mise en ligne : passagère, jamais un refus.
    throw new CoupurePassagere("redemarrage", r.status);
  }
  if (r.status === 401) throw new RefusEnvoi("Connexion requise.", true);
  if (!r.ok) throw new RefusEnvoi(typeof donnees.erreur === "string" && phraseLisible(donnees.erreur) ? donnees.erreur : "le studio n'accepte pas ce fichier.");
  return donnees;
}

function attendreParDefaut(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((ok, ko) => {
    if (signal?.aborted) return ko(new DOMException("Envoi arrêté", "AbortError"));
    const t = setTimeout(ok, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      ko(new DOMException("Envoi arrêté", "AbortError"));
    });
  });
}

/** Repli quand le stockage local est fermé (navigation privée) : « Reprendre l'envoi » repart quand même du dernier morceau. */
const memoire = new Map<string, string>();

function lireReprise(stockage: Storage | undefined, cle: string): EtatEnvoi | null {
  let brut: string | null | undefined;
  try {
    brut = stockage?.getItem(cle);
  } catch {
    brut = null;
  }
  brut ??= memoire.get(cle);
  try {
    return brut ? (JSON.parse(brut) as EtatEnvoi) : null;
  } catch {
    return null;
  }
}

function ecrireReprise(stockage: Storage | undefined, cle: string, etat: EtatEnvoi | null) {
  if (etat) memoire.set(cle, JSON.stringify(etat));
  else memoire.delete(cle);
  try {
    if (etat) stockage?.setItem(cle, JSON.stringify(etat));
    else stockage?.removeItem(cle);
  } catch {
    // Navigation privée : la mémoire de la page garde l'état, l'envoi continue.
  }
}

export interface OptionsEnvoi {
  onProgression?: (pourcentage: number) => void;
  /** Attente avant un nouvel essai (`null` : l'envoi a repris). */
  onAttente?: (attente: AttenteEnvoi | null) => void;
  signal?: AbortSignal;
  /** Injection (tests) : appel de `/api/depots`, PUT d'un morceau, stockage local, horloge. */
  api?: Appel;
  envoyerMorceau?: (url: string, corps: Blob, signal?: AbortSignal) => Promise<string>;
  stockage?: Storage;
  attendre?: (ms: number, signal?: AbortSignal) => Promise<void>;
  maintenant?: () => number;
  /** Durée des nouveaux essais d'un même appel (défaut : 5 minutes). */
  dureeReprisesMs?: number;
}

async function putMorceau(url: string, corps: Blob, signal?: AbortSignal): Promise<string> {
  let r: Response;
  try {
    r = await fetch(url, { method: "PUT", body: corps, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new CoupurePassagere("reseau");
  }
  if (!r.ok) {
    console.warn(`[studio] envoi : morceau refusé, statut ${r.status}`);
    // 403 : adresse signée périmée (longue attente) ; une nouvelle signature est demandée au prochain essai.
    if (statutPassager(r.status) || r.status === 403) throw new CoupurePassagere(r.status === 403 ? "reseau" : "redemarrage", r.status);
    throw new RefusEnvoi("le stockage n'accepte pas une partie du fichier.");
  }
  // La règle CORS du seau expose l'en-tête ETag (deploiement/r2-cors.json).
  return r.headers.get("etag") ?? "";
}

/**
 * Exécute `faire` et le réessaie en cas d'erreur passagère, avec une attente croissante, tant que la durée des essais
 * ne dépasse pas `dureeMs` (comptée depuis le premier échec). Une erreur définitive (ou l'arrêt demandé) part tout de suite.
 */
export async function avecReprises<T>(
  faire: () => Promise<T>,
  o: { signal?: AbortSignal; attendre?: OptionsEnvoi["attendre"]; maintenant?: () => number; dureeMs?: number; onAttente?: OptionsEnvoi["onAttente"]; passagere?: (e: unknown) => boolean } = {},
): Promise<T> {
  const attendre = o.attendre ?? attendreParDefaut;
  const maintenant = o.maintenant ?? Date.now;
  const duree = o.dureeMs ?? DUREE_REPRISES_MS;
  const passagere = o.passagere ?? erreurPassagere;
  let debut: number | undefined;
  for (let essai = 0; ; essai++) {
    try {
      const r = await faire();
      if (essai > 0) o.onAttente?.(null);
      return r;
    } catch (e) {
      if (o.signal?.aborted || !passagere(e)) throw e;
      debut ??= maintenant();
      const dansMs = attenteAvantEssai(essai);
      if (maintenant() - debut + dansMs > duree) throw e;
      o.onAttente?.({ cause: e instanceof CoupurePassagere ? e.cause : "reseau", essai: essai + 1, dansMs });
      await attendre(dansMs, o.signal);
    }
  }
}

/** Envoie un fichier (avec reprise). Renvoie l'identifiant du fichier enregistré par le studio. */
export async function envoyerFichier(fichier: File, cible: { typeEntite: string; entiteId: string }, options: OptionsEnvoi = {}): Promise<{ fichierId: string; simulation: boolean }> {
  const api = options.api ?? appelerApi;
  const envoyer = options.envoyerMorceau ?? putMorceau;
  const stockage = options.stockage ?? (typeof localStorage !== "undefined" ? localStorage : undefined);
  const cleLocale = cleReprise(fichier, cible);
  const descriptif = { nom: fichier.name, mime: typeDuFichier(fichier), taille: fichier.size, ...cible };
  // Arrêt commun : un morceau perdu pour de bon arrête les autres envois en parallèle.
  const arret = new AbortController();
  const surArret = () => arret.abort();
  options.signal?.addEventListener("abort", surArret);
  if (options.signal?.aborted) arret.abort();
  const reprises = { signal: arret.signal, attendre: options.attendre, maintenant: options.maintenant, dureeMs: options.dureeReprisesMs, onAttente: options.onAttente };
  // Erreurs d'un appel injecté (tests, services) : seule une coupure passagère ou un échec réseau est réessayé.
  const appeler = (corps: Record<string, unknown>) => avecReprises(() => api(corps), reprises);

  let etape: "commencer" | "morceaux" | "terminer" = "commencer";
  let pourcentage = 0;
  try {
    let etat = lireReprise(stockage, cleLocale);
    let recus: { numero: number; etag: string; taille?: number }[] = [];
    if (etat?.idEnvoi) {
      // Reprise d'un envoi commencé : un arrêt ici est une interruption (au pourcentage déjà envoyé), pas un « pas commencé ».
      etape = "morceaux";
      pourcentage = fichier.size ? Math.min(99, Math.floor((etat.morceaux.length * etat.tailleMorceau * 100) / fichier.size)) : 0;
      try {
        recus = ((await appeler({ action: "recus", cle: etat.cle, idEnvoi: etat.idEnvoi })).morceaux as typeof recus) ?? [];
      } catch (e) {
        // Studio injoignable (ou session expirée) : l'état est gardé pour la prochaine reprise.
        if (erreurPassagere(e) || (e instanceof RefusEnvoi && e.session)) throw e;
        etat = null; // envoi expiré côté stockage : on recommence
      }
    }
    if (!etat) {
      etape = "commencer";
      pourcentage = 0;
      const debut = await appeler({ action: "commencer", ...descriptif });
      etat = { fichierId: String(debut.fichierId), cle: String(debut.cle), idEnvoi: debut.idEnvoi ? String(debut.idEnvoi) : undefined, simulation: !!debut.simulation, tailleMorceau: Number(debut.tailleMorceau) || tailleMorceau(fichier.size), morceaux: [] };
      ecrireReprise(stockage, cleLocale, etat);
    }

    etape = "morceaux";
    if (!etat.simulation && etat.idEnvoi) {
      const tous = decouper(fichier.size, etat.tailleMorceau);
      // Morceaux connus : ceux du stockage, sinon ceux gardés dans ce navigateur (le stockage n'a pas pu être relu).
      const faits = new Map<number, string>(recus.length ? recus.map((r) => [r.numero, r.etag]) : etat.morceaux.map((m) => [m.numero, m.etag]));
      const restants = recus.length ? morceauxRestants(tous, recus) : tous.filter((m) => !faits.has(m.numero));
      let octets = tous.filter((m) => !restants.includes(m)).reduce((s, m) => s + (m.fin - m.debut), 0);
      const avancer = () => {
        pourcentage = fichier.size ? Math.floor((octets / fichier.size) * 100) : 0;
        options.onProgression?.(fichier.size ? Math.round((octets / fichier.size) * 100) : 0);
      };
      avancer();
      const file = [...restants];
      const courant = etat;
      const ouvrier = async () => {
        for (let m = file.shift(); m; m = file.shift()) {
          const morceau = m;
          // Signature ET envoi réessayés ensemble : une adresse périmée pendant l'attente est re-signée.
          const etag = await avecReprises(async () => {
            const adresses = (await api({ action: "signer", cle: courant.cle, idEnvoi: courant.idEnvoi, numeros: [morceau.numero] })).adresses as Record<string, string>;
            try {
              return await envoyer(adresses[String(morceau.numero)], fichier.slice(morceau.debut, morceau.fin), arret.signal);
            } catch (e) {
              // Tout échec du PUT est passager (comme avant : réessayé), sauf un refus net ou l'arrêt.
              if (e instanceof CoupurePassagere || e instanceof RefusEnvoi || e instanceof DOMException || estErreurStudio(e)) throw e;
              throw new CoupurePassagere("reseau");
            }
          }, reprises);
          faits.set(morceau.numero, etag);
          courant.morceaux = Array.from(faits, ([numero, e]) => ({ numero, etag: e }));
          ecrireReprise(stockage, cleLocale, courant);
          octets += morceau.fin - morceau.debut;
          avancer();
        }
      };
      let premiereErreur: { e: unknown } | undefined;
      await Promise.all(
        Array.from({ length: Math.min(PARALLELE, Math.max(1, restants.length)) }, () =>
          ouvrier().catch((e) => {
            // La première erreur est la vraie ; les autres envois, arrêtés par elle, rejettent « arrêté ».
            premiereErreur ??= { e };
            arret.abort();
          }),
        ),
      );
      if (premiereErreur) throw premiereErreur.e;
      etat.morceaux = Array.from(faits, ([numero, etag]) => ({ numero, etag })).sort((a, b) => a.numero - b.numero);
      ecrireReprise(stockage, cleLocale, etat);
    }

    etape = "terminer";
    pourcentage = 100;
    const fin = await appeler({ action: "terminer", fichierId: etat.fichierId, cle: etat.cle, idEnvoi: etat.idEnvoi, morceaux: etat.morceaux, ...descriptif });
    ecrireReprise(stockage, cleLocale, null);
    options.onAttente?.(null);
    options.onProgression?.(100);
    return { fichierId: String(fin.fichierId ?? etat.fichierId), simulation: !!etat.simulation };
  } catch (e) {
    options.onAttente?.(null);
    // Arrêt demandé par l'écran, ou erreur d'un appel injecté (service du studio) : rendue telle quelle.
    if (options.signal?.aborted || (!erreurPassagere(e) && !(e instanceof RefusEnvoi))) throw e;
    const a = phraseArret(etape, pourcentage, e instanceof RefusEnvoi ? e : undefined);
    throw new ErreurEnvoi(a.message, a.cas, pourcentage, a.reprenable);
  } finally {
    options.signal?.removeEventListener("abort", surArret);
  }
}

/** Erreur métier du studio (`ErreurStudio` : un `code`) remontée par un appel injecté : définitive. */
function estErreurStudio(e: unknown): boolean {
  return !!e && typeof e === "object" && typeof (e as { code?: unknown }).code === "string";
}

export const MESSAGE_ENVOI_RATE = "Le fichier n'a pas pu être envoyé. Vérifiez la connexion et réessayez.";

/**
 * B5 (audit A) : envoie VRAIMENT des fichiers, un par un (Bibliothèque, Personnages, assistant), par le même chemin que
 * ZoneDepot, Mes images et Tournage. Un envoi raté renvoie une phrase simple : rien n'est enregistré sans ses octets.
 * `simulation` : le studio n'a pas encore de stockage relié (essai, aucun octet ne part).
 */
export async function envoyerFichiers(
  fichiers: File[],
  cible: { typeEntite: string; entiteId: string },
  options: OptionsEnvoi = {},
): Promise<{ ok: true; fichierIds: string[]; simulation: boolean } | { ok: false; message: string }> {
  const fichierIds: string[] = [];
  let simulation = false;
  try {
    for (const f of fichiers) {
      const r = await envoyerFichier(f, cible, options);
      fichierIds.push(r.fichierId);
      simulation ||= r.simulation;
    }
  } catch {
    return { ok: false, message: MESSAGE_ENVOI_RATE };
  }
  return { ok: true, fichierIds, simulation };
}
