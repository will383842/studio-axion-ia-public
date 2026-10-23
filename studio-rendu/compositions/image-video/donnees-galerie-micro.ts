/**
 * Données de la galerie des micro-objets (K20, part L9b) : propriétés, instants, géométrie (pixels de l'écran de
 * référence). PUR : ni React ni `remotion`, ni police (lu tel quel par le banc de rendu `scripts/image-video/galerie-prod.ts`).
 */
import type { Fond as NomFond } from "../../../src/briques/ecrans-motion";
import { MICRO_OBJETS, type NomMicroObjet } from "../../../src/briques/schema-motion/micro-objets";
import { centrer, PLANCHER_PX_IV, zoneUtile } from "./mise-en-page";

export type ListeGalerieMicro = "A" | "B" | "banque";

export type ProprietesGalerieMicro = {
  liste: ListeGalerieMicro;
  fond: NomFond;
  largeur: number;
  hauteur: number;
  fps: number;
  marque: "axion-ia.com";
};

/** Les bénéfices des images A et B (libellés des cartes figées `tests/image-video/fixtures/cartes/{A,B}.json`) et leur micro-objet. */
export function beneficesGalerie(liste: "A" | "B"): { titre: string; nom: NomMicroObjet }[] {
  return liste === "A"
    ? [
        { titre: "Gain de temps immédiat", nom: "horloge-envers" },
        { titre: "Plus de clarté", nom: "post-it" },
        { titre: "Meilleure productivité", nom: "jauge" },
        { titre: "Réduction des coûts", nom: "tirelire" },
        { titre: "Résultats concrets", nom: "cible" },
      ]
    : [
        { titre: "Gagnez du temps", nom: "horloge-envers" },
        { titre: "Prenez de meilleures décisions", nom: "bouton-decider" },
        { titre: "Dépassez vos concurrents", nom: "course" },
        { titre: "Développez vos compétences", nom: "escalier" },
        { titre: "Boostez votre performance", nom: "graphe-monte" },
      ];
}

/** Rythme de la galerie A / B : une carte toutes les 1,8 s (un bénéfice = une phrase titre), la première à 0,6 s. */
export const RYTHME_GALERIE_MICRO = Object.freeze({ premiere: 0.6, pas: 1.8, fin: 1.6 });

/** Durée de la galerie (s). */
export function dureeGalerieMicro(liste: ListeGalerieMicro): number {
  if (liste === "banque") return 0.4 + 0.12 * (MICRO_OBJETS.length - 1) + 1.8 + 1;
  const r = RYTHME_GALERIE_MICRO;
  return r.premiere + r.pas * 4 + r.fin + 1;
}

/** Instants des images fixes de la galerie (s) : chaque micro-objet en pleine animation, puis tout posé. */
export function instantsGalerieMicro(liste: ListeGalerieMicro): { nom: string; t: number }[] {
  if (liste === "banque") return [{ nom: "banque-mi-course", t: 1.2 }, { nom: "banque-posee", t: dureeGalerieMicro("banque") - 0.1 }];
  const r = RYTHME_GALERIE_MICRO;
  return [
    ...[0, 1, 2, 3, 4].map((i) => ({ nom: `${liste}-${i + 1}`, t: Number((r.premiere + r.pas * i + 0.8).toFixed(2)) })),
    { nom: `${liste}-recapitulatif`, t: dureeGalerieMicro(liste) - 0.1 },
  ];
}

export const metaGalerieMicro = ({ props }: { props: ProprietesGalerieMicro }) => ({
  width: props.largeur,
  height: props.hauteur,
  fps: props.fps,
  durationInFrames: Math.max(1, Math.round(dureeGalerieMicro(props.liste) * props.fps)),
});

export function proprietesGalerieMicro(liste: ListeGalerieMicro, fond: NomFond = "ivoire"): ProprietesGalerieMicro {
  return { liste, fond, largeur: 1080, hauteur: 1920, fps: 30, marque: "axion-ia.com" };
}

/**
 * Géométrie de la liste (pixels) : les rangées se partagent la zone utile (sous l'en-tête, au-dessus des sous-titres),
 * 170 px au plus chacune, bloc centré ; dessin et titre à sa mesure (titre jamais sous le plancher).
 */
export function planListeMicro(n: number) {
  const zone = zoneUtile();
  const ecart = 20;
  const hauteur = Math.min(170, (zone.hauteur - (n - 1) * ecart) / Math.max(1, n));
  const haut = centrer(n * hauteur + (n - 1) * ecart, zone);
  return {
    zone,
    dessin: hauteur - 22,
    taille: Math.max(PLANCHER_PX_IV, Math.min(64, hauteur * 0.36)),
    lignes: Array.from({ length: n }, (_, i) => ({ x: zone.x, y: haut + i * (hauteur + ecart), largeur: zone.largeur, hauteur })),
  };
}

/**
 * Géométrie de la banque (pixels) : 3 × 4 dessins qui remplissent la zone utile, sans nom (le nom de chaque dessin,
 * en petit, passerait sous le plancher de lisibilité : la galerie le donne dans son README).
 */
export function planBanqueMicro() {
  const zone = zoneUtile();
  const colonnes = 3;
  const rangs = Math.ceil(MICRO_OBJETS.length / colonnes);
  const largeur = zone.largeur / colonnes;
  const hauteur = zone.hauteur / rangs;
  return {
    zone,
    cases: MICRO_OBJETS.map((_, i) => ({ x: zone.x + (i % colonnes) * largeur, y: zone.y + Math.floor(i / colonnes) * hauteur, largeur, hauteur, dessin: Math.min(largeur, hauteur) - 16 })),
  };
}

/** Identifiants des compositions de galerie des micro-objets (inscrites au lot L17 seulement). */
export const COMPOSITIONS_MICRO_OBJETS = Object.freeze({ A: "ImageVideoMicroObjetsA", B: "ImageVideoMicroObjetsB", banque: "ImageVideoMicroObjets" });
