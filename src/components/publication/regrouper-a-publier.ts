/**
 * Page « À publier » : met les lignes (une par vidéo et par réseau) en cartes, une par vidéo. Pure mise en forme : aucune
 * règle d'envoi ici, le serveur garde toutes ses gardes (vérifications, anti-doublon, vidéos d'essai et d'exemple).
 */
import type { LigneAPublier } from "@/services/a-publier";

export interface ReseauPasPret {
  reseau: LigneAPublier["reseau"];
  reseauNom: string;
  raison: string;
  /** Ce qui s'est déjà passé pour ce réseau (Publiée + lien, échec…) : un réseau pas prêt garde son état. */
  etat?: LigneAPublier["etat"];
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
    const pasPretes = video ? [] : toutes.filter((l) => raisonPasPret(l)).map((l) => ({ reseau: l.reseau, reseauNom: l.reseauNom, raison: raisonPasPret(l)!, ...(l.etat ? { etat: l.etat } : {}) }));
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

/** Les vérifications « Avant de publier » à écrire pour que la case unique dise `valeur` : seulement celles qui diffèrent. */
export function casesAChanger(requises: readonly string[], coches: Record<string, boolean>, valeur: boolean): string[] {
  return requises.filter((c) => !!coches[c] !== valeur);
}

/** La case unique est cochée quand TOUTES les vérifications requises le sont. */
export function toutesCochees(requises: readonly string[], coches: Record<string, boolean>): boolean {
  return requises.length > 0 && requises.every((c) => !!coches[c]);
}
