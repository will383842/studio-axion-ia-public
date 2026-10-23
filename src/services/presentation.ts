/** Fabrique des vues sérialisables à partir des entités (interne aux services). */
import "server-only";
import type { ElementBibliotheque, Modele, Video } from "@/domaine/types";
import { etatLicence } from "@/domaine/derivations";
import { dureeDeLaVideo } from "@/domaine/duree-video";
import { trouverFormat } from "@/formats";
import { depots } from "./_commun";
import { urlFichier } from "./fichiers";
import type { ResumeFormat, VueElement, VueModele, VueVideoCarte } from "./vues";

export function resumeFormat(formatId: string): ResumeFormat {
  const f = trouverFormat(formatId);
  return f ? { id: f.id, nom: f.nom, icone: f.icone, statut: f.statut } : { id: formatId, nom: formatId, icone: "film", statut: "masque" };
}

export async function versCarte(v: Video): Promise<VueVideoCarte> {
  const d = depots();
  const versionId = v.versionChoisieId;
  const sorties = versionId ? await d.sorties.lister((s) => s.versionId === versionId) : [];
  const principale = sorties.find((s) => s.ratio === v.ratios[0]) ?? sorties[0];
  const miniature = v.miniatureChoisieId ? await d.miniatures.obtenir(v.miniatureChoisieId) : null;
  // Un format ajouté en cours ne fait pas passer la carte « En fabrication » : la vidéo reste prête.
  const travail = await d.travaux.trouver((t) => t.cibleId === v.id && t.type !== "reexport" && (t.statut === "en_cours" || t.statut === "en_file" || t.statut === "echec"));
  const vignette = (await urlFichier(miniature?.fichierId)) ?? (await urlFichier(principale?.vignetteFichierId));
  const duree = dureeDeLaVideo(v.dureeCibleSec, principale);
  return {
    id: v.id,
    titre: v.titre,
    format: resumeFormat(v.formatId),
    statut: v.statut,
    aVersionFinie: !!v.versionChoisieId,
    etapeEditoriale: v.etapeEditoriale,
    dureeCibleSec: v.dureeCibleSec,
    dureeSec: duree.sec,
    dureeEstimee: duree.estimee,
    ratios: v.ratios,
    ratioPrincipal: v.ratios[0] ?? "9:16",
    vignette,
    video: await urlFichier(principale?.fichierId),
    noteQualite: v.noteQualite?.globale,
    coutReel: v.coutReel,
    serieId: v.serieId,
    travail: travail ? { id: travail.id, statut: travail.statut, progression: travail.progression } : undefined,
    etapeAssistant: v.etapeAssistant,
    creeLe: v.creeLe,
    modifieLe: v.modifieLe,
    estDemo: v.estDemo,
    corbeilleLe: v.corbeilleLe,
  };
}

export async function versVueElement(e: ElementBibliotheque): Promise<VueElement> {
  return { ...e, vignette: await urlFichier(e.vignetteFichierId ?? e.fichierId), url: await urlFichier(e.fichierId), etatLicence: etatLicence(e.licence) };
}

export async function versVueModele(m: Modele): Promise<VueModele> {
  return { ...m, vignette: await urlFichier(m.vignetteFichierId), format: resumeFormat(m.formatId) };
}
