/**
 * FORMATS DU FACE CAMÉRA (lot F1) : la ligne de pastilles de « Votre vidéo » (9:16 toujours cochée, 4:5, carré,
 * horizontal) et les demandes faites au monteur (« fais-moi aussi une version carrée »). Aucun prix, aucune option :
 * cocher un format le fabrique, le décocher le retire de la vidéo (sa version reste dans l'historique).
 *
 * Les formats voulus sont gardés dans `entrees.facecamFormats` de la version : toute nouvelle version de la vidéo
 * (fil du monteur, coupes, image) les refait d'office. Sur une vidéo prête, un format nouveau part tout de suite par
 * le chemin existant « Ce format » (`reexporter`, accord donné d'office : format sans prix) ; pendant une fabrication,
 * il est fait avec elle.
 */
import "server-only";
import type { Id, Ratio } from "@/domaine/types";
import { comprendreDemandeFormats, declinaisonsDemandees, entreesAvecFormats, formatsDemandes, lireFormatsFacecam, PASTILLES_FORMATS, type DemandeFormats, type RatioDeclinaison, type RatioFacecam } from "@/briques/formats-facecam";
import { depots, ErreurStudio, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { reexporter } from "./fabrication";
import { annulerTravail } from "./travaux";
import { estimationNouveauFormat, etatRepriseFormats } from "@/moteurs/montage-facecam/declinaisons";

const ID_FORMAT_FACECAM = "facecam";

export type EtatPastilleFormat = "faite" | "en-cours" | "a-faire";

export interface PastilleFormatVue {
  ratio: RatioFacecam;
  nom: string;
  usage: string;
  verrouille: boolean;
  coche: boolean;
  /** Pour un format coché : déjà là, en train de se faire, ou pas encore lancé (vidéo pas encore prête). */
  etat?: EtatPastilleFormat;
  /** 10/10 : format pas encore fabriqué, sur une vidéo prête : minutes de calcul estimées (confirmation avant). */
  minutesEstimees?: number;
}

export interface VueFormatsFacecam {
  pastilles: PastilleFormatVue[];
}

const actif = (statut: string) => statut === "en_cours" || statut === "en_file";

async function etatVideo(videoId: Id) {
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  const courante = video?.versionChoisieId ? await d.versions.obtenir(video.versionChoisieId) : null;
  if (!video || !courante) throw new ErreurStudio("INTROUVABLE", "Aucune version de cette vidéo.");
  if (courante.commande.formatId !== ID_FORMAT_FACECAM) throw new ErreurStudio("FORMAT", "Les formats se choisissent ici pour les vidéos face caméra.");
  const travaux = await d.travaux.lister((t) => t.cibleId === videoId);
  const fabrication = travaux.find((t) => t.type !== "reexport" && actif(t.statut));
  const sorties = await d.sorties.lister((s) => s.versionId === courante.id);
  return { video, courante, travaux, fabrication, sorties };
}

/** Minutes de calcul d'un format ajouté (passe image élargie comprise) ; rien si la vidéo n'a pas de quoi le décliner. */
function minutesNouveauFormat(projetMontage: Record<string, unknown> | undefined, ratio: RatioFacecam): number | undefined {
  const etat = etatRepriseFormats(projetMontage, [ratio]);
  return etat ? Math.max(1, Math.round(estimationNouveauFormat(etat).totalSec / 60)) : undefined;
}

/** La ligne de pastilles de « Votre vidéo ». */
export async function vueFormatsFacecam(videoId: Id): Promise<VueFormatsFacecam> {
  await exigerSession();
  const { video, courante, travaux, fabrication, sorties } = await etatVideo(videoId);
  const voulus = new Set<RatioFacecam>(formatsDemandes(lireFormatsFacecam(courante.commande.entrees).ratios, video.ratios));
  return {
    pastilles: PASTILLES_FORMATS.map((p) => {
      const coche = p.verrouille || voulus.has(p.ratio) || sorties.some((s) => s.ratio === p.ratio);
      const faite = sorties.some((s) => s.ratio === p.ratio);
      const enCours = !!fabrication || travaux.some((t) => t.type === "reexport" && t.parametres?.ratio === p.ratio && actif(t.statut));
      const estimation = !faite && !p.verrouille && courante.statut === "prete" ? minutesNouveauFormat(courante.projetMontage, p.ratio) : undefined;
      return { ...p, coche, ...(coche ? { etat: faite ? "faite" : enCours ? "en-cours" : "a-faire" } : {}), ...(estimation ? { minutesEstimees: estimation } : {}) };
    }),
  };
}

/**
 * Les formats voulus deviennent ceux-là (le 9:16 est toujours gardé). Les nouveaux partent tout de suite sur une vidéo
 * prête ; pendant une fabrication, ils se font avec elle. Rend les travaux lancés.
 */
export async function changerFormatsFacecam(videoId: Id, ratios: Ratio[]): Promise<{ ratios: RatioFacecam[]; travaux: Id[] }> {
  await exigerSession();
  const d = depots();
  const { video, courante, fabrication, sorties } = await etatVideo(videoId);
  const voulus = declinaisonsDemandees(ratios);
  // Gardés pour toutes les versions à venir : la version choisie et celle en train de se fabriquer.
  await d.versions.modifier(courante.id, { commande: { ...courante.commande, entrees: entreesAvecFormats(courante.commande.entrees, voulus) } });
  if (fabrication?.versionId && fabrication.versionId !== courante.id) {
    const enCours = await d.versions.obtenir(fabrication.versionId);
    if (enCours) await d.versions.modifier(enCours.id, { commande: { ...enCours.commande, entrees: entreesAvecFormats(enCours.commande.entrees, voulus) } });
  }
  const formats = formatsDemandes(voulus);
  await d.videos.modifier(videoId, { ratios: formats });
  const travaux: Id[] = [];
  if (!fabrication && courante.statut === "prete") {
    for (const r of voulus) {
      if (sorties.some((s) => s.ratio === r)) continue;
      travaux.push((await reexporter(videoId, r)).travailId);
    }
  }
  const ajoutes = voulus.filter((r) => !video.ratios.includes(r));
  if (ajoutes.length || formats.length !== video.ratios.length) await journaliser("fabrication", `Formats de « ${video.titre} » : ${formats.join(", ")}`, { type: "video", id: videoId });
  return { ratios: formats, travaux };
}

/**
 * Constat prod 10/10 : un geste sur la vidéo (fil du monteur, Coupes, Image, Cartes) pendant qu'un format ajouté se
 * fabrique. Le format en cours est REPRIS par la nouvelle version (ajouté à ses formats voulus : elle le refait
 * d'office) ; l'ancien travail, qui finirait sur la version quittée, est arrêté une fois la nouvelle version lancée
 * (`arreterFormatsRepris`). Chaque travail n'écrit que sur sa version : aucun conflit d'écriture.
 */
export async function reprendreFormatsEnCours(videoId: Id, entrees: Record<string, unknown>): Promise<{ entrees: Record<string, unknown>; travaux: Id[]; noms: string[] }> {
  const enCours = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "reexport" && actif(t.statut));
  const ratios = declinaisonsDemandees(enCours.map((t) => t.parametres?.ratio));
  if (!ratios.length) return { entrees, travaux: [], noms: [] };
  return {
    entrees: entreesAvecFormats(entrees, declinaisonsDemandees(lireFormatsFacecam(entrees).ratios, ratios)),
    travaux: enCours.map((t) => t.id),
    noms: ratios.map((r) => PASTILLES_FORMATS.find((p) => p.ratio === r)?.nom ?? r),
  };
}

/** Arrête les formats repris par la nouvelle version (un format fini entre-temps reste tel quel, sur l'ancienne). */
export async function arreterFormatsRepris(travaux: Id[]): Promise<void> {
  for (const id of travaux) await annulerTravail(id).catch(() => null);
}

/** Une demande de format dite au monteur, appliquée (sans appel Claude) : la réponse du monteur en une phrase. */
export async function appliquerDemandeFormats(videoId: Id, demande: DemandeFormats): Promise<{ reponse: string; travailId?: Id }> {
  const { courante, video } = await etatVideo(videoId);
  const actuels = new Set<RatioDeclinaison>(declinaisonsDemandees(lireFormatsFacecam(courante.commande.entrees).ratios, video.ratios));
  demande.ajouter.forEach((r) => actuels.add(r));
  demande.retirer.forEach((r) => actuels.delete(r));
  const r = await changerFormatsFacecam(videoId, [...actuels]);
  return { reponse: demande.reponse, ...(r.travaux[0] ? { travailId: r.travaux[0] } : {}) };
}

export { comprendreDemandeFormats };
