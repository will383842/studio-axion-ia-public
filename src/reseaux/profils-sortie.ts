/**
 * Profils de sortie uniques (PUR) : pour un réseau et un type de contenu, les formats permis et la durée maximale.
 * Lu dans le registre des réseaux (`./index`), les profils de carrousel (`briques/visuels/reseaux`) et le code d'envoi
 * (durée du Reel Facebook, lecture seule). Deux valeurs sont écrites ici : la durée vidéo Facebook, tranchée par décision
 * écrite en attendant la vérification de la règle officielle, et le ratio du carrousel TikTok (hypothèse).
 */
import type { IdReseau, Ratio } from "@/domaine/types";
import type { TypeContenu } from "@/domaine/taxonomie-contenu";
import { PROFILS_RESEAUX } from "@/briques/visuels/reseaux";
import { REEL_FACEBOOK_DUREE_SEC } from "@/fournisseurs/publication/zernio-corps";
import { obtenirReseau } from "./index";

export type NiveauPreuveSortie = "table-registre" | "decision-en-attente" | "hypothese";

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

/**
 * Durée vidéo Facebook : décision écrite du fondateur, « appliquer 90 s en attendant la vérification de la règle
 * officielle ». Elle l'emporte sur le registre (180 s) et sur la table d'écriture (aucune durée). À revérifier (L8-01).
 */
const DUREE_VIDEO_FACEBOOK_DECISION_SEC = 90;

/** Réseaux sans image par ce canal. */
const SANS_IMAGE: readonly IdReseau[] = ["youtube", "youtube-shorts"];

/** Carrousel TikTok : hypothèse prudente, hors des profils de carrousel. */
const RATIO_CARROUSEL_TIKTOK: Ratio = "9:16";

function pgcd(a: number, b: number): number {
  return b === 0 ? a : pgcd(b, a % b);
}

/** Ratio d'un format en pixels, réduit (1080 × 1350 donne 4:5) ; null s'il n'est pas un ratio connu. */
function ratioDuFormat(largeur: number, hauteur: number): Ratio | null {
  const d = pgcd(largeur, hauteur);
  const r = `${largeur / d}:${hauteur / d}`;
  return r === "9:16" || r === "1:1" || r === "4:5" || r === "16:9" ? r : null;
}

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
      dureeMaxSec: facebook ? DUREE_VIDEO_FACEBOOK_DECISION_SEC : r.dureeMaxSec,
      ...(facebook ? { dureeReelMaxSec: REEL_FACEBOOK_DUREE_SEC.max } : {}),
      niveauPreuve: facebook ? "decision-en-attente" : "table-registre",
      aReverifier: facebook,
      source: facebook ? "décision écrite (90 s) en attente de vérification ; le registre dit 180 s, le Reel est dans le code d'envoi" : "registre des réseaux",
    };
  }
  if (type === "image") {
    if (SANS_IMAGE.includes(reseau)) {
      return { ...base, pris: false, ratios: [], ratioPrefere: null, dureeMaxSec: null, niveauPreuve: "table-registre", source: "pas d'image publiée sur ce réseau par ce canal" };
    }
    return { ...base, pris: true, ratios: [...r.ratios], ratioPrefere: r.ratioPrefere, dureeMaxSec: null, niveauPreuve: "table-registre", source: "registre des réseaux" };
  }
  const profil = reseau in PROFILS_RESEAUX ? PROFILS_RESEAUX[reseau as keyof typeof PROFILS_RESEAUX] : null;
  const ratio = profil ? ratioDuFormat(profil.format.largeur, profil.format.hauteur) : reseau === "tiktok" ? RATIO_CARROUSEL_TIKTOK : null;
  if (!ratio) {
    return { ...base, pris: false, ratios: [], ratioPrefere: null, dureeMaxSec: null, niveauPreuve: "hypothese", source: "pas de carrousel prévu sur ce réseau" };
  }
  return {
    ...base,
    pris: true,
    ratios: [ratio],
    ratioPrefere: ratio,
    dureeMaxSec: null,
    niveauPreuve: profil ? "table-registre" : "hypothese",
    source: profil ? "profils de carrousel (format en pixels)" : "valeur prudente, à revérifier",
    aReverifier: !profil,
  };
}
