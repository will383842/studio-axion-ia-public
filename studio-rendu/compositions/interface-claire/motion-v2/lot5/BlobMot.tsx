/**
 * ÉLÉMENT 21 « BLOB-MOT » (`blob-mot`) — motion v2, lot 5 « Organique & objets » (standard DA du 16/10/2026, § D lot 5).
 *
 * Quand : un bénéfice doux dit par Will (« sereinement », « enfin »). Visage : ENTIER (jamais couvert).
 * Fiche : E4 ÉLARGI bas-gauche (grand blob d'environ 12 % de l'image, x -0,03-0,69 L, y 0,72-0,97 H : la bande des sous-titres reste libre) · F6 blob organique orange, mot encre · M11 morph (le cercle devient
 * blob avec `JAILLIR`), puis ondulation · sortie par ASPIRATION · bruitage `drop_001` + « bloup » (à sourcer).
 *
 * Mouvement (image i0 = le mot est dit ; 30 i/s) :
 *  - i-1 : pré-éclat (point orange de 0,03 L) au centre de l'emplacement ;
 *  - i0 → i14 : le disque naît (échelle 0 → 1, `JAILLIR`, dépassement ≈ 16 %) et se déforme en blob avec le même ressort
 *    (2 images plus tard : la déformation dépasse elle aussi, le blob « gicle ») ; tourne de -24° à -9° avec `TOUPIE` (jamais droit) ;
 *  - i3 : le mot arrive (échelle, `JAILLIR`) ; i5 → i9 : trois gouttes se détachent du blob puis i11 → i19 y sont ré-absorbées
 *    (« bloup »), le blob pulse à l'absorption ;
 *  - pose : les 8 points de contrôle (rayons ±15 %, angles irréguliers : forme NON symétrique) ondulent de ±4 % sur 1,6 s (jamais plus de 0,7 s immobile), reflet de gel en ivoire ;
 *  - sortie (5 images) : aspiration vers le centre du blob (échelle → 0, rotation +60°, courbe d'entrée cubique).
 * Le blob ne monte jamais au-dessus de 0,68 H (bande des sous-titres 0,60-0,68 H libre), même au sommet du dépassement.
 *
 * Calque à poser AU-DESSUS de la prise, qui ne bouge JAMAIS. Seul texte affiché : le mot dit par Will (1-2 mots, 12 lettres
 * au plus). Aucun chiffre ajouté. Texte ≥ 48 px à 1 080 de large.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../../charte";
import { chargerPoliceMontserrat } from "../../../commune/polices";
import { FPS, FiltreGrain, aspiration, borne, cheminLisse, ressort, type Pt } from "./commun";

export const ID_BLOB_MOT = "blob-mot";

export type DonneesBlobMot = {
  /** Instant (s) où Will dit le mot. */
  a: number;
  /** Fin souhaitée (s) ; la durée est ramenée à 0,9 s au moins. */
  fin: number;
  /** Le mot dit par Will (1-2 mots, 12 lettres au plus). */
  mot: string;
};

export const EXEMPLE_BLOB_MOT: DonneesBlobMot = { a: 0.5, fin: 2.7, mot: "sereinement" };
/** Images (depuis i0) montrées sur la planche : i0, i2, i4, i8, posé. */
export const INSTANTS_BLOB_MOT = Object.freeze({ bande: [0, 2, 4, 8, 22], sortie: [-5, -3, -1] });

export const FICHE_BLOB_MOT = Object.freeze({
  id: ID_BLOB_MOT,
  nom: "Blob-mot",
  emplacement: "E4" as const,
  forme: "F6" as const,
  mouvement: "M11" as const,
  visage: "entier" as const,
  sortie: "aspiration" as const,
  quandUtiliser: "Un bénéfice doux dit (« sereinement », « enfin »).",
});

/** Bruitages (images depuis i0). `bloup` est à sourcer (CC0). */
export const BRUITAGES_BLOB_MOT = Object.freeze([
  { image: 0, fichier: "drop_001", volume: 0.05 },
  { image: 5, fichier: "bloup (à sourcer)", volume: 0.05 },
]);

/** Boîte de l'emplacement E4 bas-gauche (fractions) et demi-axes du blob POSÉ (px à 1 080 de large, mis à l'échelle). */
const CENTRE = { x: 0.33, y: 0.845 };
const DEMI_AXES = { rx: 0.36, ry: 0.108 };
/** Rayons des 8 points de contrôle (±12 % d'un cercle, valeurs fixes : le blob ne change pas d'une prise à l'autre). */
const RAYONS = [1.14, 0.88, 0.92, 1.12, 1.15, 0.86, 1.06, 0.9];
/** Décalage angulaire FIXE de chaque point (rad) : les 8 points ne sont pas régulièrement espacés, donc aucun « coin » de losange. */
const DECALAGE_ANGLE = [0.1, -0.14, 0.17, -0.08, 0.12, -0.16, 0.08, -0.12];
const DUREE_SORTIE = 5;

export function dureeBlobMot(d: DonneesBlobMot): number {
  return Math.max(0.9, d.fin - d.a);
}

/** Lignes du mot : 1 mot sur une ligne ; 2 mots de plus de 8 lettres au total sur deux lignes. */
function lignes(mot: string): string[] {
  const m = mot.trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 2);
  if (m.length === 2 && m.join("").length <= 12) return m.join("").length > 7 ? m : [m.join(" ")];
  return [m[0] ?? ""];
}

