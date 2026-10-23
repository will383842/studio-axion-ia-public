/**
 * ÉLÉMENT 6 « PASTILLE-CHIFFRE » (standard v2, lot 2 « Géométrie franche »).
 *
 * Emplacement E2 haut-gauche, DÉBORDANT (centre 0,14 L ; 0,105 H, diamètre 0,42 L, soit ≈ 7 % de l'image ; CORRIGÉ le 16/10 : 0,22 L = 1,9 % était sous le seuil de 6 %) · forme F1 (disque orange, chiffre ivoire) ·
 * mouvement M3 : vrille de −90° à 0 (TOUPIE) + échelle 0,6 → 1 (JAILLIR), puis l'anneau encre se TRACE autour (M6, 8 i).
 * Visage : ENTIER (le disque est au-dessus et à gauche de la tête, dans le mur ; l'anneau est tracé SUR le bord). Chiffre incliné de −8°.
 * Quand : UN NOMBRE DIT PAR WILL, et seulement celui-là (jamais un chiffre inventé : `nombre` vient de la transcription).
 *
 * Image par image (i0 = mot dit) : i-1 pré-éclat orange (point de 0,03 L) · i0-i14 vrille + jaillissement · i3-i11 anneau
 * qui se trace (courbe du standard) · i6-i14 trois traits de feutre vers le bas-gauche · ensuite respiration ±2 % (1,6 s)
 * · sortie : ASPIRATION (5 i, échelle vers 0, rotation +60°, Easing.in cubic), jamais un fondu.
 * Bruitage : `select_002` à i0 puis `tick_001` quand l'anneau se ferme.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { aspiration, borne01, courbe, FPS_V2, imageDepuis, ressort, trace } from "./outils";
import type { BruitageMotion, FicheElementV2 } from "./outils";

export const ID_PASTILLE_CHIFFRE = "pastille-chiffre";
export const DUREE_PASTILLE = Object.freeze({ min: 1.2, max: 2.6 });

export const FICHE_PASTILLE_CHIFFRE: FicheElementV2 = Object.freeze({
  id: ID_PASTILLE_CHIFFRE,
  nom: "Pastille-chiffre qui tourne et s'entoure",
  emplacement: "E2 haut-gauche débordant",
  forme: "F1 disque",
  mouvement: "M3 vrille + M6 anneau tracé",
  visage: "entier" as const,
  quandUtiliser: "Un nombre dit par Will (et seulement celui-là).",
  dureeMin: DUREE_PASTILLE.min,
  dureeMax: DUREE_PASTILLE.max,
});

export type PastilleChiffreProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  /** Le nombre DIT par Will, tel qu'il le dit (« 3 », « 20 »…). Jamais un nombre inventé. */
  nombre: string;
  /** Centre du disque (fractions de L et H). Par défaut : 0,14 L ; 0,105 H. */
  centre?: { x: number; y: number };
};

const G = Object.freeze({ centre: { x: 0.14, y: 0.105 }, diametre: 0.42, sortieImages: 5, anneauDe: 3, anneauImages: 8, inclinaisonTexte: -8 });

