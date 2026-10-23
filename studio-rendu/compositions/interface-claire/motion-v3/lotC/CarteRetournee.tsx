import React from "react";
/**
 * n° 14 `carte-retournee` (lot C, standard v3 § G) : une carte de verre VERTICALE à gauche (x -0,01-0,235, 0,245 L × 0,42 H,
 * y 0,15-0,57) : la plus grande que permet la zone du visage (bord droit 0,235 L). RECTO : le problème dit (grande icône
 * sable, texte encre). VERSO : la solution dite (en-tête orange en dégradé). Entrée en PIVOT « porte » ancrée sur le bord
 * extérieur (rotateY 90° → 8°), puis RETOURNEMENT de 180° sur le mot de bascule (PIVOT, `backfaceVisibility: hidden`) avec
 * une OMBRE QUI SUIT la rotation, puis fouet vers la gauche en 7 images (accélération, flou directionnel), rien ne reste.
 * Vie après pose : flottement, roulis, reflet qui passe sur chaque face.
 * Visage : entier — la carte reste à gauche de x = 0,235 L (perspective : ≤ 0,2 L pendant le retournement).
 * Textes : 54 px (27 px à 540), pas de petite étiquette.
 */
import { Easing } from "remotion";
import { Icone } from "../../elements";
import { alpha, courbe, Flou, lerp, microVie, NUANCES, Perspective, PropsElement, ReflePassant, ressort, SonElement, styleOrange, styleVerre, titre, vitesse } from "./commun-lotC";

export type FaceCarte = { lignes: string[]; icone: string };
export type PropsCarteRetournee = PropsElement & {
  recto?: FaceCarte;
  verso?: FaceCarte;
  /** Image du retournement (mot de bascule) et de la sortie. */
  basculeA?: number;
  sortieA?: number;
};

const RECTO: FaceCarte = { lignes: ["Trop", "de", "temps", "perdu"], icone: "horloge" };
const VERSO: FaceCarte = { lignes: ["Tout", "part", "seul"], icone: "eclair" };

export const SONS_CARTE_RETOURNEE = (basculeA = 36, sortieA = 68): readonly SonElement[] => [
  [0, "whoosh-in", 0.55],
  [basculeA, "select_001", 0.8],
  [sortieA, "whoosh-out", 0.55],
];

export function CarteRetournee({ i, W = 1080, H = 1920, recto = RECTO, verso = VERSO, basculeA = 36, sortieA = 68 }: PropsCarteRetournee) {
  if (i < 0 || i > sortieA + 10) return null;
  const w = 0.245 * W;
  const h = 0.42 * H;
  const x = -0.01 * W;
  const y = 0.15 * H;
  const porte = ressort("PIVOT", i);
  const flip = ressort("PIVOT", i - basculeA);
  const sortie = courbe(i, sortieA, 7, Easing.in(Easing.cubic));
  const angleEntree = lerp(90, 8, porte);
  const angleFlip = 180 * flip;
  const dxSortie = -0.5 * W * sortie;
  const calme = i > 20 && sortie === 0;
  const mv = microVie(i, H);
  const flot = calme ? mv.dy : 0;
  const roulis = calme ? Math.sin((2 * Math.PI * i) / 60) * 1.2 : 0;
  const sx = Math.min(0.02 * W, vitesse((j) => 0.5 * W * courbe(j, sortieA, 7, Easing.in(Easing.cubic)), i) * 0.2);
  const mise = 0.006 * W * (1 - courbe(i, 0, 4));
  const rayon = 0.04 * W;
  const pad = 0.024 * W;
  const t = 0.05 * W;
  const rad = (angleFlip * Math.PI) / 180;
  // Ombre qui suit la rotation : glisse du côté opposé à la face qui s'éloigne et se rétrécit quand la carte est de chant.
  const ombreDx = Math.sin(rad) * 0.05 * W;
  const ombreEch = 0.35 + 0.65 * Math.abs(Math.cos(rad));
  const face = (c: FaceCarte, estVerso: boolean) => (
    <div style={{ position: "absolute", inset: 0, ...styleVerre(W, rayon, { opacite: 0.92 }), overflow: "hidden", backfaceVisibility: "hidden", transform: estVerso ? "rotateY(180deg)" : undefined, display: "flex", flexDirection: "column" }}>
      {estVerso ? (
        <div style={{ height: h * 0.26, flexShrink: 0, ...styleOrange(W, 0), display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom={c.icone} taille={0.1 * W} couleur={NUANCES.ivoire} epaisseur={2.6} />
        </div>
      ) : (
        <div style={{ height: h * 0.26, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingTop: pad }}>
          <div style={{ width: 0.13 * W, height: 0.13 * W, borderRadius: 0.04 * W, background: alpha(NUANCES.sable, 0.55), boxShadow: `inset 0 1px 0 ${alpha(NUANCES.ivoire, 0.6)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom={c.icone} taille={0.08 * W} couleur={NUANCES.sableProfond} epaisseur={2.6} />
          </div>
        </div>
      )}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: t * 0.16, padding: `0 ${pad}px` }}>
        {c.lignes.map((tx, k) => (
          <span key={k} style={{ ...titre(t, estVerso && k === c.lignes.length - 1 ? NUANCES.orange : NUANCES.encre, 0.01), whiteSpace: "nowrap" }}>{tx}</span>
        ))}
        {estVerso ? (
          <div style={{ marginTop: t * 0.4, width: t * 1.5, height: t * 1.5, ...styleOrange(W, t * 0.75, 0.6), display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom="coche" taille={t * 0.9} couleur={NUANCES.ivoire} epaisseur={3.4} />
          </div>
        ) : null}
      </div>
      <ReflePassant i={i} i0={estVerso ? basculeA + 22 : 18} W={w} n={10} hauteur={h} force={0.5} />
    </div>
  );
  return (
    <Flou sx={sx} mise={mise}>
      <Perspective W={W} origine={`${((x + w / 2) / W) * 100}% 50%`}>
        {/* Porte : pivot sur le bord extérieur (gauche) ; retournement : rotation autour du centre. */}
        <div style={{ position: "absolute", left: x, top: y, width: w, height: h, transform: `translate(${dxSortie}px, ${flot}px) rotateY(${angleEntree}deg) rotateZ(${roulis * 0.3}deg)`, transformOrigin: "0% 50%", transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: rayon, background: alpha(NUANCES.encre, 0.3), filter: `blur(${0.03 * W}px)`, transform: `translate3d(${ombreDx}px, ${0.035 * W}px, -3px) scaleX(${ombreEch})` }} />
          <div style={{ position: "absolute", inset: 0, transform: `rotateY(${angleFlip}deg)`, transformOrigin: "50% 50%", transformStyle: "preserve-3d" }}>
            {face(recto, false)}
            {face(verso, true)}
          </div>
        </div>
      </Perspective>
    </Flou>
  );
}
