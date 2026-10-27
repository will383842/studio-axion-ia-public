/**
 * IMAGE → VIDÉO · Plafonds de durée appliqués RÉSEAU PAR RÉSEAU (plan 50 § 3, M6). PUR.
 *
 * La table et la règle en 4 cas vivent dans `domaine/image-video/plafonds.ts` (L1) ; ici on les applique aux durées
 * MESURÉES de chaque version : livrée / livrée avec mention / version courte / réseau non livré.
 * Durée totale d'un réseau = corps + question + fin, LinkedIn comme les autres (depuis le 26/10/2026 il dit et affiche la fin).
 */
import { PLAFONDS_IV, RESEAUX_IV, verdictPlafond, depasseLimiteDure, type ReseauIV, type VerdictPlafond } from "@/domaine/image-video/plafonds";

export type VersionLivree = "longue" | "courte" | "aucune";

export interface DureesSegments {
  corpsSec: number;
  /** 0 sans question de commentaire (réglage `fin-seule`, défaut). */
  questionSec: number;
  /** Fin dite et affichée (accroche, appel, lien), au plus 29 mots, soit 8 à 9 s à 3,3 mots/s ; 0 pour une vidéo LinkedIn d'avant le 26/10 (muette). */
  finSec: number;
}

export function dureeTotaleIV(_reseau: ReseauIV, d: DureesSegments): number {
  return d.corpsSec + d.questionSec + d.finSec;
}

export interface VerdictReseauIV {
  reseau: ReseauIV;
  nom: string;
  verdict: VerdictPlafond["verdict"];
  /** La version qui part sur ce réseau. */
  version: VersionLivree;
  dureeSec: number;
  /** Phrase pour Will ; absente quand la vidéo est livrée telle quelle. */
  phrase?: string;
  /** Seul le réseau non livré bloque ; la mention « un peu longue » ne bloque pas. */
  bloquant: boolean;
}

/**
 * Verdict d'un réseau. `versionCourteSec` : absent = pas encore taillée (la version courte est demandée) ;
 * `null` = aucun chapitre détachable ; un nombre = durée mesurée de la version courte, jugée à son tour.
 * Jamais de livraison d'une version longue au-delà d'une limite dure (Facebook 90 s).
 */
export function verdictReseau(reseau: ReseauIV, dureeSec: number, versionCourteSec?: number | null): VerdictReseauIV {
  const v = verdictPlafond(reseau, dureeSec, versionCourteSec);
  const nom = PLAFONDS_IV[reseau].nom;
  const courteJugee = versionCourteSec !== undefined && versionCourteSec !== null && v.dureeSec === versionCourteSec && versionCourteSec !== dureeSec;
  const version: VersionLivree = v.verdict === "non-livree" ? "aucune" : courteJugee || v.verdict === "version-courte" ? "courte" : "longue";
  if (version === "longue" && depasseLimiteDure(reseau, v.dureeSec)) {
    // Garde-fou : la règle ne doit jamais le permettre.
    return { reseau, nom, verdict: "non-livree", version: "aucune", dureeSec: v.dureeSec, phrase: `Trop longue pour ${nom} (${Math.round(v.dureeSec)} s) : raccourcissez le script ou retirez ce réseau`, bloquant: true };
  }
  return {
    reseau,
    nom,
    verdict: v.verdict,
    version,
    dureeSec: v.dureeSec,
    ...("phrase" in v ? { phrase: v.phrase } : {}),
    bloquant: v.verdict === "non-livree",
  };
}

/** Les verdicts de plusieurs réseaux, dans l'ordre fixe des réseaux. */
export function verdictsParReseau(
  durees: Readonly<Partial<Record<ReseauIV, number>>>,
  courtes: Readonly<Partial<Record<ReseauIV, number | null>>> = {},
): VerdictReseauIV[] {
  return RESEAUX_IV.filter((r) => durees[r] !== undefined).map((r) => verdictReseau(r, durees[r] as number, courtes[r]));
}

/** Quel réseau reçoit la version courte pour une durée donnée, sans version courte encore mesurée. */
export function versionsPourDuree(dureeSec: number, reseaux: readonly ReseauIV[] = RESEAUX_IV): Record<string, VersionLivree> {
  return Object.fromEntries(reseaux.map((r) => [r, verdictReseau(r, dureeSec).version]));
}
