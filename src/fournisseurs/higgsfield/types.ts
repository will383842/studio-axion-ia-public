/**
 * FOURNISSEUR HIGGSFIELD — contrat (plan facecam v4 n° 32, lot L10 « Décor IA », option désactivée par défaut).
 *
 * Deux modèles de retouche vidéo, essayés le 08/10 (PLAN-IMPLEMENTATION-FACECAM, « RÉSULTATS DE L'ESSAI », « Essai v2 ») :
 * - `flux_3_video_edit` (FLUX 3 Video Edit) : décor décrit par une phrase, 15 s au plus par passage, 1 crédit/s,
 *   pas d'image de référence (le décor peut varier d'un passage à l'autre) ;
 * - `kling_video_edit` (Kling 3.0 Omni Edit) : même chose AVEC une image de référence du décor, qui garantit le même
 *   décor partout (≈ 2 crédits/s, devis vérifié : 30 crédits pour 15 s).
 *
 * Règle d'or (v4 n° 24) : une brique ratée n'empêche jamais la livraison. Rien ici ne lève : toute panne devient un
 * résultat `{ ok: false }` ou un état `echec` typé, que la brique décor traite (repli sur la vidéo d'origine).
 * La clé `HIGGSFIELD_API_KEY` reste côté serveur et n'apparaît jamais dans un message.
 */

export const MODELES_HIGGSFIELD = ["flux_3_video_edit", "kling_video_edit"] as const;
export type ModeleHiggsfield = (typeof MODELES_HIGGSFIELD)[number];

/** Durée maximale d'un passage envoyé (s). FLUX : 15 s publiés ; Kling : 15 s retenus (devis du 08/10). */
export const DUREE_MAX_PASSAGE_SEC: Record<ModeleHiggsfield, number> = { flux_3_video_edit: 15, kling_video_edit: 15 };

/** Crédits Higgsfield par seconde envoyée (essai du 08/10 : FLUX 1/s ; Kling 30 crédits / 15 s). */
export const CREDITS_PAR_SECONDE: Record<ModeleHiggsfield, number> = { flux_3_video_edit: 1, kling_video_edit: 2 };

/** Le modèle exige-t-il une image de référence du décor ? */
export const IMAGE_REFERENCE_EXIGEE: Record<ModeleHiggsfield, boolean> = { flux_3_video_edit: false, kling_video_edit: true };

/** Crédits annoncés pour un passage : seconde entamée = seconde comptée. */
export function creditsPourPassage(modele: ModeleHiggsfield, dureeSec: number): number {
  return Math.ceil(Math.max(0, dureeSec) - 1e-6) * CREDITS_PAR_SECONDE[modele];
}

export type CodeErreurHiggsfield =
  | "cle-absente"
  | "cle-refusee"
  | "solde-insuffisant"
  | "refuse" // contenu refusé (visage, droits…) ou demande invalide
  | "trop-long"
  | "indisponible" // réseau, 429, 5xx : réessayable
  | "illisible"
  | "inconnu";

export interface ErreurHiggsfield {
  code: CodeErreurHiggsfield;
  reessayable: boolean;
  /** Phrase simple, sans clé ni montant. */
  message: string;
}

export type ResultatHiggsfield<T> = ({ ok: true } & T) | { ok: false; erreur: ErreurHiggsfield };

export type TypeMedia = "video/mp4" | "video/quicktime" | "image/png" | "image/jpeg" | "image/webp";

export interface MediaAEnvoyer {
  nom: string;
  type: TypeMedia;
  octets: Uint8Array;
}

export interface DemandeEditionVideo {
  modele: ModeleHiggsfield;
  /** Vidéo du passage, déjà envoyée (`envoyerMedia`). */
  videoMediaId: string;
  /** Consigne de décor (la même pour tous les passages d'une vidéo). */
  consigne: string;
  /** Image de référence du décor (la même pour tous les passages) ; obligatoire pour Kling. */
  imageReferenceMediaId?: string;
  dureeSec: number;
  /**
   * Préréglage proposé par Higgsfield et REFUSÉ, pour que la consigne soit appliquée telle quelle (paramètre
   * `declined_preset_id` vu dans le connecteur ; voir API.md).
   */
  prereglageRefuseId?: string;
  /** Identifiant stable (vidéo + passage) : sert d'en-tête d'idempotence si l'API le permet. */
  idempotence: string;
}

export interface ResultatEdition {
  /** Adresse de téléchargement (présignée) de la vidéo produite. */
  url: string;
  dureeSec: number;
  largeur: number;
  hauteur: number;
  /** Cadence de la sortie (24 i/s à l'essai du 08/10). */
  ips: number;
  /** Crédits réellement débités (absent : on compte le devis). */
  creditsDebites?: number;
}

export type EtatTravailHiggsfield =
  | { statut: "en_file" }
  | { statut: "en_cours"; progression: number }
  | { statut: "termine"; resultat: ResultatEdition }
  | { statut: "echec"; erreur: ErreurHiggsfield; creditsDebites?: number };

export interface FournisseurHiggsfield {
  id: "higgsfield" | "simulation";
  mode: "reel" | "simulation";
  /** Solde du compte, en crédits. */
  lireSolde(): Promise<ResultatHiggsfield<{ credits: number }>>;
  /** media_upload → PUT présigné → confirm. */
  envoyerMedia(media: MediaAEnvoyer): Promise<ResultatHiggsfield<{ mediaId: string }>>;
  lancer(demande: DemandeEditionVideo): Promise<ResultatHiggsfield<{ idTravail: string }>>;
  suivre(idTravail: string): Promise<EtatTravailHiggsfield>;
  telecharger(url: string): Promise<ResultatHiggsfield<{ octets: Uint8Array }>>;
}

export const erreurHiggsfield = (code: CodeErreurHiggsfield, message: string, reessayable = code === "indisponible"): { ok: false; erreur: ErreurHiggsfield } => ({
  ok: false,
  erreur: { code, reessayable, message },
});

/** Contrôle d'une demande AVANT tout appel (aucune dépense sur une demande invalide). */
export function verifierDemande(d: DemandeEditionVideo): ErreurHiggsfield | null {
  if (!MODELES_HIGGSFIELD.includes(d.modele)) return { code: "refuse", reessayable: false, message: "Modèle de décor inconnu." };
  if (!(d.dureeSec > 0)) return { code: "refuse", reessayable: false, message: "Passage vide." };
  if (d.dureeSec > DUREE_MAX_PASSAGE_SEC[d.modele] + 0.05) return { code: "trop-long", reessayable: false, message: `Passage trop long (${DUREE_MAX_PASSAGE_SEC[d.modele]} s au plus).` };
  if (IMAGE_REFERENCE_EXIGEE[d.modele] && !d.imageReferenceMediaId) return { code: "refuse", reessayable: false, message: "Image de référence du décor manquante." };
  if (!d.consigne.trim()) return { code: "refuse", reessayable: false, message: "Consigne de décor vide." };
  return null;
}
