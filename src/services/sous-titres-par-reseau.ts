/**
 * L0d (15/10, analyse A1) : SOUS-TITRES PAR RÉSEAU. Une vidéo « Cas concret MD » a une fin par suite de réseaux
 * (Facebook « Le lien est en commentaire. », Instagram-TikTok « … dans mon profil. », LinkedIn « … en premier
 * commentaire. ») ; le moteur garde les sous-titres de CHAQUE fin dans le projet de montage de la version
 * (`casConcret.fins[].sousTitres`). Ici : les retrouver pour un réseau, et les liens .srt / .vtt de chaque réseau.
 *
 * PUR (aucun accès à la base). Ancienne vidéo (fins sans sous-titres) ou autre format : rien, l'export habituel reste.
 */
import type { SegmentSousTitres } from "@/domaine/types";
import { listerReseaux } from "@/reseaux";

interface FinAvecSousTitres {
  reseaux: string[];
  sousTitres: SegmentSousTitres[];
}

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Les fins du projet de montage qui portent leurs sous-titres (lecture tolérante). */
function finsAvecSousTitres(projetMontage: unknown): FinAvecSousTitres[] {
  const fins = objet(objet(projetMontage)?.casConcret)?.fins;
  if (!Array.isArray(fins)) return [];
  return fins.flatMap((f) => {
    const x = objet(f);
    const reseaux = Array.isArray(x?.reseaux) ? x.reseaux.filter((r): r is string => typeof r === "string") : [];
    const sousTitres = Array.isArray(x?.sousTitres) ? (x.sousTitres as SegmentSousTitres[]) : [];
    return reseaux.length && sousTitres.length ? [{ reseaux, sousTitres }] : [];
  });
}

/** Segments lus avec prudence (liste non vide), sinon `null`. */
const segmentsDe = (v: unknown): SegmentSousTitres[] | null => (Array.isArray(v) && v.length ? (v as SegmentSousTitres[]) : null);

/** Image → vidéo : la livraison du réseau (une entrée par réseau) porte les sous-titres de la version livrée. */
function sousTitresImageVideo(projetMontage: unknown, reseau: string): SegmentSousTitres[] | null {
  const livraison = objet(objet(projetMontage)?.imageVideo)?.livraison;
  if (!Array.isArray(livraison)) return null;
  for (const l of livraison) {
    const x = objet(l);
    if (x?.reseau === reseau) return segmentsDe(x.sousTitres);
  }
  return null;
}

/** Tableau : la première sortie qui dit ce réseau et porte ses sous-titres. */
function sousTitresTableau(projetMontage: unknown, reseau: string): SegmentSousTitres[] | null {
  const sorties = objet(objet(projetMontage)?.tableau)?.sorties;
  if (!Array.isArray(sorties)) return null;
  for (const s of sorties) {
    const x = objet(s);
    if (Array.isArray(x?.reseaux) && x.reseaux.includes(reseau)) {
      const segments = segmentsDe(x.sousTitres);
      if (segments) return segments;
    }
  }
  return null;
}

/**
 * Les sous-titres de la fin d'un réseau ; `null` : rien n'est gardé pour ce réseau (ancien projet, autre format).
 * Trois formes lues : cas concret (`casConcret.fins`), image → vidéo (`imageVideo.livraison`), tableau (`tableau.sorties`).
 */
export function sousTitresDuReseau(projetMontage: unknown, reseau: string): SegmentSousTitres[] | null {
  return finsAvecSousTitres(projetMontage).find((f) => f.reseaux.includes(reseau))?.sousTitres ?? sousTitresImageVideo(projetMontage, reseau) ?? sousTitresTableau(projetMontage, reseau);
}

export interface LienSousTitresReseau {
  reseau: string;
  nom: string;
  srt: string;
  vtt: string;
}

/** Un .srt et un .vtt par réseau qui a sa fin sous-titrée, dans l'ordre des fins ; vide sinon. */
export function liensSousTitresParReseau(videoId: string, projetMontage: unknown): LienSousTitresReseau[] {
  const noms = new Map(listerReseaux().map((r) => [r.id as string, r.nom]));
  const base = `/api/sous-titres/${encodeURIComponent(videoId)}`;
  return finsAvecSousTitres(projetMontage).flatMap((f) =>
    f.reseaux.map((reseau) => ({ reseau, nom: noms.get(reseau) ?? reseau, srt: `${base}?format=srt&reseau=${encodeURIComponent(reseau)}`, vtt: `${base}?format=vtt&reseau=${encodeURIComponent(reseau)}` })),
  );
}
