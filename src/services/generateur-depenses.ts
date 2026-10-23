/**
 * CE QUE WILL VOIT AVANT TOUTE FABRICATION PAYANTE depuis le générateur (vérification E2E n° 1, problèmes n° 3, 5, 24 ;
 * plan v5 Partie A n° 6, B.6.6) : le prix, le total du jour avant et après, le budget du mois restant et les crédits des
 * outils. Lecture seule.
 *
 * E2E-2 argent n° 7, 6, 16 (03/10) :
 *  - « Essai : rien ne sera payé » seulement quand AUCUN outil payant ne sera appelé ; double simulé mais voix HeyGen
 *    reliée : la phrase dit exactement ce qui sera payé (la voix) et ce qui ne l'est pas (le double) ;
 *  - le total du jour et le budget ne comptent que ce qui est VRAIMENT payé (jamais les montants simulés) ; le budget
 *    restant déduit aussi ce qui est engagé par les fabrications en cours ;
 *  - jour et mois en heure de Paris.
 */
import "server-only";
import type { Montant } from "@/domaine/types";
import { idFournisseur } from "@/domaine/credits";
import { additionner, centimes, formaterMontant } from "@/lib/montants";
import { FORMAT_CAS_CONCRET } from "@/components/formats/cas-concret/aiguillage";
import { formatSansPrix, listerFormatsActifs } from "@/formats";
import { depots, fournisseurSimule } from "./_commun";
import { exigerSession } from "./auth";

export interface ResumeDepenseAffiche {
  /** Prix de ce qui va être lancé (« 1,12 € »). */
  prix: string;
  /** Total dépensé aujourd'hui, avant et après ce lancement. */
  jourAvant: string;
  jourApres: string;
  /** Budget du mois qui reste après ce lancement. */
  budgetRestant: string;
  /** Crédits des outils payants concernés (« Double », « Écriture »), quand ils sont connus. */
  credits: { nom: string; disponible: string }[];
  /** RIEN ne sera payé (aucun outil payant relié) : pastille ESSAI sur chaque montant. */
  essai: boolean;
  /** Phrase exacte sur ce qui sera payé (« Essai : rien ne sera payé. », ou « Le double est un essai… la voix sera payée »). */
  messageEssai?: string;
  /** Au-delà du repère de confirmation (alerte ambre). */
  auDelaDuRepere: boolean;
  /** E2E-2 parcours n° 28 : le budget du mois ne permet pas ce lancement (bouton grisé, lien vers Réglages). */
  budgetInsuffisant?: boolean;
}

/** Résumé de dépense pour un montant donné (pur, testable). `depenseMois` : dépensé ET engagé ce mois-ci. */
export function resumeDepense(
  prix: Montant,
  ctx: { jour: Montant; budgetMois: Montant; depenseMois: Montant; seuil: Montant; credits: { nom: string; disponible: string }[]; essai: boolean; messageEssai?: string },
): ResumeDepenseAffiche {
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 4) : un essai ne s'ajoute ni au total du jour ni au budget (rien n'est payé).
  const paye = ctx.essai ? centimes(0) : prix;
  const apres = additionner(ctx.jour, paye);
  const disponible = ctx.budgetMois.centimes - ctx.depenseMois.centimes;
  const restant = centimes(Math.max(0, disponible - paye.centimes));
  return {
    prix: formaterMontant(prix),
    jourAvant: formaterMontant(ctx.jour),
    jourApres: formaterMontant(apres),
    budgetRestant: formaterMontant(restant),
    credits: ctx.credits,
    essai: ctx.essai,
    messageEssai: ctx.messageEssai ?? (ctx.essai ? "Essai : rien ne sera payé." : undefined),
    auDelaDuRepere: paye.centimes > ctx.seuil.centimes,
    budgetInsuffisant: paye.centimes > Math.max(0, disponible),
  };
}

/** CORRECTEUR FINAL A : la vidéo partira au moteur d'essai (interrupteurs éteints). */
export const MESSAGE_ESSAI_INTERRUPTEURS = "Essai : rien ne sera payé. La vidéo sera une démonstration, pas encore la vôtre : pour la vraie, allumez « Votre avatar parle dans le studio » puis « Montage réel » (Réglages › Connexions).";

/** Noms simples des outils payants d'une fabrication. */
const NOMS_PAYANTS: Record<string, string> = { heygen: "HeyGen", elevenlabs: "ElevenLabs", fal: "fal.ai" };

/**
 * Ce qui sera VRAIMENT payé à la fabrication : la voix (voix reliée à HeyGen ou ElevenLabs, clé présente), le double
 * (visage non simulé), les illustrations fabriquées (fal.ai relié). Moteur d'essai : rien. Lecture seule, aucun appel réseau.
 */
