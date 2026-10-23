import React from "react";
/**
 * Outils des écrans « chiffres » (lot CHI), repris des maquettes v3 validées (`prototypes/d2-recit-chiffres-typo/
 * outils.tsx`) : couleurs de la charte, styles Anton / Inter, bulle, points, coche, carte pleine, zone d'appoint, cadre
 * de chaque format. Pixels de l'image finale (1080 de large ; 1920 en 9:16, 1350 en 4:5). Aucun JSX au niveau module.
 */
import type { CSSProperties, ReactNode } from "react";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { FAMILLE_ANTON, FAMILLE_TITRE } from "../../../commune/polices";
import { Icone } from "../../../interface-claire/elements";

export const C = COULEURS_DUO;
export const ANTON: CSSProperties = { fontFamily: FAMILLE_ANTON, fontWeight: 400, textTransform: "uppercase", lineHeight: 1 };
export const INTER: CSSProperties = { fontFamily: FAMILLE_TITRE, fontWeight: 700, lineHeight: 1.15 };
export type NomFondChiffres = "ivoire" | "sombre";

/** Teinte avec opacité (#RRGGBBAA). */
export const a = (c: string, o: number) => `${c}${Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0")}`;
/** Orange de l'accent selon le fond (contraste du standard 74 : #C2532A sur ivoire, #F0703C sur nuit). */
export const accent = (f: NomFondChiffres) => (f === "sombre" ? C.orangeVif : C.orange);
export const encre = (f: NomFondChiffres) => (f === "sombre" ? C.ivoire : C.encre);

export const c01 = (x: number) => Math.max(0, Math.min(1, x));
/** Avancée de 0 à 1 entre `t0` et `t0 + duree`. */
export const progres = (t: number, t0: number, duree: number) => c01((t - t0) / Math.max(1e-6, duree));
export const doux = (u: number) => {
  const x = c01(u);
  return x * x * (3 - 2 * x);
};
/** Arrivée avec un léger dépassement (claquement). */
export const rebond = (u: number) => {
  const x = c01(u);
  return 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
};

/** Cadre d'un format : contenu au-dessus des sous-titres, zone d'appoint dessous (9:16 seulement). */
export type CadreChiffres = { hauteur: number; etiquetteY: number; haut: number; bas: number; sousTitres: number; appoint: { haut: number; bas: number } | null };
export function cadreChiffres(hauteur: number): CadreChiffres {
  return hauteur < 1600
    ? { hauteur, etiquetteY: 96, haut: 130, bas: 1020, sousTitres: 1042, appoint: null }
    : { hauteur, etiquetteY: 250, haut: 300, bas: 1120, sousTitres: 1152, appoint: { haut: 1300, bas: 1536 } };
}

/** Largeur d'un texte Anton en capitales, en tailles de police (chasse mesurée large : chiffres et lettres 0,56). */
export function chasseAnton(texte: string): number {
  let l = 0;
  for (const ch of texte) l += ch === " " ? 0.24 : ch === "/" ? 0.42 : ch === "%" ? 0.62 : /[.,:]/.test(ch) ? 0.25 : 0.56;
  return Math.max(0.56, l);
}
/** Taille d'un texte Anton qui tient dans `largeur`, au plus `max`. */
export const tailleAnton = (texte: string, largeur: number, max: number) => Math.min(max, largeur / chasseAnton(texte));

/** Étiquette en capitales espacées (28 px, ≤ 4 mots) : la seule exception sous 58 px. */
export function Etiquette({ t, fond, y, x = 72 }: { t: string; fond: NomFondChiffres; y: number; x?: number }) {
  return <div style={{ position: "absolute", left: x, top: y, ...INTER, fontSize: 28, letterSpacing: "0.32em", textTransform: "uppercase", color: fond === "ivoire" ? C.encre : C.grisClair }}>{t}</div>;
}

/** Un chiffre « nombre + unité » : le nombre en grand, l'unité courte (%, s, h) un peu plus petite, collée. */
export function ChiffreAnton({ texte, taille, couleur, style }: { texte: string; taille: number; couleur: string; style?: CSSProperties }) {
  const m = /^(\d+(?:[.,]\d+)?)\s*(%)$/.exec(texte.trim());
  return (
    <div style={{ ...ANTON, fontSize: taille, color: couleur, whiteSpace: "nowrap", ...style }}>
      {m ? (
        <>
          {m[1]}
          <span style={{ fontSize: "0.58em", marginLeft: "0.08em" }}>{m[2]}</span>
        </>
      ) : (
        texte
      )}
    </div>
  );
}

