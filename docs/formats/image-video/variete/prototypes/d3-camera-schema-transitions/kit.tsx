import React from "react";
/**
 * KIT du groupe d3 (caméra, apparition, transitions) : briques de dessin au style EXACT du nœud réel (`Noeud.tsx` :
 * carte blanche arrondie 34 px, pastille d'icône à cheval sur le bord gauche, libellé Anton, détail Inter Bold, coche
 * verte en haut à droite), avec les états dont les maquettes ont besoin (posé sans halo, fantôme, silhouette).
 * Textes porteurs de sens ≥ 58 px, chiffres-clés ≥ 96 px. Couleurs : COULEURS_DUO seulement.
 * Pixels de l'écran de référence (1080 × 1920, ou 1080 × 1350 pour le 4:5).
 */
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO, Entete, Fond, TemoinSousTitres, famille, graisse } from "../socle";
import { Icone } from "../../../../../../studio-rendu/compositions/interface-claire/elements";
import { teinte } from "../../../../../../studio-rendu/compositions/cas-concret/plans/commun";

export { Icone, teinte };
export const C = COULEURS_DUO;
export const ANTON = { fontFamily: famille("anton"), fontWeight: graisse("anton") } as const;
export const INTER = { fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras") } as const;

/** Rayon de la pastille d'icône et de la coche (comme `RAYON_PASTILLE` du moteur). */
export const RP = 46;

export type FondNom = "ivoire" | "sombre";

/**
 * Un écran : fond de la charte, contenu, marque (et titre éventuel) par le VRAI `Entete`, témoin des sous-titres.
 * `titre` utilise la balise `*mot*` du moteur pour le mot orange.
 */
export function Ecran({ fond, titre, etiquette = "", sousTitre, hauteur = 1920, children, devant }: { fond: FondNom; titre?: string; etiquette?: string; sousTitre?: string; hauteur?: number; children?: ReactNode; devant?: ReactNode }) {
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={fond} largeur={1080} hauteur={hauteur} />
      <AbsoluteFill>{children}</AbsoluteFill>
      <Entete entete={titre ? { debut: 0, fin: 99, etiquette, titre } : null} ecoule={5} sortie={0} fond={fond} marque="axion-ia.com" largeur={1080} hauteur={1920} />
      {sousTitre ? <SousTitre texte={sousTitre} fond={fond} hauteur={hauteur} /> : null}
      {devant}
    </AbsoluteFill>
  );
}

/** Le vrai témoin des sous-titres ; en 4:5 il remonte pour finir au-dessus de y = 1188 (zone protégée du bas). */
export function SousTitre({ texte, fond, hauteur = 1920 }: { texte: string; fond: FondNom; hauteur?: number }) {
  const dy = hauteur === 1920 ? 0 : 1176 - 1286;
  return (
    <div style={{ position: "absolute", left: 0, top: dy, width: 1080, height: 1920 }}>
      <TemoinSousTitres texte={texte} fond={fond} />
    </div>
  );
}

export type Couleur = "orange" | "noir" | "vert";
const accent = (c: Couleur) => (c === "orange" ? C.orangeVif : c === "vert" ? C.vert : C.encre);

/**
 * Carte d'étape au style du nœud réel. `etat` :
 * - `actif` : contour 6 px de sa couleur + halo doux (le nœud dont on parle) ;
 * - `pose` : carte blanche, ombre douce, textes pleins (déjà vue mais LISIBLE : contraste encre/blanc) ;
 * - `fantome` : forme pâle, sans texte (schéma pas encore « allumé ») ;
 * - `silhouette` : forme sombre sur nuit, sans texte ;
 * - `attente` : forme grise pleine sur ivoire, sans texte (étape à venir posée dans la zone d'appoint, sous la bande
 *   des sous-titres : plus présente que le fantôme, toujours muette) ;
 * - `eteinte` (v3) : carte PLEINE et opaque, beige pâle, sans texte : l'étape pas encore allumée, assez présente pour
 *   remplir l'écran (zone d'appoint comprise) sans voler la vedette à la carte dont on parle.
 */
