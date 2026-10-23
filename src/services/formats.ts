/** FORMATS côté serveur : registre + compteurs + galerie (B.8 #3, #5, #6 ; AV2.1). */
import "server-only";
import type { DefinitionFormat } from "@/formats";
import { adresseCreationFormat, formatEnEssai, listerFormatsNavigation, statutNavigation, trouverFormat, valeursDuree } from "@/formats";
import { compteDansFormat } from "@/domaine/mes-videos";
import { formatsAPrevenir } from "./reglages";
import { listerScripts } from "./scripts";
import { compterVideosParFormat, listerVideos } from "./videos";
import type { VueVideoCarte } from "./vues";

export interface CarteFormatVue {
  id: string;
  nom: string;
  accroche: string;
  icone: DefinitionFormat["icone"];
  statut: DefinitionFormat["statut"];
  durees: number[];
  ratios: DefinitionFormat["ratios"];
  nbVideos: number;
  exemple?: { vignette: string; video: string; ratio: string };
  /** Format en essai chez Will (`reserveAWill`) : pastille « Essai », jamais grisé. */
  essai?: boolean;
  /** Écran de création du format (registre) : `/nouvelle/<id>` ou l'écran propre du générateur. */
  adresseCreation: string;
}

/**
 * Grille des formats (Nouvelle vidéo, barre latérale) avec le nombre de vidéos. Interface connectée = session de Will (seule session du
 * studio) : les formats en essai chez lui (`reserveAWill`) y sont, marqués `essai`.
 */
export async function listerFormatsAvecCompteurs(): Promise<CarteFormatVue[]> {
  const compte = await compterVideosParFormat();
  return listerFormatsNavigation().map((f) => ({
    id: f.id,
    nom: f.nom,
    accroche: f.accroche,
    icone: f.icone,
    statut: statutNavigation(f),
    durees: valeursDuree(f),
    ratios: f.ratios,
    nbVideos: compte[f.id] ?? 0,
    exemple: f.exemples[0] ? { vignette: f.exemples[0].vignette, video: f.exemples[0].video, ratio: f.exemples[0].ratio } : undefined,
    ...(formatEnEssai(f) ? { essai: true } : {}),
    adresseCreation: adresseCreationFormat(f),
  }));
}

/** Onglet d'un format (/formats/[id]) : fiche + toutes les vidéos non archivées du format (tous statuts) + scripts. */
export async function obtenirFicheFormat(id: string): Promise<{
  format: Omit<DefinitionFormat, "reglages" | "migrerReglages" | "migrerScript"> & { champsReglages: DefinitionFormat["reglages"]["champs"] };
  videos: VueVideoCarte[];
  nbArchivees: number;
  scripts: Awaited<ReturnType<typeof listerScripts>>;
  prevenir: boolean;
} | null> {
  const f = trouverFormat(id);
  if (!f) return null;
  const [toutes, scripts, prevenir] = await Promise.all([
    listerVideos({ formatId: id, inclureArchivees: true }),
    listerScripts({ formatId: id }),
    formatsAPrevenir(),
  ]);
  // Les champs non sérialisables (schéma zod, fonctions) ne quittent pas le serveur.
  const { reglages, migrerReglages: _m, migrerScript: _s, ...reste } = f;
  void _m;
  void _s;
  const videos = toutes.filter(compteDansFormat);
  return { format: { ...reste, champsReglages: reglages.champs }, videos, nbArchivees: toutes.length - videos.length, scripts, prevenir: prevenir.includes(id) };
}
