/**
 * Profils de sortie uniques (PUR) : pour un réseau et un type de contenu, les formats permis et la durée maximale.
 * Tout est LU dans le registre des réseaux (`./index`) et les profils de carrousel (`briques/visuels/reseaux`) : aucune
 * valeur de plateforme n'est recopiée ici, sauf la durée d'un Reel Facebook, reprise du code d'envoi (lecture seule).
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import type { TypeContenu } from "@/domaine/taxonomie-contenu";
import { PROFILS_RESEAUX } from "@/briques/visuels/reseaux";
import { obtenirReseau } from "./index";

export type NiveauPreuveSortie = "table-registre" | "hypothese";

export interface ProfilSortie {
  reseau: IdReseau;
  type: TypeContenu;
  /** Le réseau sert-il ce type de contenu ? Faux : ratios vide, aucune durée. */
  pris: boolean;
  ratios: Ratio[];
  ratioPrefere: Ratio | null;
  /** Durée maximale en secondes (vidéo seulement) ; null pour une image ou un carrousel. */
  dureeMaxSec: number | null;
  /** Durée maximale d'un Reel Facebook, telle qu'écrite dans le code d'envoi ; absente ailleurs. */
  dureeReelMaxSec?: number;
  niveauPreuve: NiveauPreuveSortie;
  /** À revérifier par la fiche de veille des règles (L8-01). */
  aReverifier: boolean;
  source: string;
}

/** Durée d'un Reel Facebook dans le code d'envoi (`zernio-corps`, lu seulement) ; un test garde l'égalité. */
const REEL_FACEBOOK_MAX_SEC = 60;

const CARROUSEL_PAR_RESEAU: Readonly<Partial<Record<IdReseau, Ratio>>> = { linkedin: "4:5", instagram: "4:5", facebook: "4:5", tiktok: "9:16" };

export function profilSortie(reseau: IdReseau, type: TypeContenu): ProfilSortie {
  const r = obtenirReseau(reseau);
  const base = { reseau, type, aReverifier: false };
  if (type === "video") {
    const facebook = reseau === "facebook";
    return {
      ...base,
      pris: true,
      ratios: [...r.ratios],
      ratioPrefere: r.ratioPrefere,
      dureeMaxSec: r.dureeMaxSec,
      ...(facebook ? { dureeReelMaxSec: REEL_FACEBOOK_MAX_SEC } : {}),
      niveauPreuve: "table-registre",
      aReverifier: facebook,
      source: facebook ? "registre des réseaux ; le Reel est à 60 s dans le code d'envoi, à revérifier" : "registre des réseaux",
    };
  }
  if (type === "image") {
    return { ...base, pris: true, ratios: [...r.ratios], ratioPrefere: r.ratioPrefere, dureeMaxSec: null, niveauPreuve: "table-registre", source: "registre des réseaux" };
  }
  const ratio = CARROUSEL_PAR_RESEAU[reseau];
  if (!ratio) {
    return { ...base, pris: false, ratios: [], ratioPrefere: null, dureeMaxSec: null, niveauPreuve: "hypothese", source: "pas de carrousel prévu sur ce réseau" };
  }
  const profil = reseau in PROFILS_RESEAUX ? PROFILS_RESEAUX[reseau as keyof typeof PROFILS_RESEAUX] : null;
  return {
    ...base,
    pris: true,
    ratios: [ratio],
    ratioPrefere: ratio,
    dureeMaxSec: null,
    niveauPreuve: profil ? "table-registre" : "hypothese",
    source: profil ? "profils de carrousel (1080 × 1350)" : "valeur prudente, à revérifier",
    aReverifier: !profil,
  };
}
