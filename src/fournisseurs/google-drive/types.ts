/**
 * GOOGLE DRIVE EN LECTURE SEULE (lot E2, plan facecam v4 L1 « Import depuis Google Drive »). Contrat commun au vrai
 * client (`http.ts`) et au double de simulation (`simulation.ts`). Portée unique : `drive.readonly` — le Drive n'est
 * jamais modifié.
 */

export const PORTEE_DRIVE = "https://www.googleapis.com/auth/drive.readonly";

export interface VideoDrive {
  id: string;
  nom: string;
  mime: string;
  /** Octets. */
  taille: number;
  /** 0 si Google ne la connaît pas encore (vidéo en cours de traitement). */
  dureeSec: number;
  creeLe: string;
  modifieLe: string;
  largeur?: number;
  hauteur?: number;
  /** Vignette disponible (servie par `/api/google-drive/vignette`, jamais l'adresse Google au navigateur). */
  vignette: boolean;
}

export interface JetonsDrive {
  acces: string;
  /** Instant d'expiration du jeton d'accès (ms depuis 1970). */
  expireLe: number;
  /** Absent au rafraîchissement : on garde l'ancien. */
  rafraichissement?: string;
}

/** Pourquoi Google refuse : décide du message et du bouton proposés à Will. */
export type RaisonRefusDrive = "expire" | "refuse" | "introuvable" | "quota" | "reseau";

export class RefusDrive extends Error {
  constructor(
    public readonly raison: RaisonRefusDrive,
    message: string,
  ) {
    super(message);
    this.name = "RefusDrive";
  }
}

export interface PageVideosDrive {
  videos: VideoDrive[];
  suite?: string;
}

export interface FournisseurDrive {
  mode: "simulation" | "reel";
  /** Adresse de la page Google « Autoriser l'accès » (`etat` : jeton anti-falsification, rendu tel quel au retour). */
  adresseConnexion(etat: string): string;
  echangerCode(code: string): Promise<JetonsDrive>;
  rafraichir(rafraichissement: string): Promise<JetonsDrive>;
  /** Adresse du compte relié (affichée dans Réglages). */
  compte(acces: string): Promise<string>;
  /** Vidéos les plus récentes d'abord ; `recherche` : une partie du nom. */
  listerVideos(acces: string, o?: { recherche?: string; suite?: string; parPage?: number }): Promise<PageVideosDrive>;
  infosVideo(acces: string, id: string): Promise<VideoDrive>;
  /** Octets [debut, fin[ du fichier (requête « Range ») : jamais le fichier entier en mémoire. */
  lirePlage(acces: string, id: string, debut: number, fin: number): Promise<Uint8Array>;
  lireVignette(acces: string, id: string): Promise<{ type: string; octets: Uint8Array } | null>;
  /** Retire l'accès chez Google (déconnexion). Sans erreur si le jeton est déjà mort. */
  revoquer(jeton: string): Promise<void>;
}