export async function partPayee(formatIds?: string[]): Promise<{ rienNestPaye: boolean; doubleSimule: boolean; voixPayee: string[]; message?: string }> {
  // CORRECTEUR FINAL A (VERIF-E2E-1 n° 4) : les connexions ne suffisent pas. Si le moteur décidé au lancement est
  // celui d'essai (interrupteurs « Votre avatar parle » / « Montage réel » éteints), la vidéo est une démonstration :
  // ni le double ni les illustrations ne sont payés, même avec des outils « Reliés » (seule la voix reliée l'est).
  const { moteurAuLancement } = await import("./reglages");
  // Un format sans prix (face caméra : Will se filme, ni voix ni double) ne paie rien : il ne décide pas de l'essai.
  // Le cas concret a son propre écran et son propre prix (`/cas-concret`) : il ne passe pas par cette feuille et ne décide pas de l'essai.
  const formats = (formatIds?.length ? [...new Set(formatIds)] : listerFormatsActifs().map((f) => f.id)).filter((f) => !formatSansPrix(f) && f !== FORMAT_CAS_CONCRET);
  const moteurEssai = formats.length > 0 && (await Promise.all(formats.map((f) => moteurAuLancement(f)))).every((m) => m === "simulation");
  const [{ vueCredits }] = await Promise.all([import("./credits")]);
  const [cartes, visageSimule, illustrationsSimulees, voix] = await Promise.all([vueCredits({ relire: false }).catch(() => []), fournisseurSimule("visage"), fournisseurSimule("illustration"), depots().voix.lister((v) => v.statut === "pret")]);
  const cles = new Set(cartes.filter((c) => c.clePresente).map((c) => c.fournisseur));
  // RELECTURE FINALE G3 : le moteur d'essai n'appelle aucune voix (et le serveur refuse ce lancement en production) :
  // même reliée, la voix n'est pas payée ; la feuille montre la pastille Essai.
  const voixPayee = moteurEssai ? [] : [...new Set(voix.map((v) => idFournisseur(v.fournisseur ?? "")).filter((f) => (f === "heygen" || f === "elevenlabs") && cles.has(f)))];
  const doubleSimule = visageSimule || moteurEssai;
  const doublePaye = !doubleSimule && cles.has("heygen");
  const illustrationsPayees = !moteurEssai && !illustrationsSimulees && cles.has("fal");
  const rienNestPaye = !voixPayee.length && !doublePaye && !illustrationsPayees;
  // Le double est relié mais le moteur est l'essai : le geste à faire est d'allumer les interrupteurs.
  const interrupteurs = moteurEssai && !visageSimule;
  let message: string | undefined;
  if (rienNestPaye) message = interrupteurs ? MESSAGE_ESSAI_INTERRUPTEURS : "Essai : rien ne sera payé.";
  else if (doubleSimule && voixPayee.length) message = `Le double est encore un essai : il n'est pas payé. La voix (${voixPayee.map((f) => NOMS_PAYANTS[f] ?? f).join(", ")}) sera payée.`;
  return { rienNestPaye, doubleSimule, voixPayee, message };
}

/** Lit le total du jour, le budget du mois et les crédits, puis construit le résumé pour ce prix. */
export async function lireResumeDepense(prix: Montant, formatIds?: string[]): Promise<ResumeDepenseAffiche> {
  await exigerSession();
  const [{ resumeBudget, jourParis, montantPaye }, { vueCredits }] = await Promise.all([import("./couts"), import("./credits")]);
  const jour = jourParis();
  const [budget, depenses, cartes, part] = await Promise.all([resumeBudget(), depots().depenses.lister(), vueCredits().catch(() => []), partPayee(formatIds)]);
  // Total du jour : ce qui est VRAIMENT payé aujourd'hui (heure de Paris), jamais les montants simulés.
  const duJour = additionner(...depenses.filter((d) => jourParis(d.date) === jour).map(montantPaye));
  const NOMS: Record<string, string> = { heygen: "Double", anthropic: "Écriture", elevenlabs: "Voix" };
  const credits = cartes
    .filter((c) => c.clePresente && NOMS[c.fournisseur])
    .map((c) => ({ nom: NOMS[c.fournisseur], disponible: c.disponibleTexte ?? c.soldeTexte ?? "inconnu" }));
  return resumeDepense(prix, { jour: duJour, budgetMois: budget.budget, depenseMois: additionner(budget.depense, budget.engage), seuil: budget.seuilConfirmation, credits, essai: part.rienNestPaye, messageEssai: part.message });
}
