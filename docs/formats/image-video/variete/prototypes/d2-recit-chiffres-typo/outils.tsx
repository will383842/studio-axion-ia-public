import React from "react";
/**
 * Outils communs du groupe d2 (récit, chiffres, écrans de texte) : écran (fond de la charte + grain léger + marque
 * réelle via `Entete` + témoin réel des sous-titres), titres Anton au mot orange, bulle de message, coche, cloche.
 * Pixels de l'image finale (1080 de large ; 1920 en 9:16, 1350 en 4:5). Aucune couleur hors COULEURS_DUO.
 */
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO, Entete, FAMILLE_ANTON, FAMILLE_TITRE, Fond, TemoinSousTitres } from "../socle";
import { Icone } from "../../../../../../studio-rendu/compositions/interface-claire/elements";

export { Icone };

export const C = COULEURS_DUO;
export const ANTON: React.CSSProperties = { fontFamily: FAMILLE_ANTON, fontWeight: 400, textTransform: "uppercase", lineHeight: 1 };
export const INTER: React.CSSProperties = { fontFamily: FAMILLE_TITRE, fontWeight: 700, lineHeight: 1.15 };
export type NomFond = "ivoire" | "sombre";

/** Teinte avec opacité (hexadécimal #RRGGBBAA). */
export const a = (c: string, o: number) => `${c}${Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0")}`;
/** Orange de l'accent selon le fond (règle de contraste du standard). */
export const accent = (f: NomFond) => (f === "sombre" ? C.orangeVif : C.orange);
export const texte = (f: NomFond) => (f === "sombre" ? C.ivoire : C.encre);

