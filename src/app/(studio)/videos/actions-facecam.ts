"use server";

/**
 * Actions serveur de « Votre vidéo » face caméra (plan facecam v4, lot D) : fil « Discuter avec mon monteur »,
 * consignes, coupes, image, version d'avant, habitudes et animations gardées. Chaque action renvoie un Resultat
 * sérialisable ; la session est vérifiée par chaque service.
 */
import { revalidatePath } from "next/cache";
import type { ImageFacecam } from "@/domaine/facecam";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import {
  ajouterHabitude,
  annulerConsigneMonteur,
  basculerCoupe,
  changerTexteCarte,
  deplacerCarte,
  discuterAvecMonteur,
  garderAnimation,
  renommerAnimation,
  retirerAnimation,
  lireInstant,
  releverPlafond,
  remettreCarteAuto,
  retirerCarteAuto,
  retirerHabitude,
  retirerPassage,
  reessayerEffetPassage,
  retoucherImage,
  validerMonLook,
  revenirVersionAvant,
  type AnimationGardee,
  type HabitudeMonteur,
  type ReponseFil,
} from "@/services/monteur-facecam";

function rafraichir(videoId?: string) {
  revalidatePath("/videos");
  if (videoId) revalidatePath(`/videos/${videoId}`);
}

export async function discuterAvecMonteurAction(videoId: string, texte: string, options: { dicte?: boolean; garderPourLesProchaines?: boolean } = {}): Promise<Resultat<ReponseFil>> {
  const r = await essayer(() => discuterAvecMonteur(videoId, texte, options));
  rafraichir(videoId);
  return r;
}

export async function annulerConsigneAction(videoId: string, consigneId: string): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(() => annulerConsigneMonteur(videoId, consigneId));
  rafraichir(videoId);
  return r;
}

export async function basculerCoupeAction(videoId: string, coupeId: string, retablir: boolean): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(() => basculerCoupe(videoId, coupeId, retablir));
  rafraichir(videoId);
  return r;
}

export async function retoucherImageAction(videoId: string, image: Partial<ImageFacecam>, garder: boolean): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(() => retoucherImage(videoId, image, { garder }));
  rafraichir(videoId);
  return r;
}

/** V6 P0 n° 5 : « C'est mon look » (premier usage, sans nouvelle version). */
export async function validerMonLookAction(videoId: string): Promise<Resultat<{ reference: boolean }>> {
  const r = await essayer(() => validerMonLook(videoId));
  rafraichir(videoId);
  return r;
}

export async function revenirVersionAvantAction(videoId: string): Promise<Resultat<{ versionId: string }>> {
  const r = await essayer(() => revenirVersionAvant(videoId));
  rafraichir(videoId);
  return r;
}

export async function garderAnimationAction(videoId: string, contenuCle: string, description: string): Promise<Resultat<AnimationGardee>> {
  const r = await essayer(() => garderAnimation(videoId, contenuCle, description));
  revalidatePath("/bibliotheque");
  return r;
}

export async function renommerAnimationAction(id: string, nom: string): Promise<Resultat<void>> {
  const r = await essayer(() => renommerAnimation(id, nom));
  revalidatePath("/bibliotheque");
  return r;
}

export async function retirerAnimationAction(id: string): Promise<Resultat<void>> {
  const r = await essayer(() => retirerAnimation(id));
  revalidatePath("/bibliotheque");
  return r;
}

export async function ajouterHabitudeAction(texte: string): Promise<Resultat<HabitudeMonteur>> {
  const r = await essayer(() => ajouterHabitude(texte));
  revalidatePath("/reglages");
  return r;
}

export async function retirerHabitudeAction(id: string): Promise<Resultat<void>> {
  const r = await essayer(() => retirerHabitude(id));
  revalidatePath("/reglages");
  return r;
}

export async function retirerPassageAction(videoId: string, passageId: string): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(() => retirerPassage(videoId, passageId));
  rafraichir(videoId);
  return r;
}

/** 10/10 : feuille « Cartes et effets » — retirer, remettre, déplacer, changer le texte (cartes automatiques comprises). */
export async function retirerCarteAutoAction(videoId: string, cle: string): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(() => retirerCarteAuto(videoId, cle));
  rafraichir(videoId);
  return r;
}

export async function remettreCarteAutoAction(videoId: string, cle: string): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(() => remettreCarteAuto(videoId, cle));
  rafraichir(videoId);
  return r;
}

export async function deplacerCarteAction(videoId: string, origine: "auto" | "monteur", id: string, instant: string): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(async () => {
    const sec = lireInstant(instant);
    if (sec === null) throw new ErreurStudio("INSTANT", "Indiquez un moment de la vidéo, par exemple 0:32.");
    return deplacerCarte(videoId, origine, id, sec);
  });
  rafraichir(videoId);
  return r;
}

export async function changerTexteCarteAction(videoId: string, origine: "auto" | "monteur", id: string, textes: string[]): Promise<Resultat<{ travailId: string }>> {
  const r = await essayer(() => changerTexteCarte(videoId, origine, id, textes));
  rafraichir(videoId);
  return r;
}

export async function reessayerEffetAction(videoId: string, passageId: string): Promise<Resultat<{ travailId?: string; aConfirmer?: boolean }>> {
  const r = await essayer(() => reessayerEffetPassage(videoId, passageId));
  rafraichir(videoId);
  return r;
}

export async function releverPlafondAction(nouveauUsd: number): Promise<Resultat<void>> {
  const r = await essayer(() => releverPlafond(nouveauUsd));
  revalidatePath("/reglages");
  return r;
}
