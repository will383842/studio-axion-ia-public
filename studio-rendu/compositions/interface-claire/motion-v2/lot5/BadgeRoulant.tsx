/**
 * ÉLÉMENT 24 « BADGE-ROULANT » (`badge-roulant`) — motion v2, lot 5 « Organique & objets » (standard DA du 16/10/2026, § D lot 5).
 *
 * Quand : une portée, une modalité DITE (« à distance », « partout en France »). Visage : ENTIER.
 * Fiche : E6 — il ROULE en diagonale depuis le hors-cadre bas-droit (1,15 L ; 0,70 H) jusqu'à (0,80 L ; 0,81 H) ·
 * F1 de 0,38 L de diamètre (agrandi 16/10), TEXTE CIRCULAIRE des mots dits sur le pourtour, pastille encre avec `Icone` au centre ·
 * M11 roulement : translation `GLISSER`, rotation = distance parcourue ÷ rayon (il roule vraiment) ; arrêt avec `TOUPIE`
 * (le badge tourne un peu trop puis revient, et finit DROIT : 395° de roulement - 35° de retour = 360° exacts) ; puis le
 * texte circulaire tourne de 0,5° par image (micro-vie) · `select_002`.
 *
 * Mouvement (i0 = le mot est dit ; 30 i/s) :
 *  - i-1 : pré-éclat (point orange de 0,03 L) à l'endroit où le badge entre dans le cadre ;
 *  - i0 → i9 : roulement, étirement de 6 % dans le sens du mouvement et 2 copies fantômes (30 %, 15 %) pendant 4 images ;
 *  - i5 → : arrêt `TOUPIE` ; pose à (0,92 L ; 0,49 H) : bord gauche à 0,755 L, hors de la zone du visage (0,75 L), jamais traversée ;
 *  - sortie (6 images) : BALAYAGE INVERSE, il repart en roulant par où il est venu, après 2 images d'anticipation à 97 %.
 *
 * Calque au-dessus de la prise (qui ne bouge JAMAIS). Texte du pourtour ≥ 48 px à 1 080 de large (voir `taillePoliceBadge`).
 * Les mots du pourtour sont ceux que Will a dits ; aucun chiffre ajouté.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { Icone } from "../../elements";
import { FPS, aspiration, ressort } from "./commun";

export const ID_BADGE_ROULANT = "badge-roulant";

export type DonneesBadgeRoulant = {
  /** Instant (s) où Will dit la modalité. */
  a: number;
  /** Fin souhaitée (s) ; la durée est ramenée à 1,0 s au moins. */
  fin: number;
  /** Mots dits, affichés sur le pourtour, séparés par des points médians (2 mots ou groupes au plus). */
  mots: string[];
  /** Icône du centre (liste de `NOMS_ICONES`). */
  icone?: string;
};

export const EXEMPLE_BADGE_ROULANT: DonneesBadgeRoulant = { a: 0.5, fin: 3.0, mots: ["EN LIGNE", "PARTOUT"], icone: "globe" };
export const INSTANTS_BADGE_ROULANT = Object.freeze({ bande: [0, 2, 4, 8, 24], sortie: [-6, -4, -2] });

export const FICHE_BADGE_ROULANT = Object.freeze({
  id: ID_BADGE_ROULANT,
  nom: "Badge-roulant",
  emplacement: "E6" as const,
  forme: "F1 (texte circulaire)" as const,
  mouvement: "M11" as const,
  visage: "entier" as const,
  sortie: "balayage-inverse" as const,
  quandUtiliser: "Une portée, une modalité dite (« à distance », « partout en France »).",
});

export const BRUITAGES_BADGE_ROULANT = Object.freeze([{ image: 0, fichier: "select_002", volume: 0.06 }]);

/** Badge AGRANDI : 0,42 L de diamètre (7,8 % de l'image), posé sur l'épaule/le torse à droite en (0,80 L ; 0,81 H) : hors du visage et de la bande des sous-titres, tout entier dans le cadre ; il roule en diagonale depuis le coin bas-droit. */
const DEPART = { x: 1.28, y: 1.02 };
const ARRIVEE = { x: 0.8, y: 0.81 };
const DIAMETRE = 0.42;
const DUREE_SORTIE = 6;
/** Rayons dans le repère du badge, en fraction du rayon extérieur. */
const R_PASTILLE = 0.6;
const R_TEXTE = 0.72;

export function dureeBadgeRoulant(d: DonneesBadgeRoulant): number {
  return Math.max(1.0, d.fin - d.a) * FPS;
}

/** Texte du pourtour : les mots dits séparés par un point médian, refermé sur lui-même. */
export function texteCirculaire(mots: string[]): string {
  return mots.map((m) => m.toUpperCase()).join(" · ") + " · ";
}

/** Taille de police du pourtour (px à `W` de large) : remplit la circonférence ; jamais au-dessus de 50 px (48 px visés). */
export function taillePoliceBadge(mots: string[], W: number): number {
  const rayonExt = (DIAMETRE * W) / 2;
  const circ = 2 * Math.PI * rayonExt * R_TEXTE;
  const em = largeurTexte(texteCirculaire(mots), 1) * 0.92;
  return Math.min(50, (0.97 * circ) / em);
}

