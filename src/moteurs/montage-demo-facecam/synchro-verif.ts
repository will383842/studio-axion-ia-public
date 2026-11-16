/**
 * G3-07 : confiance de la synchronisation de la démo (ancres, écart). Pure, non câblée : la chaîne ne l'appelle pas.
 * Ne lève jamais, même sur entrée incomplète.
 */

/** Ancres concordantes à partir desquelles la synchro par l'audio est sûre. */
export const ANCRES_MIN_SURE = 5;
/** Sous ce nombre d'ancres (la synchro en exige 2), la synchro par l'audio n'est pas exploitable. */
export const ANCRES_MIN_SYNCHRO = 2;
/** Part de la durée facecam au-delà de laquelle un décalage paraît suspect. */
export const PART_DECALAGE_MAX = 0.5;

export type ModeSynchroVerif = "audio" | "debut" | "fourni" | "aucune";

export interface EntreeConfianceSynchro {
  synchro: { mode: ModeSynchroVerif; decalageSec: number };
  /** Nombre d'ancres concordantes (mode audio). */
  ancres?: number;
  dureeFacecamSec?: number;
  /** `true` : le mode « début » est un repli (ancres introuvables), pas un choix de Williams. */
  repli?: boolean;
}

export interface ConfianceSynchro {
  niveau: "sure" | "a-verifier";
  raison: string;
  reserve?: string;
}

const sure = (raison: string): ConfianceSynchro => ({ niveau: "sure", raison });
const averifier = (raison: string, regarder: string): ConfianceSynchro => ({ niveau: "a-verifier", raison, reserve: `À vérifier : ${regarder}` });

const nombre = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function confianceSynchro(e: EntreeConfianceSynchro): ConfianceSynchro {
  try {
    const mode = e?.synchro?.mode;
    if (mode === "fourni" || mode === "aucune") return sure(mode === "fourni" ? "décalage fourni par Williams" : "aucune synchro demandée");
    if (mode === "debut") {
      if (e.repli === true) {
        return averifier("repli sur le début, ancres introuvables", "votre voix n'a pas été retrouvée dans l'enregistrement d'écran, regardez si l'écran et le visage sont bien calés.");
      }
      return sure("calage sur le début choisi par Williams");
    }
    if (mode === "audio") {
      const n = e.ancres;
      if (!nombre(n) || n < ANCRES_MIN_SURE) {
        const txt = nombre(n) ? `${n} ancre${n > 1 ? "s" : ""}` : "nombre d'ancres inconnu";
        return averifier(`synchro par l'audio peu appuyée (${txt})`, "le calage s'appuie sur peu de mots communs, regardez si l'écran suit bien votre voix.");
      }
      const d = e.synchro.decalageSec;
      const dur = e.dureeFacecamSec;
      if (nombre(d) && nombre(dur) && dur > 0 && Math.abs(d) > PART_DECALAGE_MAX * dur) {
        return averifier("décalage supérieur à la moitié de la durée facecam", "le décalage trouvé est très grand, regardez si l'écran commence au bon moment.");
      }
      return sure(`${n} ancres concordantes`);
    }
    return averifier("mode de synchronisation inconnu", "la synchronisation n'a pas pu être jugée, regardez si l'écran et le visage sont bien calés.");
  } catch {
    return averifier("entrée illisible", "la synchronisation n'a pas pu être jugée, regardez si l'écran et le visage sont bien calés.");
  }
}
