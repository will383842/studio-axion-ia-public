/**
 * C10-13a : minutage pur, monté nulle part ; jamais sur le visage (l'appelant garantit la zone).
 * Séquence « clic sur le bouton d'appel » : le curseur glisse vers le bouton, clique, le bouton s'enfonce,
 * s'allume (lueur H6) puis passe à « valide ». Aucun dessin, aucun hasard, aucun React, aucun son.
 * Chaque état se calcule depuis le seul numéro d'image. Imports relatifs seulement.
 */
import type { CSSProperties } from "react";
import { adoucir, entre, progression } from "../../jetons-motion";
import { halo } from "./lumiere";

/** Libellé unique de l'appel (DV-09) : un seul appel, jamais un autre texte. */
export const LIBELLE_APPEL_RDV = "Prendre rendez-vous";

/** Interrupteur de la séquence : éteint, rien ne le lit. */
export const SEQUENCE_APPEL_ACTIVE = false;

/** Part de la durée consacrée au déplacement du curseur. */
const PART_DEPLACEMENT = 0.6;
/** Durée du clic, en images. */
const CLIC_IMAGES = 12;
/** Force de la lueur avant le clic, au pic du clic, et une fois validé. */
const LUEUR_AVANT = 0.8;
const LUEUR_VALIDE = 0.4;

export type PointToile = { x: number; y: number };
export type BoutonAppel = "repos" | "appui" | "valide";

export interface EtatSequenceAppel {
  /** Position du curseur en % de la toile, et son échelle (enfoncement au clic). */
  curseur: { x: number; y: number; echelle: number };
  /** Anneau du clic de 0 à 1 (exclu), `null` hors du clic. */
  anneau: number | null;
  bouton: BoutonAppel;
  echelleBouton: number;
  /** Force de la lueur, bornée à [0, 1]. */
  forceLueur: number;
}

const DEPART_DEFAUT: PointToile = { x: 82, y: 88 };
const CIBLE_DEFAUT: PointToile = { x: 50, y: 50 };

const fini = (p: PointToile | undefined): p is PointToile => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
const borne = (v: number) => Math.min(1, Math.max(0, v));

/** État de la séquence à l'image `image` sur `dureeImages` images. Entrée invalide : état de repos. */
export function etatSequenceAppel(
  image: number,
  dureeImages: number,
  o?: { depart?: PointToile; cible?: PointToile },
): EtatSequenceAppel {
  const depart = fini(o?.depart) ? o.depart : DEPART_DEFAUT;
  const cible = fini(o?.cible) ? o.cible : CIBLE_DEFAUT;
  const repos: EtatSequenceAppel = {
    curseur: { x: depart.x, y: depart.y, echelle: 1 },
    anneau: null,
    bouton: "repos",
    echelleBouton: 1,
    forceLueur: 0,
  };
  if (!Number.isFinite(image) || !Number.isFinite(dureeImages) || dureeImages < 1) return repos;

  const duree = Math.floor(dureeImages);
  const i = Math.max(0, image);
  const deplacement = Math.max(1, Math.round(duree * PART_DEPLACEMENT));
  // Le clic tient toujours avant la dernière image, pour finir sur « valide ».
  const clic = Math.max(1, Math.min(CLIC_IMAGES, duree - 1 - deplacement));
  const fin = deplacement + clic;

  const t = progression(i, 0, deplacement, adoucir);
  const x = entre(depart.x, cible.x, t);
  const y = entre(depart.y, cible.y, t);

  if (i < deplacement) {
    return { ...repos, curseur: { x, y, echelle: 1 }, forceLueur: borne(LUEUR_AVANT * t) };
  }
  if (i < fin) {
    const c = (i - deplacement) / clic;
    const echelle = 1 - 0.08 * Math.sin(Math.PI * c);
    return {
      curseur: { x, y, echelle },
      anneau: c,
      bouton: "appui",
      echelleBouton: echelle,
      forceLueur: borne(entre(LUEUR_AVANT, 1, c)),
    };
  }
  const retombee = progression(i, fin, CLIC_IMAGES, adoucir);
  return {
    curseur: { x, y, echelle: 1 },
    anneau: null,
    bouton: "valide",
    echelleBouton: 1,
    forceLueur: borne(entre(1, LUEUR_VALIDE, retombee)),
  };
}

/** Lueur du bouton : ombres multiples plafonnées par `halo`, jamais de flou. */
export function haloBoutonAppel(
  etat: EtatSequenceAppel,
  boite: { largeur: number; hauteur: number },
  couleur: string,
): CSSProperties {
  return halo(boite, couleur, etat.forceLueur);
}
