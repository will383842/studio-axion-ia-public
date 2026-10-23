/**
 * FIN PROPRE COMMUNE (14/10, « les vidéos s'arrêtent net ») : mesuré sur les vidéos du studio, le son se coupait en plein
 * bruit de fond ou après un silence numérique, et l'écran final était encore en mouvement à la dernière image, sans
 * fondu. Désormais, à l'export : l'image finale reste posée `tenueSec`, puis image ET son s'effacent ensemble sur
 * `fonduSec` vers la couleur du fond de la dernière carte (`ParametresExport.finPropre`).
 *
 * Le contrôle `controleFinPropre` (PUR) relit la mesure du fichier exporté et refuse une vidéo dont la fin n'est pas
 * propre : son qui ne descend pas sous `SON_FIN_MAX_DB` à la dernière 0,1 s, ou image encore mobile.
 */
export const FIN_PROPRE_COMMUNE = Object.freeze({
  /** Fondu image + son (s). */
  fonduSec: 0.45,
  /** Image finale tenue avant le fondu (s). */
  tenueSec: 0.6,
  /** Fond de la dernière carte (ivoire clair des cartes finales, mesuré le 14/10 : #F2EEE4). */
  couleur: "0xF2EEE4",
});

/** Niveau (dB) sous lequel le son doit être à la toute dernière 0,1 s. */
export const SON_FIN_MAX_DB = -60;
/** Écart moyen (sur 255) toléré entre les deux dernières images : au-delà, l'image bouge encore. */
export const MOUVEMENT_FIN_MAX = 1.5;

export interface MesureFinVideo {
  /** Niveau du son sur la dernière 0,1 s (dB, -100 = silence numérique). */
  sonDerniere100msDb: number;
  /** Écart moyen entre les deux dernières images (0-255). */
  mouvementDerniereImage: number;
}

/** Liste des défauts de la fin d'une vidéo exportée (vide : fin propre). PUR. */
export function controleFinPropre(m: MesureFinVideo): string[] {
  const defauts: string[] = [];
  if (!Number.isFinite(m.sonDerniere100msDb) || m.sonDerniere100msDb > SON_FIN_MAX_DB) defauts.push(`la vidéo s'arrête net : le son n'est pas éteint à la fin (${Number.isFinite(m.sonDerniere100msDb) ? m.sonDerniere100msDb.toFixed(0) : "non mesuré"} dB, au plus ${SON_FIN_MAX_DB} dB)`);
  if (!Number.isFinite(m.mouvementDerniereImage) || m.mouvementDerniereImage > MOUVEMENT_FIN_MAX) defauts.push("la vidéo s'arrête net : l'image bouge encore à la dernière image (pas de fondu)");
  return defauts;
}

/** Message de l'alerte quand la fin n'est pas propre (sans bloquer l'export). */
export const ALERTE_FIN_NON_PROPRE = "La vidéo s'arrête net : la fin propre (image tenue puis fondu image et son) n'est pas en place.";

/**
 * Lit les mesures d'un fichier exporté (`sonDerniere100msDb`, `mouvementDerniereImage`, rendues par `mesurerExport`) et
 * rend les défauts de la fin. `mesuree: false` : une mesure manque (export d'avant, mesure en panne) — dit « non
 * mesuré », jamais « propre ». PUR.
 */
export function controleFinDesMesures(mesures: Readonly<Record<string, number | undefined>> | undefined): { mesuree: boolean; defauts: string[] } {
  const son = mesures?.sonDerniere100msDb;
  const image = mesures?.mouvementDerniereImage;
  if (typeof son !== "number" || typeof image !== "number") return { mesuree: false, defauts: [] };
  return { mesuree: true, defauts: controleFinPropre({ sonDerniere100msDb: son, mouvementDerniereImage: image }) };
}
