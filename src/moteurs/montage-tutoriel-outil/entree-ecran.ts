/**
 * ENTRÉE « SOURCE D'ÉCRAN » DU TUTORIEL (facultative, lecteur pur, G15-06).
 * Lit `entrees.tutorielOutil.sourceEcran` = `{ cle, suivi }` : clé du fichier d'écran + suivi (G15-01).
 * Absent ou mal formé → `entree: null` (le tutoriel d'aujourd'hui) + remarques, jamais d'exception.
 * Aucun appel à Claude, aucun accès disque. `lireEntreesTutoriel` (entrees.ts) n'est pas modifié.
 */
import { lireSuiviSourceEcran, type SuiviSourceEcran } from "../../domaine/source-ecran";

export interface EntreeEcranTutoriel {
  /** Clé du fichier d'écran. */
  cle: string;
  suivi: SuiviSourceEcran;
}

export function lireEntreeEcranTutoriel(
  entrees: Record<string, unknown> | undefined,
): { entree: EntreeEcranTutoriel | null; remarques: string[] } {
  try {
    const e = entrees?.["tutorielOutil"];
    if (!e || typeof e !== "object") return { entree: null, remarques: [] };
    const brut = (e as Record<string, unknown>).sourceEcran;
    if (brut === undefined || brut === null) return { entree: null, remarques: [] };
    if (typeof brut !== "object" || Array.isArray(brut)) return { entree: null, remarques: ["sourceEcran : entrée non objet"] };
    const o = brut as Record<string, unknown>;
    const cle = typeof o.cle === "string" ? o.cle.trim() : "";
    if (!cle) return { entree: null, remarques: ["sourceEcran : clé du fichier absente"] };
    const { suivi, remarques } = lireSuiviSourceEcran(o.suivi);
    if (!suivi) return { entree: null, remarques: ["sourceEcran : suivi inutilisable", ...remarques] };
    return { entree: { cle, suivi }, remarques };
  } catch {
    return { entree: null, remarques: ["sourceEcran : lecture impossible"] };
  }
}