export function PastilleChiffre(p: PastilleChiffreProps) {
  const { t, debut, fin, largeurImage: W, hauteurImage: H } = p;
  const i = imageDepuis(t, debut);
  if (i < -1 || t >= fin) return null;
  const c = p.centre ?? G.centre;
  const cx = c.x * W;
  const cy = c.y * H;
  const d = G.diametre * W;
  const r = d / 2;
  const contour = Math.max(4, Math.round(0.012 * W));
  const ombre = Math.round(0.008 * W);

  // Pré-éclat à i-1 : un point orange, une seule image.
  if (i < 0) {
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: cx - 0.015 * W, top: cy - 0.015 * W, width: 0.03 * W, height: 0.03 * W, borderRadius: "50%", background: COULEURS.orange }} />
      </div>
    );
  }

  const jaillir = ressort("JAILLIR", i);
  const toupie = ressort("TOUPIE", i);
  const iSortie = (fin - t) * FPS_V2; // images restantes
  const s = aspiration(borne01(1 - iSortie / G.sortieImages));
  const echelle = (0.6 + 0.4 * jaillir) * (1 - s) * (1 + 0.02 * Math.sin((2 * Math.PI * t) / 1.6) * borne01((i - 14) / 4));
  const rotation = -90 * (1 - toupie) + 60 * s;
  const opacite = borne01(i / 2);

  // Anneau encre : se trace de i3 à i11 sur le bord du disque, depuis midi, sens horaire.
  const trait = courbe(i, G.anneauDe, G.anneauImages, trace);
  const rAnneau = r - contour / 2;
  const longueur = 2 * Math.PI * rAnneau;

  // Taille du nombre : tient dans 66 % du diamètre.
  const taille = Math.min(d * 0.5, (d * 0.66) / Math.max(0.5, largeurTexte(p.nombre, 1)));

  const S = d + 2 * ombre + 10;
  const o = S / 2;
  // Traits de feutre (3) vers le bas-gauche, qui sortent du disque (angles écran 95°, 120°, 145°), loin du visage.
  const traits = [95, 120, 145].map((a, k) => {
    const u = courbe(i, 6 + k, 4, trace) * (1 - courbe(i, 12 + k, 3));
    const ang = (a * Math.PI) / 180;
    const r0 = r + contour * 1.6;
    const r1 = r0 + 0.05 * W * u;
    return <line key={a} x1={o + r0 * Math.cos(ang)} y1={o + r0 * Math.sin(ang)} x2={o + r1 * Math.cos(ang)} y2={o + r1 * Math.sin(ang)} stroke={COULEURS.encre} strokeWidth={contour * 0.8} strokeLinecap="round" opacity={u > 0.01 ? 1 : 0} />;
  });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: cx - o, top: cy - o, width: S, height: S, opacity: opacite, transform: `rotate(${rotation}deg) scale(${echelle})`, transformOrigin: "50% 50%" }}>
        <svg width={S} height={S} style={{ overflow: "visible" }}>
          <circle cx={o + ombre} cy={o + ombre} r={r} fill={COULEURS.encre} />
          <circle cx={o} cy={o} r={r} fill={COULEURS.orange} />
          {/* reflet de feutre, en haut à gauche : fait main */}
          <path d={`M ${o - r * 0.62} ${o - r * 0.42} A ${r * 0.75} ${r * 0.75} 0 0 1 ${o - r * 0.2} ${o - r * 0.72}`} fill="none" stroke={COULEURS.ivoire} strokeWidth={contour * 0.7} strokeLinecap="round" opacity={0.55} />
          <circle cx={o} cy={o} r={rAnneau} fill="none" stroke={COULEURS.encre} strokeWidth={contour} strokeDasharray={longueur} strokeDashoffset={longueur * (1 - trait)} transform={`rotate(-90 ${o} ${o})`} strokeLinecap="round" />
          {traits}
          <text x={o} y={o} textAnchor="middle" dominantBaseline="central" fontFamily={POLICES.titre} fontWeight={800} fontSize={taille} fill={COULEURS.ivoire} transform={`rotate(${G.inclinaisonTexte} ${o} ${o})`} style={{ fontVariantNumeric: "tabular-nums" }}>
            {p.nombre}
          </text>
        </svg>
      </div>
    </div>
  );
}

/** Bruitage : `select_002` au mot, `tick_001` quand l'anneau se ferme. */
export function bruitagesPastilleChiffre(p: Pick<PastilleChiffreProps, "debut">): BruitageMotion[] {
  return [
    [p.debut, "select_002", 0.07],
    [+(p.debut + (G.anneauDe + G.anneauImages) / FPS_V2).toFixed(3), "tick_001", 0.05],
  ];
}

/** Exemple : Will dit « trois heures » : seul le « 3 » est affiché. */
export const EXEMPLE_PASTILLE_CHIFFRE = {
  phrase: "Ça vous prend trois heures chaque semaine.",
  proprietes: { debut: 1.0, fin: 3.0, nombre: "3" } satisfies Omit<PastilleChiffreProps, "t" | "largeurImage" | "hauteurImage">,
  /** Images (depuis i0) montrées sur la planche : début, élan, vrille, anneau, posé. */
  imagesPlanche: [1, 3, 5, 9, 24],
};
