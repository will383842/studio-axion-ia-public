/**
 * HIGGSFIELD ET OPTIONS PAYANTES (lot J). Serveur seulement.
 *
 * POINT D'ENTRÉE pour l'option « ultra réaliste » des effets main (lot I2, fusionné ; réglage pas encore écrit), pour
 * l'effet réaliste par IA (lot K) et pour toute passe Higgsfield à venir : la passe demande son fournisseur ICI au lieu d'appeler
 * `fournisseurHiggsfield` directement.
 *  - simulation (`reel` faux) : le double, rien à confirmer (aucune dépense) ;
 *  - réel : si la version du travail porte une confirmation valide, le client réel GARDÉ (la confirmation est
 *    consommée au premier lancement) ; sinon la demande est créée (carte sur « Votre vidéo ») et la passe doit sortir
 *    la version gratuite (effet normal, sans ultra réaliste).
 * Même sans passer par ici, le client réel refuse tout lancement sans garde : aucune dépense possible.
 */
import "server-only";
import { fournisseurHiggsfield, type FournisseurHiggsfield, type ModeleHiggsfield } from "@/fournisseurs/higgsfield";
import { journaliser } from "./_commun";
import { preparerOptionPayante } from "./options-payantes";

export type ResultatHiggsfieldOption = { statut: "pret"; higgsfield: FournisseurHiggsfield } | { statut: "a-confirmer" | "plafond" | "coupee" | "non-confirmee"; message: string };

export async function higgsfieldPourOption(
  optionId: "decor-ia" | "effets-main-ultra" | "effet-realiste-ia",
  o: { travailId: string; reel: boolean; dureeSec: number; passagesSec?: number[]; modele?: ModeleHiggsfield },
  env: Record<string, string | undefined> = process.env,
): Promise<ResultatHiggsfieldOption> {
  if (!o.reel) return { statut: "pret", higgsfield: fournisseurHiggsfield({}, env) };
  const accord = await preparerOptionPayante(optionId, { travailId: o.travailId, dureeSec: o.dureeSec, ...(o.passagesSec ? { passagesSec: o.passagesSec } : {}), ...(o.modele ? { modele: o.modele } : {}) });
  if (accord.statut !== "autorisee") {
    await journaliser("fabrication", accord.message);
    return accord;
  }
  return { statut: "pret", higgsfield: fournisseurHiggsfield({ reel: true, garde: accord.garde }, env) };
}

/** Raccourci pour I2 : l'option « ultra réaliste » des effets main, pour les passages (secondes) à retoucher. */
export function higgsfieldUltraRealisteMain(o: { travailId: string; reel: boolean; passagesSec: number[]; modele?: ModeleHiggsfield }, env?: Record<string, string | undefined>) {
  return higgsfieldPourOption("effets-main-ultra", { ...o, dureeSec: o.passagesSec.reduce((t, d) => t + d, 0) }, env);
}
