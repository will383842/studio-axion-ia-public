/**
 * VOIX ÉPINGLÉE (L1-05) : la seule voix HeyGen qui a le droit de parler dans une vidéo du studio. Toute synthèse HeyGen
 * résout sa voix par cette constante ; une autre voix (ou le doublon « Ma voix HeyGen ») est refusée AVANT la dépense.
 */
export const VOIX_MAITRE_HEYGEN_ID = "77ea2dbe3115461a911cfe478e22bc48";

/** Doublon « Ma voix HeyGen » : refusé explicitement, quoi qu'il arrive. */
export const VOIX_HEYGEN_INTERDITES: readonly string[] = Object.freeze(["f22784b5"]);

/** Refus d'une voix qui n'est pas la voix maître, avant tout appel au fournisseur. */
export class VoixNonEpingleeError extends Error {
  readonly code = "VOIX_NON_EPINGLEE";
  readonly reessayable = false;
  constructor(readonly messagePourWill: string) {
    super(messagePourWill);
    this.name = "VoixNonEpingleeError";
  }
}

const interdite = (id: string): boolean => VOIX_HEYGEN_INTERDITES.some((p) => id.toLowerCase().startsWith(p));

const REFUS = "Ce n'est pas votre voix habituelle : rien n'a été dépensé. Dans Personnages, Voix, choisissez votre voix HeyGen d'origine.";

/** Lève `VoixNonEpingleeError` si l'identifiant de voix HeyGen résolu n'est pas la voix maître. */
export function exigerVoixMaitreHeygen(idVoix: string | null | undefined): void {
  if (!idVoix || interdite(idVoix) || idVoix !== VOIX_MAITRE_HEYGEN_ID) throw new VoixNonEpingleeError(REFUS);
}

/** Contrôle commun (décision de Will du 18/10) : toute voix qui n'est pas celle de HeyGen (autre fournisseur ou autre identifiant) est refusée avant la dépense. */
export function exigerVoixMaitre(fournisseur: string, idVoix: string | null | undefined): void {
  if (fournisseur !== "heygen") throw new VoixNonEpingleeError(REFUS);
  exigerVoixMaitreHeygen(idVoix);
}
