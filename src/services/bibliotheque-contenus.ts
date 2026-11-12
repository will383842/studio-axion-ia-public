/**
 * « Mes contenus » (D3-04) : lecture seule. Enveloppe, sans les modifier, `listerCarrousels` (cartes des visuels) et la
 * liste des vidéos de /videos, avec l'index de classement. La corbeille est exclue ; rien n'est écrit.
 * Les lectures sont injectées : aucun appel réel dans ce fichier.
 */
import { projeterStatutVideo, projeterStatutVisuel } from "@/domaine/taxonomie-contenu";
import { filtrerContenus, paginerContenus, type ContenuBibliotheque, type FiltresContenus, type PageContenus } from "@/domaine/filtres-contenus";
import { reseauxDuVisuel, typeContenuDuVisuel } from "@/domaine/visuels/reseaux-visuel";
import { listerCarrousels, type DependancesVues } from "@/visuels/services/vues";
import type { VueVideoCarte } from "@/services/vues";

export interface DependancesBibliotheque extends DependancesVues {
  /** Vidéos hors corbeille (comme `listerVideos` de /videos, archivées comprises). */
  listerVideos: () => Promise<VueVideoCarte[]>;
}

export interface DemandeBibliotheque extends FiltresContenus {
  page?: number;
  parPage?: number;
}

export async function lireBibliotheque(demande: DemandeBibliotheque, deps: DependancesBibliotheque): Promise<PageContenus> {
  const [cartes, visuels, videos] = await Promise.all([
    listerCarrousels("tous", deps),
    deps.depot.lister((v) => !v.corbeilleLe),
    deps.listerVideos(),
  ]);
  const parId = new Map(visuels.map((v) => [v.id, v]));
  const contenus: ContenuBibliotheque[] = [];
  for (const c of cartes) {
    const v = parId.get(c.id);
    if (!v) continue; // corbeille ou disparu entre les deux lectures
    contenus.push({
      id: c.id,
      type: typeContenuDuVisuel(v),
      titre: c.titre,
      statut: projeterStatutVisuel(c.statut),
      reseaux: reseauxDuVisuel(v),
      modifieLe: c.modifieLe,
      ...(c.vignetteUrl ? { vignetteUrl: c.vignetteUrl } : {}),
    });
  }
  for (const v of videos) {
    if (v.corbeilleLe) continue;
    contenus.push({
      id: v.id,
      type: "video",
      titre: v.titre,
      statut: projeterStatutVideo(v.statut),
      reseaux: v.reseaux ?? [],
      modifieLe: v.modifieLe,
      ...(v.vignette ? { vignetteUrl: v.vignette } : {}),
    });
  }
  const { page, parPage, ...filtres } = demande;
  return paginerContenus(filtrerContenus(contenus, filtres), page, parPage);
}
