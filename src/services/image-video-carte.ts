/**
 * CARTE DE L'IMAGE · « Voici ce que j'ai compris » (lot L15, décision B6).
 *
 * - `apercuCarteImageVideo(videoId)` : la carte proposée par la lecture (écarts, alertes, doutes), si elle attend Will.
 * - `validerCarteImageVideo(videoId, { carte })` : la carte (corrigée ou non) est contrôlée par la machine (mêmes
 *   règles que la fabrication) ; refus en phrases, rien n'est gardé. Acceptée : la décision est gardée pour la vidéo
 *   (`imageVideo.decisions.<videoId>`) et le compteur des cartes validées avance (au-delà de 10, le réglage
 *   `validationCarte` s'applique). « Réessayer » fait lire la décision par la machine : rien n'est repayé.
 *
 * Ne dépense rien. Aucune exception jusqu'à l'écran pour l'aperçu (au moindre doute : `null`).
 */
import "server-only";
import type { Id, Travail } from "@/domaine/types";
import type { CarteImage } from "@/domaine/image-video/carte";
import { ErreurDecisionIV, ID_MOTEUR_IV, validerCarteIV, type EtatFabricationIV, type PropositionCarteIV } from "@/moteurs/montage-image-video";
import { depots, ecrireParametre, ErreurStudio, journaliser, lireParametre } from "./_commun";
import { exigerSession } from "./auth";
import { avecCarteValidee, nombreCartesValidees, PARAM_CARTES_VALIDEES, PREFIXE_DECISIONS } from "./image-video";

/* Verrou du compteur des cartes validées : deux validations ne lisent jamais la même liste pour l'écrire chacune. */
const cleVerrou = Symbol.for("studio-axion-ia.image-video-cartes");
type AvecVerrou = typeof globalThis & { [cleVerrou]?: Promise<unknown> };
async function sousVerrouCartes<T>(f: () => Promise<T>): Promise<T> {
  const g = globalThis as AvecVerrou;
  const suite = (g[cleVerrou] ?? Promise.resolve()).catch(() => undefined).then(f);
  g[cleVerrou] = suite.catch(() => undefined);
  return suite;
}

/** État de la fabrication gardé dans un travail du format (`null` : absent ou illisible). PUR. */
export function etatDuTravail(travail: Pick<Travail, "parametres"> | null): EtatFabricationIV | null {
  const e = travail?.parametres?.imageVideo as EtatFabricationIV | undefined;
  return e && typeof e === "object" && e.version === "fabrication-iv/1" ? e : null;
}

/** Le dernier travail « Image → vidéo » d'une vidéo. */
export async function travailImageVideo(videoId: Id): Promise<Travail | null> {
  const d = depots();
  const versions = await d.versions.lister((v) => v.videoId === videoId && v.commande?.moteurId === ID_MOTEUR_IV);
  const derniere = versions.sort((a, b) => b.numero - a.numero)[0];
  return derniere?.travailId ? ((await d.travaux.obtenir(derniere.travailId)) ?? null) : null;
}

/** Décisions de Will gardées pour une vidéo. */
export async function decisionsDeLaVideo(videoId: Id): Promise<Record<string, unknown>> {
  return (await lireParametre<Record<string, unknown> | null>(`${PREFIXE_DECISIONS}${videoId}`, null)) ?? {};
}

export async function garderDecision(videoId: Id, quoi: "carte" | "script", decision: unknown): Promise<void> {
  await ecrireParametre(`${PREFIXE_DECISIONS}${videoId}`, { ...(await decisionsDeLaVideo(videoId)), [quoi]: decision });
}

/** La carte qui attend Will, avec ses doutes ; `null` sinon. Jamais d'exception. */
export async function apercuCarteImageVideo(videoId: Id): Promise<PropositionCarteIV | null> {
  await exigerSession();
  try {
    const etat = etatDuTravail(await travailImageVideo(videoId));
    return etat?.etape === "carte-a-valider" ? (etat.propositionCarte ?? null) : null;
  } catch {
    return null;
  }
}

/** « Valider la carte » (voir l'en-tête). */
export async function validerCarteImageVideo(videoId: Id, entree: { carte?: CarteImage; maintenant?: number } = {}): Promise<{ corrigee: boolean; cartesValidees: number }> {
  await exigerSession();
  const etat = etatDuTravail(await travailImageVideo(videoId));
  if (!etat?.propositionCarte || etat.etape !== "carte-a-valider") throw new ErreurStudio("CARTE_PAS_A_VALIDER", "Aucune carte n'attend votre validation pour cette vidéo.");
  const decision = { proposition: etat.propositionCarte.empreinte, ...(entree.carte ? { carte: entree.carte } : {}), le: new Date(entree.maintenant ?? Date.now()).toISOString() };
  try {
    validerCarteIV(etat, decision);
  } catch (err) {
    if (err instanceof ErreurDecisionIV) throw new ErreurStudio("CARTE_REFUSEE", [err.message, ...err.phrases].join(" "));
    throw err;
  }
  await garderDecision(videoId, "carte", decision);
  // Une vidéo n'est comptée qu'une fois (deux clics, revalidation après reprise), lecture et écriture sous verrou.
  const cartesValidees = await sousVerrouCartes(async () => {
    const garde = await lireParametre<unknown>(PARAM_CARTES_VALIDEES, []);
    const suite = avecCarteValidee(garde, videoId);
    if (suite) await ecrireParametre(PARAM_CARTES_VALIDEES, suite);
    return nombreCartesValidees(suite ?? garde);
  });
  await journaliser("video", `Carte de l'image validée${entree.carte ? " (corrigée)" : ""}`, { type: "video", id: videoId });
  return { corrigee: !!entree.carte, cartesValidees };
}
