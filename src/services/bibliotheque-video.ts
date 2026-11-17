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
import type { CandidatExtrait, EntreeBibliotheque, UsageMemoire } from "@/briques/bibliotheque-video/types";
import { plagesDisponibles, type DemandeExtraits } from "@/briques/archive-extraits/choix";
import type { PortsArchive } from "./archive-extraits";
import { VERSION_BIBLIOTHEQUE } from "@/briques/bibliotheque-video/version";
import type { Video } from "@/domaine/types";
import { depots, lireParametre, maintenant } from "./_commun";
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
      usages = fusionnerMemoires([(await lireMemoiresA(demande)).usages], profil.memoire);
    } catch (e) {
      console.warn("[studio] mémoire A de la bibliothèque vidéo illisible :", e instanceof Error ? e.message : e);
    }
    try {
      await lireMemoiresB(demande); // lecture seule, sans usage catalogué (tout est « hors catalogue »)
    } catch (e) {
      console.warn("[studio] mémoire B de la bibliothèque vidéo illisible :", e instanceof Error ? e.message : e);
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

/**
 * C1-U13 · Adaptateur mince (lecture seule, aucun consommateur, aucun réglage lu) : les plages d'extraits que la vidéo
 * a le droit de montrer, converties en candidats. Tout le droit (licence, famille, visage, état, déjà-utilisées) est
 * appliqué par `plagesDisponibles` : rien n'est recopié ici. Au plus 200 candidats, ordre de `plagesDisponibles`.
 */
export const CANDIDATS_EXTRAITS_MAX = 200;

export async function candidatsExtraits(demande: DemandeExtraits, ports?: PortsArchive): Promise<CandidatExtrait[]> {
  const depotsUtilises = (ports?.depots ?? depots)();
  const elements = await depotsUtilises.elements.lister((e) => e.type === "source-extraits" && !e.archiveLe);
  return plagesDisponibles(elements, demande)
    .slice(0, CANDIDATS_EXTRAITS_MAX)
    .map((d) => ({
      id: d.cle,
      cle: d.cle,
      capacite: demande.capacite,
      elementId: d.elementId,
      plageId: d.plage.id,
      debutSec: d.plage.debutSec,
      finSec: d.plage.finSec,
      ratio: d.ratio,
      visage: d.plage.avecVisage ? ("williams" as const) : ("aucun" as const),
      texteIncruste: d.plage.texteIncruste,
      famille: d.famille,
    }));
}
