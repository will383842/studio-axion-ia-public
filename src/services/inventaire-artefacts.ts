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
 * Clés de `travail.parametres` PROUVÉES par chemin:ligne (une clé n'entre que prouvée) : `voix` (montage-avocat/index.ts:1275-1276)
 * et `tableau` (travaux.ts:835, plan du tableau animé SEULEMENT). `planIds` = plans À RETOUCHER (travaux.ts:928), pas un plan gardé.
 * `rendus-scenes` : aucune clé prouvée, donc jamais `via-travail`.
 */
const CLES_TRAVAIL: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = Object.freeze({
  "tableau-anime": Object.freeze({ plan: Object.freeze(["tableau"]), voix: Object.freeze(["voix"]) }),
  "*": Object.freeze({ voix: Object.freeze(["voix"]) }),
});

function porteParLeTravail(travail: TravailInventaire | undefined, formatId: string, artefact: string): boolean {
  const p = travail && typeof travail === "object" ? travail.parametres : undefined;
  if (!p || typeof p !== "object") return false;
  const table = Object.prototype.hasOwnProperty.call(CLES_TRAVAIL, formatId) ? CLES_TRAVAIL[formatId] : CLES_TRAVAIL["*"];
  const cles = Object.prototype.hasOwnProperty.call(table, artefact) ? table[artefact] : [];
  return cles.some((cle) => {
    if (!Object.prototype.hasOwnProperty.call(p, cle)) return false;
    const v = p[cle];
    return v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0);
  });
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