/** Grain de papier léger (matière de la charte) : bruit monochrome très discret. */
export function Grain({ fond, hauteur }: { fond: NomFond; hauteur: number }) {
  const id = `grain-${fond}`;
  return (
    <svg width={1080} height={hauteur} style={{ position: "absolute", left: 0, top: 0, opacity: fond === "sombre" ? 0.07 : 0.05, mixBlendMode: fond === "sombre" ? "screen" : "multiply" }}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/** Un écran : fond, grain, contenu, marque (et en-tête réel facultatif), témoin réel des sous-titres facultatif. */
export function Ecran({ fond, hauteur = 1920, children, temoin, entete, fondPlein }: { fond: NomFond; hauteur?: number; children?: React.ReactNode; temoin?: string; entete?: { etiquette: string; titre: string }; fondPlein?: string }) {
  return (
    <AbsoluteFill style={{ width: 1080, height: hauteur, overflow: "hidden" }}>
      {fondPlein ? <AbsoluteFill style={{ background: fondPlein }} /> : <Fond fond={fond} largeur={1080} hauteur={hauteur} />}
      <Grain fond={fond} hauteur={hauteur} />
      {children}
      <Entete entete={entete ? { ...entete, debut: 0, fin: 99 } : null} ecoule={5} sortie={0} fond={fond} marque="axion-ia.com" largeur={1080} hauteur={hauteur} />
      {temoin ? <TemoinSousTitres texte={temoin} fond={fond} /> : null}
    </AbsoluteFill>
  );
}

/** Texte Anton en capitales ; `*mot*` = le mot orange de l'écran. */
export function Affiche({ t, taille, fond, couleur, style }: { t: string; taille: number; fond: NomFond; couleur?: string; style?: React.CSSProperties }) {
  // Segments : le texte entre astérisques est LE mot orange de l'écran (« *80 %* » compris).
  const morceaux = t.split(/(\*[^*]+\*)/).filter(Boolean);
  return (
    <div style={{ ...ANTON, fontSize: taille, color: couleur ?? texte(fond), whiteSpace: "nowrap", ...style }}>
      {morceaux.map((m, i) => (
        <span key={i} style={{ color: m.startsWith("*") ? accent(fond) : undefined }}>
          {m.replace(/\*/g, "")}
        </span>
      ))}
    </div>
  );
}

/** Étiquette en capitales espacées (28 px, ≤ 4 mots) : la seule exception sous 58 px. */
export function Etiquette({ t, fond, x = 72, y, centre }: { t: string; fond: NomFond; x?: number; y: number; centre?: boolean }) {
  return (
    <div style={{ position: "absolute", left: centre ? 0 : x, width: centre ? 1080 : undefined, textAlign: centre ? "center" : "left", top: y, ...INTER, fontSize: 28, letterSpacing: "0.32em", textTransform: "uppercase", color: fond === "ivoire" ? C.encre : C.grisClair }}>
      {t}
    </div>
  );
}

/** Bulle de message (le « personnage » du chatbot) : carte blanche, queue en bas à gauche. */
export function Bulle({ x, y, l, h, contour, ombre = true, rotation = 0, opacite = 1, children }: { x: number; y: number; l: number; h: number; contour?: string; ombre?: boolean; rotation?: number; opacite?: number; children?: React.ReactNode }) {
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

/** Tracés de la cloche (icône réelle « cloche » de la table, grille 24). */
export const CLOCHE = ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"];
export const UTILISATEURS = ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"];

/* ------------------------------------------------------------------ */
/* Zone d'appoint (v2) : y 1300 → 1536, sous la bande des sous-titres    */
/* ------------------------------------------------------------------ */
/** Conteneur des objets d'appoint : tout ce qu'il contient s'efface en fondu avant y = `fin` (1536 en 9:16), pour
 *  que le bas de l'écran (caché par la légende des réseaux) ne garde que le fond et la matière. */
export function Appoint({ children, debut = 1300, fin = 1536, fondu = 120, hauteur = 1920 }: { children?: React.ReactNode; debut?: number; fin?: number; fondu?: number; hauteur?: number }) {
  const m = `linear-gradient(180deg, transparent ${debut - 2}px, black ${debut}px, black ${fin - fondu}px, transparent ${fin}px)`;
  return <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: hauteur, maskImage: m, WebkitMaskImage: m }}>{children}</div>;
}

/** Carte fantôme du schéma (l'étape qui vient) : même forme que la vraie carte (coins 36, pastille d'icône à gauche),
 *  contour seul, sans texte. Elle annonce la suite sans rien dire d'indispensable. */
export function Fantome({ x, y, l, h, fond, icone, opacite = 1 }: { x: number; y: number; l: number; h: number; fond: NomFond; icone?: string; opacite?: number }) {
  const trait = fond === "sombre" ? a(C.grisClair, 0.55 * opacite) : a(C.encre, 0.32 * opacite);
  const d = Math.round(Math.min(h * 0.62, 96));
  return (
    <>
      <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: 36, border: `6px solid ${trait}` }} />
      {icone ? (
        <div style={{ position: "absolute", left: x - d - 18, top: y + (h - d) / 2, width: d, height: d, boxSizing: "border-box", borderRadius: "50%", border: `6px solid ${trait}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icone nom={icone} taille={d * 0.5} couleur={trait} epaisseur={2.4} />
        </div>
      ) : null}
    </>
  );
}

/** Téléphone du client (vrai objet) : contour arrondi, encoche ; `children` est posé dans l'écran du téléphone. */
export function Telephone({ x, y, l, h, fond, children }: { x: number; y: number; l: number; h: number; fond: NomFond; children?: React.ReactNode }) {
  const trait = fond === "sombre" ? a(C.grisClair, 0.75) : C.encre;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: 58, border: `8px solid ${trait}` }}>
      <div style={{ position: "absolute", left: (l - 16 - 110) / 2, top: 18, width: 110, height: 16, borderRadius: 8, background: trait }} />
      {children}
    </div>
  );
}

/** v3 · Carte d'appoint PLEINE (zone y 1300 → 1536) : vraie carte du schéma, opaque, sans texte (rien d'indispensable
 *  seul) : pastille d'icône à gauche, puis `children` (points de saisie, coche…). Sur nuit : carte blanche ; sur
 *  ivoire : carte blanche cerclée d'encre. `pastille` = couleur du disque de l'icône. */
export function CartePleine({ x, y, l, h, fond, icone, pastille, iconeCouleur, contour, children }: { x: number; y: number; l: number; h: number; fond: NomFond; icone: string; pastille?: string; iconeCouleur?: string; contour?: string; children?: React.ReactNode }) {
  const d = Math.round(h * 0.62);
  const bord = contour ?? (fond === "ivoire" ? C.encre : undefined);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: 40, background: C.blanc, border: bord ? `6px solid ${bord}` : undefined, display: "flex", alignItems: "center", gap: 34, paddingLeft: (h - d) / 2, boxShadow: `0 14px 36px ${a(C.encre, 0.1)}` }}>
      <div style={{ width: d, height: d, flex: "none", borderRadius: "50%", background: pastille ?? C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icone nom={icone} taille={d * 0.52} couleur={iconeCouleur ?? C.blanc} epaisseur={2.4} />
      </div>
      {children}
    </div>
  );
}
