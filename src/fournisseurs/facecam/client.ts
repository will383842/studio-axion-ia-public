/**
 * CLIENT DES TRAVAUX FACE CAMÉRA du conteneur `studio-aligneur` (plan facecam v4, lot A) — modèle : `../aligneur/client.ts`.
 * HTTP vers `STUDIO_ALIGNEUR_URL` (réseau `interne`, jamais exposé), même clé partagée `x-studio-rendu-cle` :
 *   POST /transcrire | /visages | /image | /son | /segmenter (202, idempotent) · GET /<route>/{idTravail} (404 = inconnu).
 * Une route pas encore construite répond 501 `non-implemente` : rendu en échec NON réessayable, jamais une exception.
 *
 * Règle d'or (v4 n° 24) : une brique ratée n'empêche jamais la livraison. Ce client ne lève donc rien : toute panne
 * devient un état `echec` typé que le moteur traite. Les résultats ne portent que des CLÉS R2 et des mesures.
 */
import type { MotHorodate } from "@/domaine/types";
import { DELAI_REQUETE_MS } from "../aligneur/client";

export const ROUTES_FACECAM = ["transcrire", "visages", "image", "son", "segmenter"] as const;
export type RouteFacecam = (typeof ROUTES_FACECAM)[number];

export interface DemandeFacecam {
  /** Identifiant stable du travail (lettres, chiffres, `_` et `-`) : resoumettre la même demande ne refait rien. */
  idTravail: string;
  /** Adresse signée de lecture de la prise (ou du fichier intermédiaire). */
  source: string;
  /** Adresses signées de dépôt des résultats lourds (json.gz, vidéo 10 bits…), par nom. */
  depots?: Record<string, string>;
  /** Paramètres propres à la route (texte validé, crans d'image, plages à segmenter…). */
  parametres?: Record<string, unknown>;
}

/** Ce que rend chaque route : des clés R2 et des mesures, jamais de données lourdes. */
export interface ResultatsFacecam {
  /** `largeurSource` / `hauteurSource` : la prise après rotation (Vérif V2 : cadre juste même sans `/visages`). */
  transcrire: { transcriptionCle: string; dureeSec: number; mots?: MotHorodate[]; largeurSource?: number; hauteurSource?: number };
  visages: { pisteVisageCle: string; visageTrouvePct: number; luminanceMoyenne?: number; largeurSource?: number; hauteurSource?: number };
  image: { fichierCle: string; hdr?: boolean };
  son: { fichierCle: string; niveauLufs?: number };
  segmenter: { masquesCle: string };
}

export type CodeErreurFacecam = "non-implemente" | "indisponible" | "refuse" | "fichier-inaccessible" | "inconnu";

export type EtatTravailFacecam<R extends RouteFacecam = RouteFacecam> =
  | { statut: "en_file" }
  | { statut: "en_cours"; progression: number }
  | { statut: "termine"; resultat: ResultatsFacecam[R] }
  | { statut: "echec"; erreur: ErreurFacecam };

/**
 * Vérif V5 : deux pannes qui ne sont PAS des échecs du travail, marquées pour que la chaîne ne consomme aucun essai :
 *  - `injoignable` : le conteneur ne répond pas (redémarrage, chargement des modèles) ; le travail continue ou attend ;
 *  - `travailInconnu` : 404, le conteneur a été recréé sans ses travaux ; à resoumettre sous le MÊME identifiant.
 */
export interface ErreurFacecam {
  code: CodeErreurFacecam;
  reessayable: boolean;
  message: string;
  injoignable?: boolean;
  travailInconnu?: boolean;
}

export interface FournisseurFacecam {
  id: "studio-aligneur" | "simulation";
  mode: "reel" | "simulation";
  soumettre<R extends RouteFacecam>(route: R, demande: DemandeFacecam): Promise<EtatTravailFacecam<R>>;
  suivre<R extends RouteFacecam>(route: R, idTravail: string): Promise<EtatTravailFacecam<R>>;
}

const echec = (code: CodeErreurFacecam, message: string, reessayable = true) => ({ statut: "echec" as const, erreur: { code, reessayable, message } });

/** État renvoyé par le conteneur, vérifié champ par champ ; mal formé → échec `refuse`. */
export function lireEtat<R extends RouteFacecam>(brut: unknown): EtatTravailFacecam<R> {
  const e = brut as { statut?: unknown; progression?: unknown; resultat?: unknown; erreur?: { code?: unknown; reessayable?: unknown; message?: unknown } } | null;
  if (e?.statut === "en_file") return { statut: "en_file" };
  if (e?.statut === "en_cours") return { statut: "en_cours", progression: typeof e.progression === "number" ? e.progression : 0 };
  if (e?.statut === "termine" && e.resultat && typeof e.resultat === "object") return { statut: "termine", resultat: e.resultat as ResultatsFacecam[R] };
  if (e?.statut === "echec") {
    const codes: CodeErreurFacecam[] = ["non-implemente", "indisponible", "refuse", "fichier-inaccessible", "inconnu"];
    const code = codes.find((c) => c === e.erreur?.code) ?? "inconnu";
    return echec(code, typeof e.erreur?.message === "string" ? e.erreur.message : "Travail impossible.", code !== "non-implemente" && e.erreur?.reessayable !== false);
  }
  return echec("refuse", "Réponse du studio-aligneur illisible.", false);
}

export function creerFacecamHttp(adresse: string, options: { fetch?: typeof fetch; cle?: string } = {}): FournisseurFacecam {
  const base = adresse.replace(/\/+$/, "");
  const appeler = options.fetch ?? fetch;
  const entetes: Record<string, string> = { "content-type": "application/json" };
  if (options.cle) entetes["x-studio-rendu-cle"] = options.cle;

  async function requete(chemin: string, init: RequestInit = {}): Promise<Response | null> {
    try {
      return await appeler(`${base}${chemin}`, { ...init, headers: entetes, signal: AbortSignal.timeout(DELAI_REQUETE_MS) });
    } catch {
      return null;
    }
  }

  async function lire<R extends RouteFacecam>(r: Response | null, route: R): Promise<EtatTravailFacecam<R>> {
    if (!r || r.status >= 500) {
      if (r?.status === 501) return lireEtat<R>(await r.json().catch(() => ({ statut: "echec", erreur: { code: "non-implemente" } })));
      return { statut: "echec", erreur: { ...echec("indisponible", `Le studio-aligneur ne répond pas (${route}).`).erreur, injoignable: true } };
    }
    if (r.status === 404) return { statut: "echec", erreur: { ...echec("fichier-inaccessible", "Travail inconnu : à soumettre à nouveau.").erreur, travailInconnu: true } };
    if (!r.ok) return echec("refuse", `Demande refusée (${r.status}).`, false);
    return lireEtat<R>(await r.json().catch(() => null));
  }

  return {
    id: "studio-aligneur",
    mode: "reel",
    async soumettre(route, demande) {
      const r = await requete(`/${route}`, { method: "POST", body: JSON.stringify(demande) });
      // 202 { idTravail, nouveau } : le travail est en file (ou déjà connu, son état se lit au suivi).
      if (r?.status === 202) return { statut: "en_file" };
      return lire(r, route);
    },
    async suivre(route, idTravail) {
      return lire(await requete(`/${route}/${encodeURIComponent(idTravail)}`), route);
    },
  };
}
