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

/** Les sous-titres de la fin d'un réseau ; `null` : aucune fin de ce réseau ne porte ses sous-titres. */
export function sousTitresDuReseau(projetMontage: unknown, reseau: string): SegmentSousTitres[] | null {
  return finsAvecSousTitres(projetMontage).find((f) => f.reseaux.includes(reseau))?.sousTitres ?? null;
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
