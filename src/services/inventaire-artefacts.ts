/**
 * Inventaire des artefacts d'une vidéo (G12-03) : LECTURE SEULE. Dit, par pièce attendue, ce qui est gardé sur la
 * version (`present`), ce qui n'est joignable que par le travail (`via-travail`, `travail.parametres.*`) ou rien (`absent`).
 * Aucune écriture, aucun réseau, aucun argent, aucun effacement ; rien n'est branché au chat dans cette fiche.
 * Pas de 2e registre : les pièces attendues viennent de `DECLARATIONS` (G1-05a), les lecteurs prouvés de
 * `LECTEURS_ARTEFACTS` (G12-04). Un artefact non vérifiable n'est JAMAIS « present ».
 */
import { declarationDuFormat } from "../generateurs/declaration";
import { LECTEURS_ARTEFACTS, type EntreeResultat } from "../moteurs/contrat-artefacts";

export type EtatArtefact = "present" | "via-travail" | "absent";

export interface PieceInventaire {
  readonly artefact: string;
  readonly etat: EtatArtefact;
  /** Faux : l'emplacement sur la version n'est pas prouvé (G12-04) ; `present` est alors impossible. */
  readonly verifiable: boolean;
  readonly raison?: string;
}

/** Ce qui est gardé d'une vidéo (version choisie) : le format et ce que le moteur a rendu. */
export type VideoInventaire = { readonly formatId: string } & Partial<EntreeResultat>;
export interface TravailInventaire { readonly parametres?: Readonly<Record<string, unknown>> }

/**
 * Preuves de `travail.parametres` (une clé n'entre que prouvée par chemin:ligne) :
 * - `voix` : gardée SEULEMENT si `phase === "faite"` ET `audio.fichierCle` non vide (src/domaine/double-reel.ts:37-39 ; type EtatVoix
 *   src/moteurs/montage-avocat/index.ts:189-200). Un travail avocat naît avec `{ phase: "a-lire" }` (montage-avocat/index.ts:1253) : pas une voix faite.
 *   Écrite par le seul moteur montage-avocat (src/moteurs/index.ts:32, :136) ; critère strict, donc acceptable pour tous les formats.
 * - `tableau` : plan du tableau animé SEULEMENT (travaux.ts:835), tableau non vide.
 * `planIds` = plans À RETOUCHER (travaux.ts:928), pas un plan gardé. `rendus-scenes` : aucune clé prouvée, jamais `via-travail`.
 */
type Preuve = (p: Readonly<Record<string, unknown>>) => boolean;
const voixFaite: Preuve = (p) => {
  const v = p.voix as { phase?: unknown; audio?: { fichierCle?: unknown } } | null | undefined;
  return !!v && typeof v === "object" && v.phase === "faite" && typeof v.audio?.fichierCle === "string" && v.audio.fichierCle.length > 0;
};
const tableauNonVide: Preuve = (p) => Array.isArray(p.tableau) ? p.tableau.length > 0 : !!p.tableau && typeof p.tableau === "object" && Object.keys(p.tableau).length > 0;
const PREUVES: Readonly<Record<string, Readonly<Record<string, Preuve>>>> = Object.freeze({
  "tableau-anime": Object.freeze({ plan: tableauNonVide, voix: voixFaite }),
  "*": Object.freeze({ voix: voixFaite }),
});

function porteParLeTravail(travail: TravailInventaire | undefined, formatId: string, artefact: string): boolean {
  const p = travail && typeof travail === "object" ? travail.parametres : undefined;
  if (!p || typeof p !== "object") return false;
  const table = Object.prototype.hasOwnProperty.call(PREUVES, formatId) ? PREUVES[formatId] : PREUVES["*"];
  const preuve = Object.prototype.hasOwnProperty.call(table, artefact) ? table[artefact] : undefined;
  try { return !!preuve && preuve(p) === true; } catch { return false; }
}

/** Une pièce par artefact de la déclaration du format. Format inconnu ou entrée invalide : liste vide. Ne lève jamais. */
export function inventaireArtefacts(video: VideoInventaire, travail?: TravailInventaire): PieceInventaire[] {
  try {
    const declaration = declarationDuFormat(String(video?.formatId));
    if (!declaration) return [];
    const lecteurs = Object.prototype.hasOwnProperty.call(LECTEURS_ARTEFACTS, declaration.formatId) ? LECTEURS_ARTEFACTS[declaration.formatId] : {};
    const entree: EntreeResultat = { projetMontage: video.projetMontage ?? {}, plans: video.plans, pistes: video.pistes };
    return declaration.artefacts.map((artefact): PieceInventaire => {
      const l = Object.prototype.hasOwnProperty.call(lecteurs, artefact) ? lecteurs[artefact] : undefined;
      const verifiable = typeof l === "function";
      let present = false;
      if (verifiable) { try { present = l(entree) === true; } catch { present = false; } }
      const raison = !verifiable && l && typeof l === "object" ? l.nonVerifiable : undefined;
      const etat: EtatArtefact = present ? "present" : porteParLeTravail(travail, declaration.formatId, artefact) ? "via-travail" : "absent";
      return raison ? { artefact, etat, verifiable, raison } : { artefact, etat, verifiable };
    });
  } catch {
    return [];
  }
}
