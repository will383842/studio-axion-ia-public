/**
 * SCRIPT · « Votre script » (lot L15, décisions B3 et B7).
 *
 * - `apercuScriptImageVideo(videoId)` : le script écrit par Claude, ce que Will doit trancher (formules absolues,
 *   phrase-choc à reformuler, chacune avec sa version prudente) et le PRIX de la suite, annoncé avant tout paiement.
 * - `validerScriptImageVideo(videoId, { fiche, choixFormules, ajoutsWill }, accord)` : le script (modifié ou non) repasse
 *   TOUS les contrôles de la machine ; refus en phrases, rien n'est gardé. Accepté : la décision est gardée pour la vidéo ;
 *   « Réessayer » fabrique la vidéo (la voix n'est payée qu'après ce clic).
 * - Vitrine du LANCEUR (`lanceurIV`) : le lanceur avance dès qu'il relit la décision (aucun « Réessayer » ne la garde).
 *   La décision n'est donc écrite qu'AVEC l'accord du prix affiché (même écriture : jamais l'une sans l'autre) ; accord
 *   absent ou plus bas que le prix : rien n'est écrit, le prix est redemandé. La réservation de la voix lit ce montant.
 *
 * Ne dépense rien.
 */
import "server-only";
import type { Id } from "@/domaine/types";
import type { FicheImage } from "@/domaine/image-video/fiche";
import type { AccordPrix } from "@/domaine/accord";
import type { PastilleControle } from "@/domaine/relecture-script";
import { controlerScriptIV, type ScriptAControlerIV } from "@/moteurs/montage-image-video/controle-script";
import { CLE_LANCEUR_IV, ErreurDecisionIV, validerScriptIV, type PropositionScriptIV } from "@/moteurs/montage-image-video";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { ChoixFormule } from "@/moteurs/montage-image-video/regles";
import { ErreurStudio, journaliser } from "./_commun";
import { accordAutomatique } from "./mode-budget";
import { exigerSession } from "./auth";
import { etatDuTravail, garderDecision, travailImageVideo } from "./image-video-carte";

/** Le script qui attend Will, avec ses points à trancher et son prix ; `null` sinon. Jamais d'exception. */
export async function apercuScriptImageVideo(videoId: Id): Promise<PropositionScriptIV | null> {
  await exigerSession();
  try {
    const etat = etatDuTravail(await travailImageVideo(videoId));
    return etat?.etape === "script-a-valider" ? (etat.propositionScript ?? null) : null;
  } catch {
    return null;
  }
}

/** Contrôles en direct du script relu (écran « Relire le script ») : les mêmes que la validation, GRATUITS, rien n'est gardé. */
export async function controlerScriptImageVideo(videoId: Id, entree: ScriptAControlerIV = {}): Promise<PastilleControle[]> {
  await exigerSession();
  const etat = etatDuTravail(await travailImageVideo(videoId));
  return etat ? controlerScriptIV(etat, entree) : [];
}

/** « Valider et fabriquer » (voir l'en-tête). */
export async function validerScriptImageVideo(
  videoId: Id,
  entree: { fiche?: FicheImage; choixFormules?: Record<string, ChoixFormule>; ajoutsWill?: string[]; variete?: Partial<RecetteVarieteIV> } = {},
  accord?: AccordPrix,
): Promise<{ modifie: boolean; lanceur: boolean }> {
  await exigerSession();
  const travail = await travailImageVideo(videoId);
  const etat = etatDuTravail(travail);
  if (!etat?.propositionScript || etat.etape !== "script-a-valider") throw new ErreurStudio("SCRIPT_PAS_A_VALIDER", "Aucun script n'attend votre validation pour cette vidéo.");
  const lanceur = travail?.parametres?.[CLE_LANCEUR_IV] === true;
  const montant = prixAffiche(etat.propositionScript);
  // Mode indicatif (ordre du 25/10) : le prix du jour vaut accord, le lanceur n'attend plus un prix confirmé à la main.
  const accordBrut = typeof accord === "number" && Number.isFinite(accord) ? accord : undefined;
  const auto = lanceur ? await accordAutomatique(accordBrut ?? false, montant, { videoId }) : accordBrut;
  const accordCentimes = typeof auto === "number" ? auto : undefined;
  if (lanceur && (accordCentimes === undefined || accordCentimes < montant)) {
    // Pas « CONFIRMATION_REQUISE » : la reprise par « Réessayer » ne garderait pas la décision ; Will valide de nouveau.
    throw new ErreurStudio("ACCORD_PRIX_REQUIS", `Rien n'est payé : la suite coûte au plus ${(montant / 100).toFixed(2).replace(".", ",")} €. Validez de nouveau en confirmant ce prix.`, montant);
  }
  const decision = {
    proposition: etat.propositionScript.empreinte,
    ...(entree.fiche ? { fiche: entree.fiche } : {}),
    choixFormules: entree.choixFormules ?? {},
    ajoutsWill: entree.ajoutsWill ?? [],
    ...(entree.variete ? { variete: entree.variete } : {}),
    ...(lanceur ? { accordCentimes } : {}),
  };
  try {
    validerScriptIV(etat, decision);
  } catch (err) {
    if (err instanceof ErreurDecisionIV) throw new ErreurStudio("SCRIPT_REFUSE", [err.message, ...err.phrases].join(" "));
    throw err;
  }
  await garderDecision(videoId, "script", decision);
  await journaliser("video", `Script « Image → vidéo » validé${entree.fiche ? " (modifié)" : ""}`, { type: "video", id: videoId });
  return { modifie: !!entree.fiche, lanceur };
}

/** Le prix affiché sur « Valider et fabriquer » (même calcul que l'écran du script). PUR. */
export function prixAffiche(p: Pick<PropositionScriptIV, "prix">): number {
  return Math.max(p.prix.auPlusCentimes, p.prix.habituelCentimes);
}
