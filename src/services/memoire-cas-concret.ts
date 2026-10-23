/**
 * MÉMOIRE COMMUNE BRANCHÉE SUR L'ÉCRITURE DU CAS CONCRET (lot C4), côté studio. Réglage `ecriture.memoireCasConcret`, COUPÉ par
 * défaut (seul `true` exact l'allume ; Will le règle lui-même, aucun code ne l'allume), distinct de `ecriture.memoireCentrale`.
 * Coupé : rien n'est lu, rien n'est enregistré, le cas concret écrit exactement comme avant. Ne dépense rien, n'appelle aucun
 * fournisseur. TOUT échec (base indisponible, source illisible) est silencieux : on rend « pas de mémoire » et l'écriture
 * continue. Même schéma que le lot C3 (`memoire-centrale.ts`) : fenêtre de 60 partagée entre générateurs.
 * L'avocat n'entre jamais ; un script de Will (origine « will ») n'est jamais contrôlé : il reste « à éviter » par le script
 * validé, lu par la source du cas concret (`scriptsDejaEcrits`).
 */
import "server-only";
import { memoireCentraleApplicable, type MemoireCentrale } from "@/domaine/ecriture-commune/memoire-centrale";
import type { OrigineScript } from "@/domaine/ecriture-commune/ressemblance";
import { FORMAT_CAS_CONCRET, type MemoireCommuneEcriture } from "@/moteurs/montage-cas-concret/memoire-commune";
import { lireParametre } from "./_commun";
import * as memoire from "./memoire-ecriture";

export const REGLAGE_MEMOIRE_CAS_CONCRET = "ecriture.memoireCasConcret";

/** Allumé seulement si le réglage vaut exactement `true` ; toute autre valeur, ou une lecture qui échoue : éteint. */
export async function memoireCasConcretAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(REGLAGE_MEMOIRE_CAS_CONCRET, false)) === true;
  } catch {
    return false;
  }
}

/**
 * La mémoire à passer à l'écriture, ou `null` (réglage coupé, avocat, script de Will, mémoire illisible ou vide).
 * `tolere` : les phrases imposées du format, jamais comptées comme déjà dites. `sauf` : la vidéo qui s'écrit.
 * LIMITE : `sauf` n'écarte que les scripts du cas concret déjà écrits pour cette vidéo ; un script enregistré au fonds central
 * (`noterScriptCentral`) ne garde pas l'identifiant de sa vidéo. Une nouvelle version peut donc se comparer à la précédente de
 * la même vidéo et donner une alerte inutile (ALERTE seulement : rien n'est relancé ni repayé).
 */
export async function preparerMemoireCasConcret(entree: { tolere: readonly string[]; sauf?: string; origine?: OrigineScript }): Promise<MemoireCentrale | null> {
  try {
    if (!memoireCentraleApplicable(FORMAT_CAS_CONCRET, entree.origine) || !(await memoireCasConcretAllumee())) return null;
    const m = await memoire.memoireEcriture({ sauf: entree.sauf, tolere: entree.tolere });
    if (!m.scripts.length) return null;
    return { bloc: m.bloc, anciens: m.scripts, origine: entree.origine };
  } catch (erreur) {
    console.error("[studio] mémoire du cas concret illisible, l'écriture continue sans elle", erreur);
    return null;
  }
}

/**
 * Enregistre le texte dit d'un script accepté (fenêtre de 60, partagée), sans doublon. LIMITE : la liste est lue puis réécrite
 * sans verrou ; deux écritures simultanées peuvent perdre un script (la mémoire n'est qu'une aide). Silencieux en cas d'échec ;
 * sans effet réglage coupé.
 */
export async function enregistrerScriptCasConcret(entree: { texte: string; formatId?: string; origine?: OrigineScript }): Promise<void> {
  try {
    const formatId = entree.formatId ?? FORMAT_CAS_CONCRET;
    if (!entree.texte.trim() || !memoireCentraleApplicable(formatId, entree.origine) || !(await memoireCasConcretAllumee())) return;
    if ((await memoire.scriptsCentraux()).some((x) => x.texte === entree.texte)) return;
    await memoire.noterScriptCentral({ texte: entree.texte, formatId });
  } catch (erreur) {
    console.error("[studio] mémoire du cas concret : script non enregistré, l'écriture continue", erreur);
  }
}

/** L'outil que le chemin de dépense du cas concret donne à l'écriture (`OutilsEcriture.memoireCommune`). */
export function memoireCommuneDuStudio(): MemoireCommuneEcriture {
  return {
    preparer: (tolere, sauf) => preparerMemoireCasConcret({ tolere, sauf }),
    enregistrer: (texte) => enregistrerScriptCasConcret({ texte }),
  };
}
