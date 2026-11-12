/**
 * Service de la vue unifiée du calendrier (L4-02). LECTURE SEULE : dépôts passés en paramètre, aucun appel réseau,
 * aucun état créé. Rien ne part ici : le calendrier montre, le fondateur décide.
 */
import type { Depot } from "@/domaine/depots";
import { fusionnerEntrees, lienMedia, type EntreeCalendrier, type FamilleEntree } from "@/domaine/calendrier";
import type { CreneauEditorial } from "@/domaine/plan-editorial/types";
import { sourceSure, type Publication, type Video } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import { cleJour } from "@/lib/dates";

export interface DepotsCalendrier {
  creneaux: Depot<CreneauEditorial>;
  publications: Depot<Publication>;
  videos: Depot<Video>;
  visuels: Depot<Visuel>;
}

interface Media {
  famille: FamilleEntree;
  id: string | null;
  titre: string;
  vignette: string | null;
}

async function chercherMedia(d: DepotsCalendrier, source: { videoId?: string; visuelId?: string }): Promise<Media> {
  if (source.visuelId) {
    const v = await d.visuels.obtenir(source.visuelId);
    return { famille: "carrousel", id: v ? source.visuelId : null, titre: v?.titre ?? "Carrousel", vignette: v?.rendu?.vignetteCle ?? v?.renduToile?.vignetteCle ?? null };
  }
  if (source.videoId) {
    const v = await d.videos.obtenir(source.videoId);
    return { famille: "video", id: v ? source.videoId : null, titre: v?.titre ?? "Vidéo", vignette: null };
  }
  return { famille: "video", id: null, titre: "Contenu sans média", vignette: null };
}

/** Entrées du calendrier entre deux jours de Paris (AAAA-MM-JJ, bornes incluses). */
export async function listerEntrees(d: DepotsCalendrier, du: string, au: string): Promise<EntreeCalendrier[]> {
  const pubs = await d.publications.lister((p) => {
    if (!sourceSure(p)) return false;
    const j = cleJour(p.date);
    return j >= du && j <= au;
  });
  const creneaux = await d.creneaux.lister((c) => c.jourVise >= du && c.jourVise <= au && c.statut !== "archive");
  const dePublication = await Promise.all(pubs.map(async (p): Promise<EntreeCalendrier> => {
    const m = await chercherMedia(d, p);
    return { cle: `publication:${p.id}`, jour: cleJour(p.date), famille: m.famille, origine: "publication", titre: m.titre, vignette: m.vignette, lien: lienMedia(m.famille, m.id), reseaux: [p.reseau], mediaId: m.id, statut: p.statut };
  }));
  const deCreneau = await Promise.all(creneaux.map(async (c): Promise<EntreeCalendrier> => {
    const m = await chercherMedia(d, c);
    const reseaux = Object.keys(c.heuresParReseau).filter((r) => c.heuresParReseau[r as keyof typeof c.heuresParReseau]);
    return { cle: `creneau:${c.id}`, jour: c.jourVise, famille: m.famille, origine: "creneau", titre: m.titre, vignette: m.vignette, lien: lienMedia(m.famille, m.id), reseaux, mediaId: m.id, statut: c.statut };
  }));
  return fusionnerEntrees(dePublication, deCreneau);
}
