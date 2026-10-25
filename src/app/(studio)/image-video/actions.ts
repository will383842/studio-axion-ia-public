"use server";

/**
 * Actions serveur de l'onglet « Image → vidéo » (lot L16). Même modèle que les autres écrans : un Resultat sérialisable,
 * la session vérifiée par le service. Rien de payant ne part sans un montant affiché ET confirmé par Will.
 */
import { revalidatePath } from "next/cache";
import type { AccordPrix } from "@/domaine/accord";
import type { CarteImage } from "@/domaine/image-video/carte";
import type { FicheImage } from "@/domaine/image-video/fiche";
import type { RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { ChoixFormule } from "@/moteurs/montage-image-video/regles";
import { essayer, type Resultat } from "@/services/_commun";
import type { PastilleControle } from "@/domaine/relecture-script";
import { controlerScriptImageVideo } from "@/services/image-video-scripts";
import { arreterLotImageVideo, deposerLotImageVideo, refaireVideoDuLot, reprendreLotImageVideo, type DemandeLotIV, type IssueLotIV } from "@/services/image-video-lot";
import { deposerTexteImageVideo, type DemandeDepotTexteIV, type IssueDepotTexteIV } from "@/services/image-video-texte";
import { deposerImageVideo, validerCarteEtReprendre, validerScriptEtReprendre, type DemandeDepotIV, type IssueDepotIV, type IssueRepriseIV } from "@/services/image-video-ecran";

/** Écran 1 · « Lancer » : l'image déposée, les réseaux, l'offre et le montant confirmé. */
export async function deposerImageVideoAction(demande: DemandeDepotIV): Promise<Resultat<IssueDepotIV>> {
  const r = await essayer(() => deposerImageVideo(demande));
  if (r.ok && r.donnees.statut === "lancee") revalidatePath("/videos");
  return r;
}

/** Écran 1 · mode texte : « Décrivez-la avec vos mots » ; mêmes réseaux, même prix confirmé, aucune image. */
export async function deposerTexteImageVideoAction(demande: DemandeDepotTexteIV): Promise<Resultat<IssueDepotTexteIV>> {
  const r = await essayer(() => deposerTexteImageVideo(demande));
  if (r.ok && r.donnees.statut === "lancee") revalidatePath("/videos");
  return r;
}

/** Écran 2 · « Valider la carte » : la carte corrigée (ou rien : la carte proposée), puis la suite. */
export async function validerCarteImageVideoAction(videoId: string, carte?: CarteImage): Promise<Resultat<IssueRepriseIV>> {
  const r = await essayer(() => validerCarteEtReprendre(videoId, carte));
  if (r.ok) revalidatePath(`/image-video/${videoId}`);
  return r;
}

/** Écran 3 · « Valider et fabriquer » : le script (modifié ou non), les choix sur les formules, le prix confirmé. */
export async function validerScriptImageVideoAction(
  videoId: string,
  decision: { fiche?: FicheImage; choixFormules: Record<string, ChoixFormule>; ajoutsWill: string[]; variete?: Partial<RecetteVarieteIV> },
  accord?: AccordPrix,
): Promise<Resultat<IssueRepriseIV>> {
  const r = await essayer(() => validerScriptEtReprendre(videoId, decision, accord));
  if (r.ok) revalidatePath(`/image-video/${videoId}`);
  return r;
}

/** Écran 3 « Relire le script » (réglage `imageVideo.relireScript`) : contrôles en direct, GRATUITS, rien n'est gardé. */
export async function controlerScriptImageVideoAction(videoId: string, script: { fiche?: FicheImage; choixFormules?: Record<string, ChoixFormule>; ajoutsWill?: string[] }): Promise<Resultat<PastilleControle[]>> {
  return essayer(() => controlerScriptImageVideo(videoId, script));
}

/** Écran 1 · « Fabriquer les N vidéos » : les images déposées, les réseaux, l'offre et le montant TOTAL confirmé. */
export async function deposerLotImageVideoAction(demande: DemandeLotIV): Promise<Resultat<IssueLotIV>> {
  const r = await essayer(() => deposerLotImageVideo(demande));
  if (r.ok && r.donnees.statut === "lancee") revalidatePath("/image-video");
  return r;
}

/** Page du lot · « Arrêter le lot » : plus aucun lancement ; la vidéo en cours va au bout. */
export async function arreterLotImageVideoAction(lotId: string): Promise<Resultat<Awaited<ReturnType<typeof arreterLotImageVideo>>>> {
  const r = await essayer(() => arreterLotImageVideo(lotId));
  if (r.ok) revalidatePath(`/image-video/lot/${lotId}`);
  return r;
}

/** Page du lot · « Reprendre le lot » : la réservation est revérifiée ; un refus garde la pause avec sa phrase. */
export async function reprendreLotImageVideoAction(lotId: string): Promise<Resultat<Awaited<ReturnType<typeof reprendreLotImageVideo>>>> {
  const r = await essayer(() => reprendreLotImageVideo(lotId));
  if (r.ok) revalidatePath(`/image-video/lot/${lotId}`);
  return r;
}

/** Page du lot · « Refaire » : une nouvelle vidéo de la même image, par le parcours d'une image seule (prix confirmé). */
export async function refaireVideoDuLotAction(lotId: string, rang: number, accordCentimes?: AccordPrix): Promise<Resultat<IssueDepotIV>> {
  const r = await essayer(() => refaireVideoDuLot(lotId, rang, { accordCentimes }));
  if (r.ok) revalidatePath(`/image-video/lot/${lotId}`);
  return r;
}
