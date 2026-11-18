/**
 * G12-09a-b : état de reprise au pas « rendu » depuis le projet gardé (retouche gratuite). Pur, NON BRANCHÉ : rien n'importe ce fichier
 * (le branchement dans `index.ts` est G12-09b, chef). Aucun appel Claude, aucune recherche de vidéos, aucune IA du plan de scènes :
 * l'état rendu ne repasse ni par « mise-en-scene » ni par « videos », et `planScenes` est recopié.
 * `coupes.mots` n'est pas gardé par le projet : il est recalculé par `couperPriseV4` (pure) depuis la transcription gardée et le texte
 * de la demande, et n'est accepté que si les gardes recalculées sont IDENTIQUES à celles du projet (avec ou sans fin douce, réglage
 * non gardé). Sinon `null` : la reprise gratuite est refusée plutôt que rendue avec d'autres sous-titres.
 */
import type { MotHorodate } from "@/domaine/types";
import { couperPriseV4, VERSION_CHAINE_V4, type DemandeChaineV4, type EtatChaineV4, type FichierVideoV4, type ChoixVideoV4 } from "./chaine-v4";
import { manquesRetoucheGratuiteV4, type ProjetGardeV4 } from "./retouche-gratuite";

const motValide = (m: unknown): m is MotHorodate => {
  const x = m as Partial<MotHorodate> | null;
  return !!x && typeof x === "object" && typeof x.mot === "string" && Number.isFinite(x.debutSec) && Number.isFinite(x.finSec);
};

/** `null` (jamais d'exception) si une pièce indispensable manque ou si les coupes ne se retrouvent pas à l'identique. */
export function etatRepriseAuRenduV4(projet: ProjetGardeV4, demande: DemandeChaineV4): EtatChaineV4 | null {
  try {
    if (!projet?.plan || !projet.transcription || !Array.isArray(projet.gardes) || !projet.gardes.length) return null;
    if (manquesRetoucheGratuiteV4(projet).length) return null;
    const { mots, dureeSec } = projet.transcription;
    if (!Array.isArray(mots) || !mots.length || !mots.every(motValide)) return null;
    const entree = { mots: mots as MotHorodate[], dureeSec, ...(demande.texteValide ? { texteValide: demande.texteValide } : {}) };
    const gardes = JSON.stringify(projet.gardes.map((g) => [g.debutSec, g.finSec]));
    const coupes = [false, true]
      .map((finDouce) => couperPriseV4({ ...entree, ...(finDouce ? { finDouce: true } : {}) }))
      .find((c) => JSON.stringify(c.gardes.map((g) => [g.debutSec, g.finSec])) === gardes);
    if (!coupes || !coupes.mots.length) return null;
    const fichiers = structuredClone((projet.videos?.fichiers ?? []) as FichierVideoV4[]);
    const choix = projet.videos?.choix?.length ? structuredClone(projet.videos.choix as ChoixVideoV4[]) : undefined;
    return {
      version: VERSION_CHAINE_V4,
      etape: "rendu",
      demande: structuredClone(demande),
      transcription: structuredClone({ mots: mots as MotHorodate[], dureeSec }),
      ...(projet.cadrage ? { cadrage: structuredClone(projet.cadrage) } : {}),
      coupes: structuredClone({ gardes: projet.gardes, dureeSec: coupes.dureeSec, mots: coupes.mots, controle: coupes.controle }),
      realisation: { version: "complete", essais: 0, avertissements: 0, plan: structuredClone(projet.plan) },
      videos: { fichiers, ...(choix ? { choix } : {}), retirees: [], manques: [] },
      ...(projet.planScenes ? { planScenes: structuredClone(projet.planScenes) } : {}),
    };
  } catch {
    return null;
  }
}