/** Position du centre (px) et rotation de roulement (degrés, sens anti-horaire = négatif) à l'image `f`. */
function etat(f: number, W: number, H: number) {
  const p = ressort("GLISSER", f);
  const x0 = DEPART.x * W;
  const y0 = DEPART.y * H;
  const x1 = ARRIVEE.x * W;
  const y1 = ARRIVEE.y * H;
  const rayon = (DIAMETRE * W) / 2;
  const distance = Math.hypot(x1 - x0, y1 - y0);
  const roulement = (distance / rayon) * (180 / Math.PI);
  // La rotation suit la distance parcourue ; l'arrêt `TOUPIE` ajoute le retour qui amène le badge pile droit (360°).
  // Le badge finit PENCHÉ de -14° (jamais droit) : 360° exacts de roulement puis un retour de toupie qui s'arrête à -14°.
  const retour = (roulement - 360 - 14) * ressort("TOUPIE", f, 5);
  return { x: x0 + (x1 - x0) * p, y: y0 + (y1 - y0) * p, rot: -p * roulement + retour, roulement, p, angle: Math.atan2(y1 - y0, x1 - x0) };
}

export function BadgeRoulant({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_BADGE_ROULANT }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesBadgeRoulant }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const f = (t - d.a) * FPS;
  const total = dureeBadgeRoulant(d);
  if (f < -1 || f >= total) return null;

  if (f < 0) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <circle cx={0.95 * W} cy={0.96 * H} r={0.015 * W} fill={COULEURS.orange} />
      </svg>
    );
  }

  const R = (DIAMETRE * W) / 2;
  const debutSortie = total - DUREE_SORTIE;
  const s = etat(f, W, H);
  const v = aspiration(f, debutSortie, DUREE_SORTIE);
  const anti = f >= debutSortie - 2 && f < debutSortie ? 0.97 : 1;

  // Sortie : retour par le chemin d'arrivée, en roulant dans l'autre sens.
  const x = s.x + (DEPART.x * W - s.x) * v;
  const y = s.y + (DEPART.y * H - s.y) * v;
  const rot = s.rot + v * s.roulement;
  const etire = f < 4 ? 1 + 0.06 * (1 - f / 4) : 1;
  const fantomes = f < 5 ? [1, 2].map((k) => ({ ...etat(f - k, W, H), opacite: k === 1 ? 0.3 : 0.15 })) : [];

  const contour = 0.006 * W;
  const ombre = 0.008 * W;
  const taille = taillePoliceBadge(d.mots, W);
  const texte = texteCirculaire(d.mots);
  const Rt = R * R_TEXTE;
  const circ = 2 * Math.PI * Rt;
  const microVie = f > 10 ? (f - 10) * 0.5 : 0;
  const tailleIcone = R * 0.62;
  const deg = (s.angle * 180) / Math.PI;

  const disque = (rotation: number, cle: string) => (
    <g key={cle} transform={`rotate(${rotation})`}>
      <circle r={R} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} />
      <defs>
        <path id={`badge-anneau-${cle}`} d={`M ${-Rt} 0 A ${Rt} ${Rt} 0 1 1 ${Rt} 0 A ${Rt} ${Rt} 0 1 1 ${-Rt} 0`} />
      </defs>
      <g transform={`rotate(${microVie})`}>
        <text fontFamily={POLICES.titre} fontWeight={800} fontSize={taille} fill={COULEURS.ivoire} letterSpacing={0}>
          <textPath href={`#badge-anneau-${cle}`} textLength={circ * 0.995} lengthAdjust="spacing">
            {texte}
          </textPath>
        </text>
      </g>
      <circle r={R * R_PASTILLE} fill={COULEURS.encre} />
      <circle r={R * R_PASTILLE - 0.0075 * W} fill="none" stroke={COULEURS.orange} strokeWidth={0.003 * W} />
      <g transform={`translate(${-tailleIcone / 2} ${-tailleIcone / 2})`}>
        <Icone nom={d.icone ?? "globe"} taille={tailleIcone} couleur={COULEURS.ivoire} epaisseur={2.2} />
      </g>
    </g>
  );

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {fantomes.map((g, i) => (
        <g key={i} opacity={g.opacite} transform={`translate(${g.x} ${g.y})`}>
          <circle r={R} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} />
        </g>
      ))}
      <g transform={`translate(${x} ${y}) scale(${anti})`}>
        {/* Ombre dure encre vers le bas-droit : posée dans le repère de l'image, elle ne tourne pas avec le badge. */}
        <circle cx={ombre} cy={ombre} r={R} fill={COULEURS.encre} />
        <g transform={`rotate(${deg}) scale(${etire} 1) rotate(${-deg})`}>{disque(rot, "a")}</g>
      </g>
    </svg>
  );
}

/** Pour le contrôle de zone (tests) : abscisse minimale du bord gauche du badge (fraction de L) sur tout le trajet. */
export function bordGaucheMinBadge(W = 1080, H = 1920): number {
  let min = 9;
  for (let f = 0; f <= 40; f++) {
    const s = etat(f, W, H);
    min = Math.min(min, (s.x - (DIAMETRE * W) / 2) / W);
  }
  return min;
}