export const BEIGE_ETEINT = "#E2D7C9";
export function Carte({
  x,
  y,
  l,
  h,
  libelle,
  detail,
  icone,
  couleur = "noir",
  etat = "pose",
  coche = 0,
  taille = 77,
  tailleDetail = 64,
  rotation = 0,
  echelle = 1,
  ombre,
  texte = 1,
  aligne = "centre",
  style,
}: {
  x: number;
  y: number;
  l: number;
  h: number;
  libelle?: string;
  detail?: string;
  icone?: string;
  couleur?: Couleur;
  etat?: "actif" | "pose" | "fantome" | "silhouette" | "attente" | "eteinte";
  coche?: number;
  taille?: number;
  tailleDetail?: number;
  rotation?: number;
  echelle?: number;
  ombre?: string;
  texte?: number;
  aligne?: "centre" | "gauche";
  style?: React.CSSProperties;
}) {
  const a = accent(couleur);
  const actif = etat === "actif";
  const fantome = etat === "fantome";
  const eteinte = etat === "eteinte";
  const attente = etat === "attente" || eteinte;
  const silhouette = etat === "silhouette" || attente;
  const fondCarte = eteinte ? BEIGE_ETEINT : attente ? teinte(C.grisClair, 0.42) : fantome ? teinte(C.blanc, 0.5) : silhouette ? teinte(C.grisClair, 0.1) : C.blanc;
  const bord = actif ? `6px solid ${a}` : attente ? "none" : fantome ? `3px solid ${teinte(C.grisClair, 0.7)}` : silhouette ? `3px solid ${teinte(C.grisClair, 0.3)}` : "none";
  const ombreCarte =
    ombre ??
    (actif
      ? `0 26px 60px ${teinte(C.encre, 0.12)}, 0 0 70px ${couleur === "orange" ? teinte(C.orangeVif, 0.38) : teinte(C.encre, 0.16)}`
      : fantome || silhouette
        ? "none"
        : `0 18px 44px ${teinte(C.encre, 0.1)}`);
  const pastille = eteinte ? C.grisClair : attente ? teinte(C.gris, 0.55) : fantome ? teinte(C.grisClair, 0.55) : silhouette ? teinte(C.grisClair, 0.2) : couleur === "vert" ? C.vert : C.encre;
  const trait = eteinte ? C.blanc : attente ? C.ivoire : fantome || silhouette ? (silhouette ? teinte(C.grisClair, 0.6) : C.blanc) : couleur === "orange" ? C.orangeVif : C.blanc;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `rotate(${rotation}deg) scale(${echelle})`, transformOrigin: "50% 50%", ...style }}>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: 34, background: fondCarte, border: bord, boxShadow: ombreCarte }} />
      {!fantome && !silhouette && (libelle || detail) ? (
        <div style={{ position: "absolute", inset: 0, padding: icone ? "0 40px 0 56px" : "0 30px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: aligne === "gauche" ? "flex-start" : "center", textAlign: aligne === "gauche" ? "left" : "center", gap: 10, opacity: texte }}>
          {libelle ? <div style={{ ...ANTON, fontSize: taille, lineHeight: 1.3, color: C.encre, textTransform: "uppercase", whiteSpace: "pre-line" }}>{libelle}</div> : null}
          {detail ? <div style={{ ...INTER, fontSize: tailleDetail, lineHeight: 1.12, color: C.encre }}>{detail}</div> : null}
        </div>
      ) : null}
      {icone ? (
        <div
          style={{
            position: "absolute",
            left: -2 * RP + 30,
            top: h / 2 - RP,
            width: 2 * RP,
            height: 2 * RP,
            borderRadius: "50%",
            background: pastille,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: fantome || silhouette ? "none" : `0 10px 24px ${teinte(C.encre, 0.12)}`,
          }}
        >
          <Icone nom={icone} taille={RP * 1.15} couleur={trait} epaisseur={2.6} />
        </div>
      ) : null}
      {coche > 0 ? <Coche x={l - RP - 14 + RP} y={-RP + 14 + RP} r={RP} x01={coche} /> : null}
    </div>
  );
}

/** Coche verte (centre x, y ; rayon r) ; `x01` = avancement du tracé. */
export function Coche({ x, y, r, x01 = 1, ombre = true }: { x: number; y: number; r: number; x01?: number; ombre?: boolean }) {
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.vert, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: ombre ? `0 10px 24px ${teinte(C.vert, 0.3)}` : undefined }}>
      <svg width={r * 1.1} height={r * 1.1} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} strokeDashoffset={24 * (1 - Math.min(1, x01))} />
      </svg>
    </div>
  );
}

