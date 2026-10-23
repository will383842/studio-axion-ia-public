/**
 * DÉLAI DE GARDE À LA LECTURE d'un rendu de `studio-rendu` (incident du 12/10, tableau animé figé 30 min) — AJOUT PUR :
 * seuls les appelants qui le posent s'en servent (`OutilsRenduCartes.garde`, `OutilsMontage.garde`) ; `suivreRendu`
 * reste tel quel pour les autres.
 *
 * Un rendu `en_cours` dont l'état n'a pas avancé depuis N minutes (réglable, `STUDIO_RENDU_SANS_NOUVELLE_MIN`, défaut
 * 15), ou que le serveur ne connaît plus (« inconnu » : conteneur redémarré, état en mémoire perdu), est rendu comme un
 * ÉCHEC réessayable au motif « Rendu sans nouvelle depuis N min ». L'appelant décide de la suite (nouvel identifiant).
 * Un rendu en file d'attente n'est pas surveillé ici (il attend son tour derrière d'autres montages).
 *
 * La veille (`VeilleRendu`) est gardée par l'appelant dans son propre état (JSON) : elle ne change que si l'état lu
 * change, ce qui laisse l'état de l'appelant stable tant que rien n'avance.
 */
import type { DemandeRendu, EtatRendu, ServiceRendu } from "../types";

/** Défaut prudent : un montage qui avance publie sa progression bien plus souvent. */
export const SANS_NOUVELLE_MIN_DEFAUT = 15;

/** Délai sans nouvelle (ms) de l'environnement (`STUDIO_RENDU_SANS_NOUVELLE_MIN`, minutes ≥ 1), sinon le défaut. */
export function delaiSansNouvelleMs(env: Record<string, string | undefined> = process.env): number {
  const min = Number(env.STUDIO_RENDU_SANS_NOUVELLE_MIN);
  return (Number.isFinite(min) && min >= 1 ? min : SANS_NOUVELLE_MIN_DEFAUT) * 60_000;
}

export interface GardeRendu {
  /** Délai sans nouvelle d'un rendu en cours (ms). */
  delaiMs: number;
  /** Horloge (tests). */
  maintenant?: () => number;
}

/** Dernier état lu (signature) et depuis quand il n'a pas changé (ms). */
export interface VeilleRendu {
  signature: string;
  depuis: number;
}

export interface LectureGardee {
  etat: EtatRendu;
  veille?: VeilleRendu;
  /** L'échec vient du délai de garde (rendu figé ou inconnu), pas du serveur. */
  sansNouvelle?: true;
}

const minutes = (ms: number) => Math.max(0, Math.round(ms / 60_000));

function signature(e: EtatRendu): string {
  if (e.statut === "en_cours") return `en_cours:${e.progression}`;
  if (e.statut === "en_file") return `en_file:${e.rang}`;
  return e.statut;
}

/** Lit l'état d'un rendu sous délai de garde. Ne soumet jamais rien. */
export async function lireRenduGarde(service: ServiceRendu, demande: DemandeRendu, veille: VeilleRendu | undefined, garde: GardeRendu): Promise<LectureGardee> {
  const maintenant = (garde.maintenant ?? Date.now)();
  const etat = await service.etat(demande.idRendu);
  if (etat.statut === "inconnu") {
    const depuis = minutes(maintenant - (veille?.depuis ?? maintenant));
    return { etat: { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: `Rendu sans nouvelle depuis ${depuis} min : le serveur de rendu ne le connaît plus.` } }, sansNouvelle: true };
  }
  const sig = signature(etat);
  const suite: VeilleRendu = veille && veille.signature === sig ? veille : { signature: sig, depuis: maintenant };
  if (etat.statut === "en_cours" && maintenant - suite.depuis >= garde.delaiMs) {
    return { etat: { statut: "echec", erreur: { code: "indisponible", reessayable: true, message: `Rendu sans nouvelle depuis ${minutes(garde.delaiMs)} min.` } }, sansNouvelle: true };
  }
  return { etat, veille: suite };
}
