import React from "react";
/**
 * Objets du calque « récit » (repris des maquettes v3 validées, `prototypes/d2-recit-chiffres-typo/outils.tsx` et
 * `recit.tsx`) : bulle de message, points de saisie, coche, carte pleine d'appoint, téléphone du client, zone d'appoint.
 * Pixels de l'écran de référence 1080 × 1920 ; couleurs de la charte seulement. Aucun JSX au niveau module.
 */
import type { ReactNode } from "react";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { Icone } from "../../../interface-claire/elements";

export const C = COULEURS_DUO;
/** Teinte avec opacité (#RRGGBBAA). */
export const a = (c: string, o: number) => `${c}${Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0")}`;

/** Zone d'appoint 9:16 (doc 74 § 2 bis) : sous la bande des sous-titres, au-dessus de la légende des réseaux. */
export const APPOINT = Object.freeze({ haut: 1300, bas: 1536 });

/** Conteneur des objets d'appoint : effacé en fondu avant y = 1536 (sous : fond et matière seulement). */
export function Appoint({ children, montee = 1 }: { children?: ReactNode; montee?: number }) {
  const m = `linear-gradient(180deg, transparent ${APPOINT.haut - 2}px, black ${APPOINT.haut}px, black ${APPOINT.bas - 24}px, transparent ${APPOINT.bas}px)`;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, maskImage: m, WebkitMaskImage: m }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `translateY(${(1 - montee) * 160}px)`, opacity: montee }}>{children}</div>
    </div>
  );
}

/** Trois points de saisie (contenu muet d'une bulle ou d'une carte d'appoint). */
export function Points({ taille, couleur = C.encre }: { taille: number; couleur?: string }) {
  return (
    <div style={{ display: "flex", gap: taille * 0.55 }}>
      {[1, 0.55, 0.3].map((o, i) => (
        <div key={i} style={{ width: taille, height: taille, borderRadius: "50%", background: couleur, opacity: o }} />
      ))}
    </div>
  );
}

/** Coche verte (validation seulement), trait blanc. */
export function Coche({ x, y, r, echelle = 1 }: { x: number; y: number; r: number; echelle?: number }) {
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.vert, transform: `scale(${echelle})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 ${r * 0.2}px ${r * 0.5}px ${a(C.vert, 0.3)}` }}>
      <svg width={r * 1.25} height={r * 1.25} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

/** Bulle de message : carte blanche, queue en bas à gauche. */
export function Bulle({ x, y, l, h, rotation = 0, ombre = true, children }: { x: number; y: number; l: number; h: number; rotation?: number; ombre?: boolean; children?: ReactNode }) {
  const r = Math.min(h * 0.32, 48);
  const q = h * 0.28;
  const d = `M${r} 0H${l - r}A${r} ${r} 0 0 1 ${l} ${r}V${h - r}A${r} ${r} 0 0 1 ${l - r} ${h}H${q * 1.9}L${q * 0.35} ${h + q}L${q * 0.75} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `rotate(${rotation}deg)` }}>
      <svg width={l} height={h + q} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", filter: ombre ? `drop-shadow(0 ${Math.round(h * 0.06)}px ${Math.round(h * 0.14)}px ${a(C.encre, 0.12)})` : undefined }}>
        <path d={d} fill={C.blanc} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

/** Carte d'appoint PLEINE (vraie carte du schéma, sans texte) : pastille d'icône à gauche, puis `children`. */
export function CartePleine({ x, y, l, h, fond, icone, pastille, iconeCouleur, opacite = 1, children }: { x: number; y: number; l: number; h: number; fond: "sombre" | "ivoire"; icone: string; pastille?: string; iconeCouleur?: string; opacite?: number; children?: ReactNode }) {
  const d = Math.round(h * 0.62);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, opacity: opacite, boxSizing: "border-box", borderRadius: 40, background: C.blanc, border: fond === "ivoire" ? `6px solid ${C.encre}` : undefined, display: "flex", alignItems: "center", gap: 34, paddingLeft: (h - d) / 2, boxShadow: `0 14px 36px ${a(C.encre, 0.1)}` }}>
      <div style={{ width: d, height: d, flex: "none", borderRadius: "50%", background: pastille ?? C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} taille={d * 0.52} couleur={iconeCouleur ?? C.blanc} epaisseur={2.4} />
      </div>
      {children}
    </div>
  );
}

/** Téléphone du client, vu de face, qui monte du bas (seul le haut est visible) ; `children` dans son écran. */
export function TelephoneClient({ x, y, l, fond, children }: { x: number; y: number; l: number; fond: "sombre" | "ivoire"; children?: ReactNode }) {
  const cadre = fond === "sombre" ? C.gris : C.encre;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: 700, boxSizing: "border-box", borderRadius: 72, background: C.blanc, border: `14px solid ${cadre}`, boxShadow: `0 16px 40px ${a(C.encre, 0.12)}` }}>
      <div style={{ position: "absolute", left: (l - 28 - 150) / 2, top: 14, width: 150, height: 22, borderRadius: 11, background: cadre }} />
      {children}
    </div>
  );
}

/** Couleur de la pastille d'une carte d'appoint, selon la couleur du nœud et le fond. */
export function pastilleDe(couleur: "orange" | "noir" | "vert", fond: "sombre" | "ivoire"): { pastille: string; icone: string } {
  if (couleur === "orange") return fond === "sombre" ? { pastille: C.orangeVif, icone: C.encre } : { pastille: C.orange, icone: C.blanc };
  if (couleur === "vert") return { pastille: C.vert, icone: C.blanc };
  return { pastille: C.encre, icone: C.blanc };
}

/** Visibilité d'un calque hors des vues d'ensemble de la toile (fondu de 0,3 s autour de chacune). */
export function horsEnsemble(masques: readonly { debut: number; fin: number }[], t: number): number {
  return masques.reduce((v, m) => Math.min(v, Math.max(0, Math.min(1, Math.max((m.debut - t) / 0.3, (t - m.fin) / 0.3)))), 1);
}
