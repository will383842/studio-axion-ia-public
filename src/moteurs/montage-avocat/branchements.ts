/**
 * RACCORDS FACULTATIFS DU MOTEUR AVOCAT (mission H) : ce que les SERVICES branchent sur le moteur (pur, il n'importe
 * jamais un service), sur le modèle du face caméra (`montage-facecam/dependances.ts`).
 *
 *  - multicaméra (brique `multicamera`, JOURNAL-F4 « Ce qui reste » n° 1) : la passe `passeMulticameraAvocat`,
 *    appelée après le découpage d'une vidéo faite de prises filmées, SEULEMENT si la commande l'a demandée
 *    (`entrees.avocatMulticamera`, figé au lancement depuis le réglage caché `avocat.multicamera`, coupé par défaut ;
 *    ou consigne « Monteur, fais-le en 3 caméras »).
 * Absents (tests, simulation, réglage coupé) : rien n'est appelé, l'avocat est monté exactement comme avant.
 */
import type { PisteMulticamera } from "@/briques/multicamera/types";
import type { CommandeFabrication, MotHorodate, Ratio } from "@/domaine/types";

/** Clé de la commande (figée au lancement par le service). */
export const ENTREE_MULTICAMERA_AVOCAT = "avocatMulticamera";

/** La commande demande-t-elle la multicaméra ? (lecture tolérante : au moindre doute, non) */
export function multicameraDemandeeAvocat(c: Pick<CommandeFabrication, "entrees">): boolean {
  const brut = c.entrees?.[ENTREE_MULTICAMERA_AVOCAT];
  return brut === true || (!!brut && typeof brut === "object" && (brut as { actif?: unknown }).actif === true);
}

export interface DemandeMulticameraMoteur {
  travailId: string;
  commande: CommandeFabrication;
  /** Vidéo des prises assemblées (de face) et son maître. */
  priseCle: string;
  audioCle: string;
  dureeSec: number;
  ratio: Ratio;
  plans: { debutSec: number; finSec: number }[];
  mots: MotHorodate[];
  segments: { id: string; bloc: string; emphase?: string[] }[];
  /** Consignes dites au Monteur pour cette vidéo. */
  consignes: string[];
}

export type PasseMulticameraAvocat = (d: DemandeMulticameraMoteur) => Promise<PisteMulticamera | null>;

export interface ServicesAvocat {
  multicamera?: PasseMulticameraAvocat;
}

const cle = Symbol.for("studio-axion-ia.avocat-services");
type AvecServices = typeof globalThis & { [cle]?: ServicesAvocat };

export function brancherServicesAvocat(s: ServicesAvocat): void {
  (globalThis as AvecServices)[cle] = { ...((globalThis as AvecServices)[cle] ?? {}), ...s };
}

export function servicesAvocat(): ServicesAvocat {
  return (globalThis as AvecServices)[cle] ?? {};
}
