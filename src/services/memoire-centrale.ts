/**
 * MÉMOIRE COMMUNE BRANCHÉE SUR L'ÉCRITURE CENTRALE (lot C3), côté studio. Réglage `ecriture.memoireCentrale`, COUPÉ par défaut
 * (seul `true` exact l'allume ; Will le règle lui-même, aucun code ne l'allume). Coupé : rien n'est lu, rien n'est enregistré,
 * la chaîne courte écrit exactement comme avant. Ne dépense rien, n'appelle aucun fournisseur. TOUT échec (base indisponible,
 * source illisible) est silencieux pour l'écriture : on rend « pas de mémoire » et l'écriture continue.
 * L'avocat n'entre jamais ; un script de Will (origine « will ») non plus. Chaîne courte seulement.
 */
import "server-only";
import { memoireCentraleApplicable, type MemoireCentrale } from "@/domaine/ecriture-commune/memoire-centrale";
import type { OrigineScript } from "@/domaine/ecriture-commune/ressemblance";
import { PHRASES_BANQUE_FINS } from "@/briques/fins/banque";
import { lireParametre } from "./_commun";
import { memoireEcriture, noterScriptCentral, scriptsCentraux } from "./memoire-ecriture";

export const REGLAGE_MEMOIRE_CENTRALE = "ecriture.memoireCentrale";

/** Allumé seulement si le réglage vaut exactement `true` ; toute autre valeur, ou une lecture qui échoue : éteint. */
export async function memoireCentraleAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(REGLAGE_MEMOIRE_CENTRALE, false)) === true;
  } catch {
    return false;
  }
}

/** La mémoire à passer à la chaîne courte, ou `null` (réglage coupé, avocat, script de Will, mémoire illisible ou vide). */
export async function preparerMemoireCentrale(entree: { formatId: string; origine?: OrigineScript; nomsSensibles?: readonly string[]; allumee?: boolean }): Promise<MemoireCentrale | null> {
  try {
    if (!memoireCentraleApplicable(entree.formatId, entree.origine) || !(entree.allumee ?? (await memoireCentraleAllumee()))) return null;
    const m = await memoireEcriture({ nomsSensibles: entree.nomsSensibles, tolere: PHRASES_BANQUE_FINS });
    const appelsRecents = (await scriptsCentraux()).flatMap((x) => x.appels ?? []);
    if (!m.scripts.length && !appelsRecents.length) return null;
    return { bloc: m.bloc, anciens: m.scripts, appelsRecents, origine: entree.origine };
  } catch (erreur) {
    console.error("[studio] mémoire centrale illisible, l'écriture continue sans elle", erreur);
    return null;
  }
}

/**
 * Enregistre un script central accepté (fenêtre de 60, partagée). LIMITE : la liste est lue puis réécrite sans verrou ; deux
 * écritures simultanées peuvent perdre un script (sans conséquence sur l'écriture : la mémoire n'est qu'une aide). Silencieux en cas d'échec ; sans effet réglage coupé. */
export async function enregistrerScriptCentral(entree: { texte: string; formatId: string; origine?: OrigineScript; appels?: string[] }): Promise<void> {
  try {
    if (!entree.texte.trim() || !memoireCentraleApplicable(entree.formatId, entree.origine) || !(await memoireCentraleAllumee())) return;
    await noterScriptCentral({ texte: entree.texte, formatId: entree.formatId, appels: entree.appels });
  } catch (erreur) {
    console.error("[studio] mémoire centrale : script non enregistré, l'écriture continue", erreur);
  }
}
