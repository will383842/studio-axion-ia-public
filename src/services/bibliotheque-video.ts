/**
 * Entrée figée au lancement (C1-U8, PLAN-FINAL § 3.1) : profil du code + permissions du réglage + mémoire, figés dans
 * `commande.entrees.bibliothequeVideo`. `{}` (aucune clé) si l'estimation est en cours, si le réglage est éteint,
 * ou en cas d'échec : jamais d'arrêt du lancement. Aucune écriture, aucun argent, aucun fournisseur.
 */
import "server-only";
import { appliquerReglage } from "@/briques/bibliotheque-video/permissions";
import { fusionnerMemoires, versRecents } from "@/briques/bibliotheque-video/memoire";
import { graineDe } from "@/briques/bibliotheque-video/graine";
import { profilDuFormat } from "@/briques/bibliotheque-video/profils";
import { lireReglageBibliotheque } from "@/briques/bibliotheque-video/reglage";
import { CLE_ENTREE_BIBLIOTHEQUE, lireEntreeBibliotheque } from "@/briques/bibliotheque-video/schema";
import type { EntreeBibliotheque, UsageMemoire } from "@/briques/bibliotheque-video/types";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { Video } from "@/domaine/types";
import { lireParametre, maintenant } from "./_commun";
import { lireMemoiresA, lireMemoiresB } from "./bibliotheque-video-memoires";

export { lecteurDepuisEntree } from "@/briques/bibliotheque-video/lecteur";

export async function entreeBibliothequeDuLancement(
  video: Pick<Video, "id" | "formatId">,
  options: { estimation?: boolean } = {},
): Promise<Record<string, unknown>> {
  if (options.estimation) return {};
  try {
    const reglage = await lireReglageBibliotheque(video.formatId, (cle) => lireParametre(cle, undefined));
    if (!reglage.actif) return {};
    const profil = appliquerReglage(profilDuFormat(video.formatId), reglage);
    const demande = { formatId: video.formatId, videoIdEnCours: video.id, fenetre: profil.memoire };
    let usages: UsageMemoire[] = [];
    try {
      const a = await lireMemoiresA(demande);
      await lireMemoiresB(demande); // lecture seule, sans usage catalogué (tout est « hors catalogue »)
      usages = fusionnerMemoires([a.usages], profil.memoire);
    } catch (e) {
      console.warn("[studio] mémoire de la bibliothèque vidéo illisible :", e instanceof Error ? e.message : e);
    }
    const entree: EntreeBibliotheque = {
      version: VERSION_BIBLIOTHEQUE,
      profil,
      recents: versRecents(usages),
      graine: graineDe(video.id, video.formatId),
      figeeLe: maintenant(),
    };
    if (!lireEntreeBibliotheque({ [CLE_ENTREE_BIBLIOTHEQUE]: entree })) {
      console.warn("[studio] entrée de la bibliothèque vidéo invalide : ignorée");
      return {};
    }
    return { [CLE_ENTREE_BIBLIOTHEQUE]: entree };
  } catch (e) {
    console.warn("[studio] entrée de la bibliothèque vidéo non construite :", e instanceof Error ? e.message : e);
    return {};
  }
}
