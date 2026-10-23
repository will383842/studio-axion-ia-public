/**
 * Contrat du fournisseur « site » (vidéos sur le site, lot S3) : le studio APPELLE, le site RÉPOND (plan § 7).
 * Trois points d'accès : lire les réglages du site, publier un passeport, retirer une vidéo.
 */
import type { CorpsPasseport } from "@/domaine/site-videos/contrat";
import type { ReglagesDuSite } from "@/domaine/site-videos/reglages-site";
import type { FournisseurBase } from "../types";

export interface ReponsePublication {
  statut: "publiee";
  slug: string;
  /** Adresse complète de la page rendue par le site. */
  url: string;
  versionPasseport: number;
  /** Le site avait déjà cette version : rien n'a changé. */
  inchange: boolean;
}

export interface ReponseRetrait {
  /** « inconnue » : le site ne connaissait pas cette vidéo (traité comme un succès, idempotent). */
  statut: "retiree" | "inconnue";
}

export interface FournisseurSite extends FournisseurBase {
  type: "site";
  /** `GET /api/interne/videos/reglages` — jamais une copie : les vrais réglages du site. */
  lireReglages(): Promise<ReglagesDuSite>;
  /** `POST /api/interne/videos` — idempotent par (idStudio, versionPasseport). */
  publier(corps: CorpsPasseport): Promise<ReponsePublication>;
  /** `DELETE /api/interne/videos/<idStudio>` — 200 ou 404 = succès. */
  retirer(idStudio: string): Promise<ReponseRetrait>;
}

export type CodeErreurSite = "signature" | "conflit" | "invalide" | "retiree" | "injoignable" | "serveur";

/** Refus ou panne du site, en phrase simple (jamais le texte brut du site à l'écran). */
export class ErreurSite extends Error {
  constructor(
    public readonly code: CodeErreurSite,
    message: string,
    public readonly statut?: number,
    public readonly erreurs: string[] = [],
  ) {
    super(message);
    this.name = "ErreurSite";
  }
}

/** Requête déjà signée, au format de transport commun au client réel et au site factice. */
export interface RequeteSignee {
  methode: "GET" | "POST" | "DELETE";
  chemin: string;
  corps: string;
  entetes: Record<string, string>;
}

export interface ReponseSite {
  statut: number;
  corps: unknown;
}

/** Ce que sait faire un transport : porter une requête signée et rendre la réponse. Lève si le site est injoignable. */
export type TransportSite = (requete: RequeteSignee) => Promise<ReponseSite>;

/** En-têtes posés sur chaque fichier public (noms versionnés : jamais de purge). */
export interface OptionsObjetPublic {
  contentType: string;
  cacheControl: string;
}

/**
 * Le seau PUBLIC dédié aux fichiers des vidéos du site (plan § 7.4, décision D2 : le studio seul y écrit ; le site ne
 * fait que les lire). Jamais le seau privé du studio. Le vrai seau n'est pas branché dans ces lots.
 */
export interface StockagePublic {
  /** Copie un fichier du stockage privé du studio vers la clé publique donnée. */
  copierDepuisPrive(source: { cle: string; taille: number }, cleCible: string, options: OptionsObjetPublic): Promise<void>;
  /** Dépose un texte (le fichier de sous-titres). */
  deposerTexte(cleCible: string, texte: string, options: OptionsObjetPublic): Promise<void>;
  existe(cle: string): Promise<{ existe: boolean; taille?: number }>;
  /** Efface un objet public (idempotent). */
  supprimer(cle: string): Promise<void>;
}
