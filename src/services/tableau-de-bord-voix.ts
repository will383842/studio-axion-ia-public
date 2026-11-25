/**
 * Voix du tableau de bord (G4-09c) : un module PAR INJECTION avec sa garde de plafond. ÉTEINT : aucun importeur,
 * aucun réglage lu, aucune porte d'argent appelée ici. Le plafond de voix est une garde propre à ce module (le plafond
 * propre des appels Claude ne compte pas la voix). Types STRUCTURELS recopiés : aucun import.
 */

/** Plafond de voix en centimes d'euro par vidéo : accepté le 21/11 07:20 (1 € par vidéo au plus). L'allumage reste éteint par défaut. */
export const PLAFOND_VOIX_TDB_CENTIMES_PROPOSE = 100;

interface MotLu { mot: string; debutSec: number; finSec: number }
interface VoixRendue { audio: string; dureeSec: number; mots: MotLu[] }

export interface OptionsVoixTableauDeBord {
  /** Lecture réelle de la voix (injectée). */
  lire: (texte: string) => Promise<VoixRendue>;
  /** Réservation (injectée), appelée UNE fois, AVANT la première lecture, avec caractères × lectures. */
  reserver: (e: { caracteres: number; lectures: number; centimes: number }) => Promise<void> | void;
  /** Nombre de lectures au plus pour la vidéo. */
  lecturesMax: number;
  /** Plafond de voix, en centimes d'euro. */
  plafondCentimes: number;
  /** Tarif en centimes d'euro par caractère. */
  tarifCentimesParCaractere: number;
}

/** Prix au plus d'une vidéo : ⌈caractères × tarif⌉ × lectures. */
export const prixVoixCentimes = (caracteres: number, lectures: number, tarif: number): number => Math.ceil(caracteres * tarif) * lectures;

/** Rend `{ lire(texte) }`, compatible avec le port de voix de la chaîne. Refus = exception, AVANT toute lecture. */
export function voixTableauDeBord(o: OptionsVoixTableauDeBord): { lire: (texte: string) => Promise<VoixRendue> } {
  let lectures = 0;
  let reservation: Promise<void> | null = null;
  let caracteresReserves = 0;
  return {
    async lire(texte) {
      const caracteres = texte.length;
      // Réglages illisibles ou absurdes : refus AVANT toute lecture et toute réservation (sans montant dans le message).
      if (!(Number.isFinite(o.tarifCentimesParCaractere) && o.tarifCentimesParCaractere > 0)) throw new Error("Voix du tableau de bord refusée : tarif illisible.");
      if (!(Number.isFinite(o.plafondCentimes) && o.plafondCentimes >= 0)) throw new Error("Voix du tableau de bord refusée : plafond illisible.");
      if (!Number.isFinite(o.lecturesMax)) throw new Error("Voix du tableau de bord refusée : nombre de lectures illisible.");
      const lecturesMax = Math.max(0, Math.floor(o.lecturesMax));
      if (lectures >= lecturesMax) throw new Error(`Voix du tableau de bord : ${lecturesMax} lecture${lecturesMax > 1 ? "s" : ""} au plus.`);
      if (reservation === null) {
        const prix = prixVoixCentimes(caracteres, lecturesMax, o.tarifCentimesParCaractere);
        if (!(prix <= o.plafondCentimes)) throw new Error("Voix du tableau de bord refusée : prix au-dessus du plafond.");
        caracteresReserves = caracteres;
        lectures += 1;
        reservation = Promise.resolve(o.reserver({ caracteres: caracteres * lecturesMax, lectures: lecturesMax, centimes: prix }));
      } else {
        // Une relecture plus longue que ce qui a été réservé dépasserait le prix annoncé : refusée.
        if (caracteres > caracteresReserves) throw new Error("Voix du tableau de bord refusée : texte plus long que celui réservé.");
        lectures += 1;
      }
      await reservation;
      return o.lire(texte);
    },
  };
}