/** Calque SVG plein écran (pixels de référence). */
export function Svg({ children, hauteur = 1920 }: { children: ReactNode; hauteur?: number }) {
  return (
    <svg width={1080} height={hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      {children}
    </svg>
  );
}

/** Fil (épaisseur 9 comme `FlecheCourbe`) dessiné jusqu'à `trace` (0 à 1), pointe à la fin s'il est entier. */
export function Fil({ d, couleur, trace = 1, epaisseur = 9, opacite = 1, pointe = true, bout, angle = 90, tirets }: { d: string; couleur: string; trace?: number; epaisseur?: number; opacite?: number; pointe?: boolean; bout?: [number, number]; angle?: number; tirets?: string }) {
  const p = 24;
  return (
    <g opacity={opacite}>
      <path d={d} pathLength={1} fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeDasharray={tirets ?? "1 1"} strokeDashoffset={tirets ? 0 : 1 - trace} />
      {pointe && trace >= 1 && bout ? (
        <g transform={`translate(${bout[0]} ${bout[1]}) rotate(${angle})`}>
          <path d={`M ${-p} ${-p * 0.7} L 2 0 L ${-p} ${p * 0.7} Z`} fill={couleur} stroke={couleur} strokeWidth={4} strokeLinejoin="round" />
        </g>
      ) : null}
    </g>
  );
}

/** Courbe en S verticale de (x1, y1) à (x2, y2). */
export const enS = (x1: number, y1: number, x2: number, y2: number) => {
  const k = (y2 - y1) / 2;
  return `M ${x1} ${y1} C ${x1} ${y1 + k}, ${x2} ${y2 - k}, ${x2} ${y2}`;
};

/** Pastille de part (« 80 % ») au style de l'embranchement réel, au plancher des chiffres-clés (96 px). */
export function Part({ x, y, texte, couleur, taille = 96, opacite = 1, ancre = "centre" }: { x: number; y: number; texte: string; couleur: "orange" | "noir" | "nuit"; taille?: number; opacite?: number; ancre?: "centre" | "gauche" }) {
  const fond = couleur === "orange" ? C.orangeVif : couleur === "noir" ? C.encre : C.ivoire;
  const encre = couleur === "orange" ? C.encre : couleur === "noir" ? C.blanc : C.encre;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: ancre === "centre" ? "translate(-50%, -50%)" : "translateY(-50%)",
        background: fond,
        color: encre,
        borderRadius: 999,
        padding: `${taille * 0.06}px ${taille * 0.36}px ${taille * 0.02}px`,
        ...ANTON,
        fontSize: taille,
        lineHeight: 1.15,
        whiteSpace: "nowrap",
        opacity: opacite,
        boxShadow: `0 16px 36px ${teinte(couleur === "noir" ? C.encre : C.orangeVif, 0.22)}`,
      }}
    >
      {texte}
    </div>
  );
}

/** Pastille d'icône seule (une étape du schéma, sans texte). */
export function Jeton({ x, y, r = 40, icone, couleur = "noir", etat = "plein" }: { x: number; y: number; r?: number; icone: string; couleur?: Couleur; etat?: "plein" | "pale" | "sombre" }) {
  const fond = etat === "pale" ? teinte(C.grisClair, 0.45) : etat === "sombre" ? C.nuitHaut : couleur === "orange" ? C.orangeVif : couleur === "vert" ? C.vert : C.encre;
  const trait = etat === "pale" ? C.blanc : etat === "sombre" ? teinte(C.grisClair, 0.4) : couleur === "orange" ? C.encre : C.blanc;
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: fond, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: etat === "plein" ? `0 10px 24px ${teinte(C.encre, 0.12)}` : undefined }}>
      <Icone nom={icone} taille={r * 1.2} couleur={trait} epaisseur={2.6} />
    </div>
  );
}

/** Texte posé (Anton ou Inter), coin haut gauche ou centré sur x. */
export function Texte({ x, y, children, taille, police = "anton", couleur = C.encre, centre = false, largeur, style }: { x: number; y: number; children: ReactNode; taille: number; police?: "anton" | "inter"; couleur?: string; centre?: boolean; largeur?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        left: centre ? x - (largeur ?? 1000) / 2 : x,
        top: y,
        width: centre ? (largeur ?? 1000) : largeur,
        textAlign: centre ? "center" : "left",
        ...(police === "anton" ? ANTON : INTER),
        fontSize: taille,
        lineHeight: police === "anton" ? 1.05 : 1.15,
        color: couleur,
        textTransform: police === "anton" ? "uppercase" : undefined,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