export function BlobMot({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_BLOB_MOT }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesBlobMot }) {
  chargerPoliceMontserrat();
  const d = donnees;
  const f = (t - d.a) * FPS;
  const total = dureeBlobMot(d) * FPS;
  if (f < -1 || f >= total) return null;

  const cx = CENTRE.x * W;
  const cy = CENTRE.y * H;

  // Pré-éclat (i-1).
  if (f < 0) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        <circle cx={cx} cy={cy} r={0.015 * W} fill={COULEURS.orange} />
      </svg>
    );
  }

  const sortieDebut = total - DUREE_SORTIE;
  const u = aspiration(f, sortieDebut, DUREE_SORTIE);
  const naissance = ressort("JAILLIR", f);
  const forme = ressort("JAILLIR", f, 2);
  const toupie = ressort("TOUPIE", f);
  const vie = borne((f - 8) / 10, 0, 1);

  // Échelle générale : naissance (dépasse), puis aspiration en sortie.
  const echelle = Math.max(0, naissance * (1 - u));
  const rotation = -9 - 15 * (1 - toupie) + 60 * u;
  const rx0 = DEMI_AXES.rx * W;
  const ry0 = DEMI_AXES.ry * H;
  const R0 = 0.1 * W; // cercle de départ

  // Pulsation à l'absorption des gouttes (i16 → i20).
  const pulse = f >= 16 && f < 22 ? 1 + 0.035 * Math.sin(((f - 16) / 6) * Math.PI) : 1;

  const points: Pt[] = RAYONS.map((r, k) => {
    const ang = (k / RAYONS.length) * 2 * Math.PI - Math.PI / 2 + DECALAGE_ANGLE[k];
    const ond = 0.04 * vie * Math.sin((2 * Math.PI * f) / 48 + k * 0.85);
    const rk = 1 + (r - 1) * forme + ond;
    const ax = R0 + (rx0 * rk - R0) * Math.min(forme, 1.25);
    const ay = R0 + (ry0 * rk - R0) * Math.min(forme, 1.25);
    return [Math.cos(ang) * ax * pulse, Math.sin(ang) * ay * pulse];
  });
  const chemin = cheminLisse(points);
  const contour = 0.006 * W;
  const decalOmbre = 0.008 * W;

  // Le mot.
  const l = lignes(d.mot);
  const emMax = Math.max(...l.map((x) => largeurTexte(x, 1)));
  const taille = Math.max(48, Math.min(l.length > 1 ? 70 : 84, (2.0 * rx0 * 0.78) / emMax));
  const motEchelle = ressort("JAILLIR", f, 3) * (1 - u);

  // Gouttes : naissent à i5-i9 sur le bord du blob, ré-absorbées à i11-i19.
  const gouttes = [
    { ang: -8, dist: 1.28, r: 0.02 * W, naissance: 5 },
    { ang: 38, dist: 1.34, r: 0.03 * W, naissance: 6 },
    { ang: 142, dist: 1.3, r: 0.017 * W, naissance: 7 },
  ].map((g, i) => {
    const a = (g.ang * Math.PI) / 180;
    const sorti = ressort("JAILLIR", f, g.naissance);
    const absorb = borne((f - (11 + i * 2)) / 6, 0, 1);
    // La goutte rejoint le BORD du blob (0,8 du rayon) puis disparaît : elle ne traverse jamais le mot.
    const dist = g.dist - (g.dist - 0.82) * absorb * absorb;
    return { x: Math.cos(a) * rx0 * dist, y: Math.sin(a) * ry0 * dist, r: g.r * sorti * (1 - absorb * 0.7), visible: absorb < 1 && f >= g.naissance };
  });

  const idClip = "blob-mot-clip";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <FiltreGrain id="blob-mot-grain" graine={11} force={0.55} />
        <clipPath id={idClip}>
          <path d={chemin} />
        </clipPath>
      </defs>
      <g transform={`translate(${cx} ${cy}) rotate(${rotation}) scale(${echelle})`}>
        {/* Ombre dure encre, vers le bas-droit (une seule direction de lumière). */}
        <path d={chemin} fill={COULEURS.encre} transform={`translate(${decalOmbre} ${decalOmbre})`} />
        {gouttes.map((g, i) => g.visible && <circle key={`o${i}`} cx={g.x + decalOmbre} cy={g.y + decalOmbre} r={g.r + contour} fill={COULEURS.encre} />)}
        <path d={chemin} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour} strokeLinejoin="round" />
        {gouttes.map((g, i) => g.visible && <circle key={`g${i}`} cx={g.x} cy={g.y} r={g.r} fill={COULEURS.orange} stroke={COULEURS.encre} strokeWidth={contour * 0.8} />)}
        {/* Grain d'impression et reflet de gel (fait main, pas un aplat lisse). */}
        <g clipPath={`url(#${idClip})`}>
          <rect x={-rx0 * 1.5} y={-ry0 * 1.5} width={rx0 * 3} height={ry0 * 3} fill="#000" filter="url(#blob-mot-grain)" />
          <ellipse cx={-rx0 * 0.42} cy={-ry0 * 0.5} rx={rx0 * 0.24} ry={ry0 * 0.11} fill={COULEURS.ivoire} opacity={0.3} transform={`rotate(-24 ${-rx0 * 0.42} ${-ry0 * 0.5})`} />
        </g>
        <g transform={`scale(${motEchelle})`}>
          {l.map((ligne, i) => (
            <text
              key={ligne}
              x={0}
              y={(i - (l.length - 1) / 2) * taille * 1.02}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily={POLICES.titre}
              fontWeight={800}
              fontSize={taille}
              fill={COULEURS.encre}
            >
              {ligne}
            </text>
          ))}
        </g>
      </g>
    </svg>
  );
}

/** Pour le contrôle automatique (zone libre) : ordonnée la plus haute atteinte par le blob (fraction de H), au pire du dépassement. */
export function hautMaxBlobMot(): number {
  return CENTRE.y - DEMI_AXES.ry * 1.15 * 1.35;
}
