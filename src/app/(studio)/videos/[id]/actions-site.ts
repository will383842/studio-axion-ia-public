"use server";

/**
 * Actions serveur du bloc « Sur le site » de la fiche vidéo (lot S3). Chacune commence par exigerSession().
 * Aucune n'envoie rien tant que Will n'a pas coché la case et relu la feuille ; l'envoi passe par le fournisseur « site »
 * (en simulation : le site factice).
 */
import { revalidatePath } from "next/cache";
import type { PasseportWeb, VueFeuilleSurLeSite } from "@/domaine/site-videos/types";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { cocherAucunClient, cocherSurLeSite, feuilleSurLeSite, modifierPasseport, publierSurLeSite, reecrirePasseport, retirerDuSite, type RetouchePasseport } from "@/services/site-videos";

function rafraichir(videoId: string): void {
  revalidatePath(`/videos/${videoId}`);
  revalidatePath("/sur-le-site");
}

export async function chargerFeuilleAction(videoId: string): Promise<Resultat<VueFeuilleSurLeSite>> {
  await exigerSession();
  return essayer(() => feuilleSurLeSite(videoId));
}

export async function cocherSurLeSiteAction(videoId: string, choisie: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await cocherSurLeSite(videoId, choisie);
    rafraichir(videoId);
    return undefined;
  });
}

export async function cocherAucunClientAction(videoId: string, coche: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await cocherAucunClient(videoId, coche);
    rafraichir(videoId);
    return undefined;
  });
}

export async function modifierPasseportAction(videoId: string, retouche: RetouchePasseport): Promise<Resultat<PasseportWeb>> {
  await exigerSession();
  return essayer(async () => {
    const p = await modifierPasseport(videoId, retouche);
    rafraichir(videoId);
    return p;
  });
}

export async function reecrirePasseportAction(videoId: string): Promise<Resultat<PasseportWeb>> {
  await exigerSession();
  return essayer(async () => {
    const p = await reecrirePasseport(videoId);
    rafraichir(videoId);
    return p;
  });
}

/** Publie ou met à jour. Une panne du site n'est pas une erreur ici : l'état « échec » et sa phrase reviennent à l'écran. */
export async function publierSurLeSiteAction(videoId: string): Promise<Resultat<{ etat: string; message?: string }>> {
  await exigerSession();
  return essayer(async () => {
    const e = await publierSurLeSite(videoId);
    rafraichir(videoId);
    return { etat: e.etat, ...(e.derniereErreur ? { message: e.derniereErreur } : {}) };
  });
}

export async function retirerDuSiteAction(videoId: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await retirerDuSite(videoId);
    rafraichir(videoId);
    return undefined;
  });
}
