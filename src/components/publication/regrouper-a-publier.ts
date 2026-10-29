/**
 * Page « À publier » : met les lignes (une par vidéo et par réseau) en cartes, une par vidéo. Pure mise en forme : aucune
 * règle d'envoi ici, le serveur garde toutes ses gardes (vérifications, anti-doublon, vidéos d'essai et d'exemple).
 */
import type { LigneAPublier } from "@/services/a-publier";

export interface ReseauPasPret {
  reseau: LigneAPublier["reseau"];
  reseauNom: string;
  raison: string;
}

export interface CarteVideo {
  videoId: string;
  titre: string;
  jaquette: string | null;
  /** Lecture sur place : le fichier d'un réseau prêt, sinon n'importe lequel. */
  lecture: string | null;
  sujetId?: string;
  /** Vidéo d'essai ou d'exemple : elle ne part nulle part, une seule phrase pour toute la carte. */
  blocageVideo?: string;
  casesRequises: LigneAPublier["casesRequises"];
  coches: Record<string, boolean>;
  pretes: LigneAPublier[];
  pasPretes: ReseauPasPret[];
}

/** Un réseau est prêt quand rien ne l'empêche de partir : ni fichier au mauvais format, ni compte Buffer manquant. */
export function raisonPasPret(l: LigneAPublier): string | undefined {
  return l.blocage ?? l.compte.probleme;
}

export function regrouperParVideo(lignes: LigneAPublier[]): CarteVideo[] {
  const ordre: string[] = [];
  const parVideo = new Map<string, LigneAPublier[]>();
  for (const l of lignes) {
    if (!parVideo.has(l.videoId)) {
      parVideo.set(l.videoId, []);
      ordre.push(l.videoId);
    }
    parVideo.get(l.videoId)!.push(l);
  }
  return ordre.map((id) => {
    const toutes = parVideo.get(id)!;
    const premiere = toutes[0];
    const video = toutes.find((l) => l.blocageVideo);
    const pretes = video ? [] : toutes.filter((l) => !raisonPasPret(l));
    const pasPretes = video ? [] : toutes.filter((l) => raisonPasPret(l)).map((l) => ({ reseau: l.reseau, reseauNom: l.reseauNom, raison: raisonPasPret(l)! }));
    const sujetId = toutes.find((l) => l.sujetId)?.sujetId;
    return {
      videoId: id,
      titre: premiere.titre,
      jaquette: premiere.jaquette,
      lecture: (pretes[0] ?? premiere).lecture,
      ...(sujetId ? { sujetId } : {}),
      ...(video?.blocage ? { blocageVideo: video.blocage } : {}),
      casesRequises: premiere.casesRequises,
      coches: premiere.coches,
      pretes,
      pasPretes,
    };
  });
}