/** Bulle de message : carte blanche, queue en bas à gauche. */
export function Bulle({ x, y, l, h, contour, ombre = true, rotation = 0, opacite = 1, children }: { x: number; y: number; l: number; h: number; contour?: string; ombre?: boolean; rotation?: number; opacite?: number; children?: ReactNode }) {
  const r = Math.min(h * 0.32, 48);
  const q = h * 0.28;
  const e = contour ? Math.max(5, Math.round(h * 0.035)) : 0;
  const d = `M${r} 0H${l - r}A${r} ${r} 0 0 1 ${l} ${r}V${h - r}A${r} ${r} 0 0 1 ${l - r} ${h}H${q * 1.9}L${q * 0.35} ${h + q}L${q * 0.75} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `rotate(${rotation}deg)`, opacity: opacite }}>
      <svg width={l + 2 * e} height={h + q + 2 * e} viewBox={`${-e} ${-e} ${l + 2 * e} ${h + q + 2 * e}`} style={{ position: "absolute", left: -e, top: -e, overflow: "visible", filter: ombre ? `drop-shadow(0 ${Math.round(h * 0.06)}px ${Math.round(h * 0.14)}px ${a(C.encre, 0.12)})` : undefined }}>
        <path d={d} fill={C.blanc} stroke={contour ?? "none"} strokeWidth={e} strokeLinejoin="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

/** Trois points de saisie (contenu muet d'une bulle). */
export function Points({ taille, couleur = C.encre }: { taille: number; couleur?: string }) {
  return (
    <div style={{ display: "flex", gap: taille * 0.55 }}>
      {[1, 0.55, 0.3].map((o, i) => (
        <div key={i} style={{ width: taille, height: taille, borderRadius: "50%", background: couleur, opacity: o }} />
      ))}
    </div>
  );
}

/** Coche verte (validation uniquement), trait blanc. */
export function Coche({ x, y, r, echelle = 1 }: { x: number; y: number; r: number; echelle?: number }) {
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.vert, transform: `scale(${echelle})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${r * 0.2}px ${r * 0.5}px ${a(C.vert, 0.3)}` }}>
      <svg width={r * 1.25} height={r * 1.25} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

/** Pastille ronde d'une icône de la carte (disque encre, icône blanche). */
export function Pastille({ x, y, d, icone, fond = C.encre }: { x: number; y: number; d: number; icone: string; fond?: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: d, height: d, borderRadius: "50%", background: fond, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 12px 36px ${a(C.encre, 0.1)}` }}>
      <Icone nom={icone} taille={d * 0.52} couleur={C.blanc} epaisseur={2.4} />
    </div>
  );
}

/** Carte d'appoint PLEINE, sans texte : pastille d'icône à gauche, puis `children`. */
export function CartePleine({ x, y, l, h, icone, contour, children }: { x: number; y: number; l: number; h: number; icone: string; contour?: string; children?: ReactNode }) {
  const d = Math.round(h * 0.62);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: 40, background: C.blanc, border: `6px solid ${contour ?? C.encre}`, display: "flex", alignItems: "center", gap: 34, paddingLeft: (h - d) / 2, boxShadow: `0 14px 36px ${a(C.encre, 0.1)}` }}>
      <div style={{ width: d, height: d, flex: "none", borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} taille={d * 0.52} couleur={C.blanc} epaisseur={2.4} />
      </div>
      {children}
    </div>
  );
}

/** Zone d'appoint (y 1300 → 1536 en 9:16) : ce qu'elle contient s'efface avant 1536 (le bas reste du fond). */
export function Appoint({ cadre, children, fondu = 24 }: { cadre: CadreChiffres; children?: ReactNode; fondu?: number }) {
  if (!cadre.appoint) return null;
  const { haut, bas } = cadre.appoint;
  const m = `linear-gradient(180deg, transparent ${haut - 2}px, black ${haut}px, black ${bas - fondu}px, transparent ${bas}px)`;
  return <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: cadre.hauteur, maskImage: m, WebkitMaskImage: m }}>{children}</div>;
}

/** Point de géométrie d'arc (0° = midi, sens des aiguilles). */
export function pt(cx: number, cy: number, r: number, ang: number): [number, number] {
  const t = ((ang - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
}
export function arc(cx: number, cy: number, r: number, de: number, vers: number) {
  const [x0, y0] = pt(cx, cy, r, de);
  const [x1, y1] = pt(cx, cy, r, vers);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${vers - de > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
