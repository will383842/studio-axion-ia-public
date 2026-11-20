/**
 * Envoi planifié (D7-01) : une entrée du calendrier d'envoi, une par vidéo, réseau et version de créneau.
 * Rien ne part sans la validation du fondateur : `programme` ne mène jamais directement à `a-envoyer`,
 * il faut passer par `confirme` (geste explicite). Aucun envoi réel ici : ce module ne fait que décrire l'état.
 */
import type { EntiteBase, DateIso, Id, ReseauDeclinaison } from "./types";

export type StatutEnvoi = "brouillon" | "valide" | "programme" | "confirme" | "a-envoyer" | "envoye" | "echec" | "annule";

export const TRANSITIONS_ENVOI: Record<StatutEnvoi, readonly StatutEnvoi[]> = {
  brouillon: ["valide", "annule"],
  valide: ["programme", "annule"],
  // « envoye » : constaté par le diffuseur (Zernio « published ») pour un envoi programmé à la main, jamais par un geste du Studio.
  programme: ["confirme", "valide", "annule", "envoye"],
  confirme: ["a-envoyer", "programme", "annule"],
  "a-envoyer": ["envoye", "echec"],
  echec: ["programme", "annule"],
  envoye: [],
  annule: [],
};

export interface EnvoiPlanifie extends EntiteBase {
  /** Clé stable : identique tant que la version du créneau ne change pas. Sert aussi d'identifiant. */
  cle: string;
  /** Identifiant du MÉDIA (vidéo ou visuel, selon `nature`), comme `identifiantsProgrammation` du plan éditorial. Jamais renommé. */
  videoId: Id;
  /** Nature du média ; absent = vidéo. */
  nature?: "video" | "visuel";
  /** Le créneau du plan d'origine. */
  creneauId?: string;
  /** Clé de 64 signes hexadécimaux réellement envoyée au diffuseur en `metadata.studioCle` (= `Publication.cleEnvoi`) ; jamais recalculée. */
  cleDiffuseur?: string;
  reseau: ReseauDeclinaison;
  versionCreneau: number;
  /** AAAA-MM-JJ, heure de Paris. */
  jour: string;
  /** « 09:30 » (HH:MM, heure de Paris) ; jamais une « meilleure heure » inventée. */
  heure?: string;
  statut: StatutEnvoi;
  valideeLe?: DateIso;
  valideePar?: string;
  consentementTiktok?: boolean;
  niveauConfidentialiteTiktok?: string;
  envoyeLe?: DateIso;
}

/** Forme de la clé du diffuseur : sha256 en hexadécimal minuscule. */
export const CLE_DIFFUSEUR = /^[0-9a-f]{64}$/;

export function cleEnvoi(videoId: Id, reseau: ReseauDeclinaison, versionCreneau: number): string {
  return `envoi:${videoId}:${reseau}:v${versionCreneau}`;
}

/** Clé propre à UN créneau : utilisée quand la clé ancienne appartient déjà à un autre créneau. */
export function cleEnvoiCreneau(videoId: Id, reseau: ReseauDeclinaison, versionCreneau: number, creneauId: string): string {
  return `${cleEnvoi(videoId, reseau, versionCreneau)}:${creneauId}`;
}

export function peutTransiter(de: StatutEnvoi, vers: StatutEnvoi): boolean {
  return TRANSITIONS_ENVOI[de].includes(vers);
}

/**
 * RETOUR-PUBLISHED-2 · garde STRICTE de « constaté par le diffuseur » pour un envoi resté « valide » (cas REC-V1 : l'envoi est parti chez
 * Zernio mais la réponse a été ambiguë, la marque est restée « a-verifier »). `valide → envoye` n'est PAS une transition ouverte
 * (`TRANSITIONS_ENVOI`) : seule cette garde, appelée par le suivi du « published » confirmé, l'autorise. Les trois conditions sont requises.
 */
export function constateParLeDiffuseur(envoi: Pick<EnvoiPlanifie, "statut">, marques: { promotion?: unknown; aVerifier?: unknown }, publicationZernioPubliee: boolean): boolean {
  return envoi.statut === "valide" && publicationZernioPubliee && (marques.promotion === "a-verifier" || marques.aVerifier === "a-verifier");
}
