import React from "react";
/**
 * Objets des écrans d'ouverture et de fin de la variété (lot OUV-FIN), repris des maquettes v3 validées
 * (`docs/…/variete/prototypes/d1-ouvertures-fins/objets.tsx`) en composants de prod : écran (fond + marque), étiquette,
 * carte du schéma, coche, horloge, téléphone, bulles, vibration, lueur, horizon et lune, dix barres. Pixels de l'écran
 * de référence 1080 × 1920 (le 4:5 garde les mêmes tailles en pixels). Aucun JSX ni calcul au niveau module.
 */
import { AbsoluteFill } from "remotion";
import { COULEURS_DUO } from "../../../../src/briques/habillage/charte-duo";
import { FondIV } from "./fond/FondVarie";
import { famille, graisse } from "../../cas-concret/plans/commun";
import { Icone } from "../../interface-claire/elements";
import { Entete } from "../Entete";

export const C = COULEURS_DUO;
export type NomFond = "sombre" | "ivoire";
export { Icone };

export const ANTON: React.CSSProperties = { fontFamily: famille("anton"), fontWeight: graisse("anton"), textTransform: "uppercase", lineHeight: 1 };
export const INTER: React.CSSProperties = { fontFamily: famille("inter-gras"), fontWeight: graisse("inter-gras"), lineHeight: 1.15 };
/** Une couleur de la charte avec son opacité (#RRGGBBAA). */
export const a = (couleur: string, o: number) => `${couleur}${Math.round(Math.max(0, Math.min(1, o)) * 255).toString(16).padStart(2, "0")}`;
/** Accent orange lisible sur ce fond (orange vif sur nuit, orange sur ivoire). */
export const accentDe = (fond: NomFond) => (fond === "sombre" ? C.orangeVif : C.orange);
export const texteDe = (fond: NomFond) => (fond === "sombre" ? C.ivoire : C.encre);

/** Avancement 0 → 1 entre `debut` et `debut + duree` (s), adouci (sortie lente). */
export function avance(t: number, debut: number, duree: number): number {
  const x = Math.max(0, Math.min(1, (t - debut) / Math.max(1e-6, duree)));
  return 1 - (1 - x) ** 3;
}
/** Échelle d'un « claquement » : 0 → 1,06 → 1. */
export function claque(t: number, debut: number, duree = 0.32): number {
  const x = (t - debut) / duree;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x < 0.6 ? (x / 0.6) * 1.06 : 1.06 - ((x - 0.6) / 0.4) * 0.06;
}

/** Largeur approchée d'un texte en Anton capitales (px) : chiffres 0,5 em, lettres 0,46 em, espace 0,22 em. */
export function largeurAnton(texte: string, taille: number): number {
  let l = 0;
  for (const ch of texte) l += /\s/.test(ch) ? 0.22 : /[\d]/.test(ch) ? 0.46 : /[%]/.test(ch) ? 0.62 : /[.,:;'’]/.test(ch) ? 0.2 : /[MW]/i.test(ch) ? 0.62 : 0.47;
  return l * taille;
}
/** La plus grande taille (≤ `max`, ≥ `min`) où le texte tient dans `largeur`. */
export const tailleQuiTient = (texte: string, max: number, largeur: number, min = 58) => Math.max(min, Math.min(max, Math.floor(largeur / Math.max(0.01, largeurAnton(texte, 1)))));

/**
 * Fond de la charte + marque (vraie `Entete`, sans titre ; marque toujours en 36 px, même en 4:5). En 4:5, `cadre45`
 * pose le contenu dessiné pour le 9:16 dans le cadre bas (y 262 → 1152 du 9:16 vers y 170 → 1042), sans la zone
 * d'appoint, que le cadre 4:5 n'a pas.
 */
export function Ecran({ fond, largeur, hauteur, children, cadre45, bandeNuit }: { fond: NomFond; largeur: number; hauteur: number; children?: React.ReactNode; cadre45?: boolean; bandeNuit?: boolean }) {
  const s = 0.98;
  // Bande nuit sous les sous-titres (écran coupé en deux fonds) : dans le cadre de l'image, bande 1152 → 1286 en 9:16,
  // 1042 → 1176 en 4:5 ; les sous-titres y gardent leur style clair (`passagesIvoireIV`).
  const haut = cadre45 ? 1050 : 1160;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <FondIV fond={fond} largeur={largeur} hauteur={hauteur} />
      {cadre45 ? (
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1920, transform: `translate(${540 * (1 - s)}px, ${170 - 262 * s}px) scale(${s})`, transformOrigin: "0 0" }}>{children}</div>
      ) : (
        children
      )}
      {bandeNuit ? <div style={{ position: "absolute", left: 126, top: haut, width: 828, height: 118, borderRadius: 59, background: C.nuit, boxShadow: `0 16px 40px ${a(C.encre, 0.12)}` }} /> : null}
      <Entete entete={null} ecoule={9} sortie={0} fond={fond} marque="axion-ia.com" largeur={1080} hauteur={1920} />
    </AbsoluteFill>
  );
}

/** Étiquette en capitales espacées, 28 px (la seule exception de taille permise, doc 74 § 1). */
export function Etiquette({ texte, x = 72, y, fond }: { texte: string; x?: number; y: number; fond: NomFond }) {
  return <div style={{ position: "absolute", left: x, top: y, ...INTER, fontSize: 28, letterSpacing: "0.32em", textTransform: "uppercase", color: fond === "sombre" ? C.grisClair : C.encre, whiteSpace: "nowrap" }}>{texte}</div>;
}

/** Texte absolu commode. */
export function T({ x, y, taille, couleur, police = "anton", children, style, largeur, align }: { x: number; y: number; taille: number; couleur: string; police?: "anton" | "inter"; children: React.ReactNode; style?: React.CSSProperties; largeur?: number; align?: "left" | "center" | "right" }) {
  return <div style={{ position: "absolute", left: x, top: y, width: largeur, textAlign: align, whiteSpace: "nowrap", ...(police === "anton" ? ANTON : INTER), fontSize: taille, color: couleur, ...style }}>{children}</div>;
}

export function Coche({ x, y, r = 46, echelle = 1 }: { x: number; y: number; r?: number; echelle?: number }) {
  if (echelle <= 0) return null;
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.vert, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${echelle})`, boxShadow: `0 10px 24px ${a(C.vert, 0.3)}` }}>
      <svg width={r * 1.1} height={r * 1.1} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    </div>
  );
}

/** Pastille ronde d'icône (fond encre, trait orange vif ou blanc). Sans icône connue : un point. */
export function PastilleIcone({ cx, cy, r, icone, fond = C.encre, couleur = C.orangeVif }: { cx: number; cy: number; r: number; icone: string | null; fond?: string; couleur?: string }) {
  return (
    <div style={{ position: "absolute", left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {icone === "coche" ? (
        <svg width={r * 1.1} height={r * 1.1} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      ) : icone ? (
        <Icone nom={icone} taille={r * 1.15} couleur={couleur} epaisseur={2.6} />
      ) : (
        <div style={{ width: r * 0.5, height: r * 0.5, borderRadius: "50%", background: couleur }} />
      )}
    </div>
  );
}

/** Carte du schéma au style du vrai `Noeud` : carte blanche arrondie, contour de sa couleur, pastille à cheval à gauche. */
export function Carte({ x, y, l, h, icone, contour = C.orangeVif, pastille = C.encre, couleurIcone, rayon = 34, epaisseur = 6, children, ombre = 0.08 }: { x: number; y: number; l: number; h: number; icone?: string | null; contour?: string; pastille?: string; couleurIcone?: string; rayon?: number; epaisseur?: number; children?: React.ReactNode; ombre?: number }) {
  const R = 46;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h }}>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: rayon, background: C.blanc, border: `${epaisseur}px solid ${contour}`, boxShadow: ombre ? `0 22px 60px ${a(C.encre, ombre)}` : "none" }} />
      {children}
      {icone !== undefined ? <PastilleIcone cx={-R + 30} cy={h / 2} r={R} icone={icone} fond={pastille} couleur={couleurIcone ?? C.orangeVif} /> : null}
    </div>
  );
}

/** Carte du schéma réduite à son icône (nœud de la vraie carte, sans libellé). */
export function CarteIcone({ cx, cy, l = 220, h = 104, icone, contour = C.encre, pastille = C.encre, couleurIcone = C.orangeVif, opacite = 1, rayon = 28, epaisseur = 5, ombre = 0.08, pointille }: { cx: number; cy: number; l?: number; h?: number; icone: string | null; contour?: string; pastille?: string; couleurIcone?: string; opacite?: number; rayon?: number; epaisseur?: number; ombre?: number; pointille?: boolean }) {
  return (
    <div style={{ position: "absolute", left: cx - l / 2, top: cy - h / 2, width: l, height: h, opacity: opacite }}>
      <div style={{ position: "absolute", inset: 0, boxSizing: "border-box", borderRadius: rayon, background: C.blanc, border: `${epaisseur}px ${pointille ? "dashed" : "solid"} ${contour}`, boxShadow: ombre ? `0 14px 36px ${a(C.encre, ombre)}` : "none" }} />
      <PastilleIcone cx={l / 2} cy={h / 2} r={h * 0.4} icone={icone} fond={icone === "coche" ? C.vert : pastille} couleur={couleurIcone} />
    </div>
  );
}

/** Couleurs d'un nœud de la carte (contour, trait de l'icône). */
export function couleursNoeud(couleur: "orange" | "noir" | "vert" | "neutre"): { contour: string; icone: string } {
  if (couleur === "orange") return { contour: C.orangeVif, icone: C.orangeVif };
  if (couleur === "vert") return { contour: C.vert, icone: C.blanc };
  return { contour: C.encre, icone: C.blanc };
}

/** Horloge à aiguilles. `trace` : arc derrière l'aiguille des minutes ; `traceHeure` : arc devant l'aiguille des heures. */
export function Horloge({ cx, cy, r, h, m, fond = "sombre", trace = 0, traceHeure = 0 }: { cx: number; cy: number; r: number; h: number; m: number; fond?: NomFond; trace?: number; traceHeure?: number }) {
  const trait = texteDe(fond);
  const angM = (m / 60) * 360;
  const angH = (((h % 12) + m / 60) / 12) * 360;
  const pt = (ang: number, rr: number) => [cx + rr * Math.sin((ang * Math.PI) / 180), cy - rr * Math.cos((ang * Math.PI) / 180)];
  const arc = (a0: number, a1: number, rr: number) => {
    const [x0, y0] = pt(a0, rr);
    const [x1, y1] = pt(a1, rr);
    return `M${x0} ${y0} A${rr} ${rr} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
  };
  const [mx, my] = pt(angM, r * 0.8);
  const [hx, hy] = pt(angH, r * 0.52);
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <circle cx={cx} cy={cy} r={r} fill={fond === "sombre" ? a(C.nuitHaut, 0.85) : C.blanc} stroke={trait} strokeWidth={14} />
      {Array.from({ length: 12 }, (_, i) => {
        const [x0, y0] = pt(i * 30, r * (i % 3 === 0 ? 0.8 : 0.86));
        const [x1, y1] = pt(i * 30, r * 0.93);
        return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={trait} strokeWidth={i % 3 === 0 ? 12 : 6} strokeLinecap="round" opacity={i % 3 === 0 ? 1 : 0.6} />;
      })}
      {trace > 0 ? <path d={arc(angM - trace, angM - 4, r * 0.8)} fill="none" stroke={C.orangeVif} strokeWidth={10} strokeLinecap="round" opacity={0.35} strokeDasharray="2 22" /> : null}
      {traceHeure > 0 ? <path d={arc(angH + 8, angH + traceHeure, r * 0.66)} fill="none" stroke={C.orangeVif} strokeWidth={8} strokeLinecap="round" opacity={0.5} strokeDasharray="2 20" /> : null}
      <line x1={cx} y1={cy} x2={hx} y2={hy} stroke={trait} strokeWidth={22} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={mx} y2={my} stroke={C.orangeVif} strokeWidth={14} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={20} fill={C.orangeVif} />
    </svg>
  );
}

/** Téléphone debout (écran verrouillé). */
export function Telephone({ x, y, l, h, children, inclinaison = 0, cadre = C.encre }: { x: number; y: number; l: number; h: number; children?: React.ReactNode; inclinaison?: number; cadre?: string }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `rotate(${inclinaison}deg)`, boxSizing: "border-box", borderRadius: 86, border: `14px solid ${cadre}`, background: `linear-gradient(180deg, ${C.nuitHaut}, ${C.nuit})`, boxShadow: `0 40px 90px ${a(C.nuit, 0.12)}`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: 22, width: 170, height: 40, marginLeft: -85, borderRadius: 20, background: C.encre }} />
      {children}
    </div>
  );
}

/** Téléphone posé à plat sur la table de nuit (zone d'appoint), une notification ; `repondu` : la réponse est partie. */
export function TableDeNuit({ icone, iconeReponse, repondu, vibre, y = 1312 }: { icone: string; iconeReponse?: string | null; repondu?: boolean; vibre?: boolean; y?: number }) {
  return (
    <>
      <div style={{ position: "absolute", left: 72, top: y + 210, width: 936, height: 8, borderRadius: 4, background: a(C.grisClair, 0.6) }} />
      <div style={{ position: "absolute", left: 120, top: y, width: 840, height: 206, boxSizing: "border-box", borderRadius: 56, border: `12px solid ${C.encre}`, background: `linear-gradient(180deg, ${C.nuitHaut}, ${C.nuit})`, boxShadow: `0 0 0 3px ${a(C.grisClair, 0.35)}`, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 22, top: "50%", width: 26, height: 100, marginTop: -50, borderRadius: 13, background: C.encre }} />
        <div style={{ position: "absolute", left: 96, top: 30, width: 640, height: 122, borderRadius: 36, background: C.blanc, display: "flex", alignItems: "center", gap: 24, padding: "0 26px", boxSizing: "border-box" }}>
          <div style={{ width: 78, height: 78, flex: "none", borderRadius: "50%", background: C.encre, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icone nom={repondu ? (iconeReponse ?? "robot") : icone} taille={44} couleur={C.orangeVif} epaisseur={2.6} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
            <div style={{ width: "88%", height: 16, borderRadius: 8, background: C.encre }} />
            <div style={{ width: "58%", height: 16, borderRadius: 8, background: a(C.encre, 0.4) }} />
          </div>
          {repondu ? (
            <div style={{ position: "relative", width: 66, height: 66, flex: "none" }}>
              <Coche x={33} y={33} r={30} />
            </div>
          ) : null}
        </div>
      </div>
      {vibre ? (
        <>
          <Vibration x={104} y={y + 103} cote={-1} />
          <Vibration x={976} y={y + 103} cote={1} />
        </>
      ) : null}
    </>
  );
}

/** Ondes de vibration (traces de mouvement d'un objet, jamais du texte). */
export function Vibration({ x, y, cote, couleur = C.orangeVif }: { x: number; y: number; cote: 1 | -1; couleur?: string }) {
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      {[0, 1].map((k) => (
        <path key={k} d={`M${x + cote * (16 + 26 * k)} ${y - 60 - 18 * k} Q${x + cote * (44 + 26 * k)} ${y} ${x + cote * (16 + 26 * k)} ${y + 60 + 18 * k}`} fill="none" stroke={couleur} strokeWidth={9} strokeLinecap="round" opacity={0.85 - 0.35 * k} />
      ))}
    </svg>
  );
}

/** Lueur orangée de la charte (#7A3418), douce. */
export function Lueur({ x, y, r, o = 0.6 }: { x: number; y: number; r: number; o?: number }) {
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: `radial-gradient(circle, ${a(C.nuitLueur, o)} 0%, ${a(C.nuitLueur, 0)} 70%)` }} />;
}

/** Bulle de message : `queue` à gauche (client) ou à droite (réponse). */
export function Bulle({ x, y, l, h, fond = C.blanc, contour, epaisseur = 5, queue = "gauche", opacite = 1, children, pointille }: { x: number; y: number; l: number; h: number; fond?: string; contour?: string; epaisseur?: number; queue?: "gauche" | "droite"; opacite?: number; children?: React.ReactNode; pointille?: boolean }) {
  const r = Math.min(46, h / 2);
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: queue === "gauche" ? `${r}px ${r}px ${r}px 10px` : `${r}px ${r}px 10px ${r}px`, background: fond, border: contour ? `${epaisseur}px ${pointille ? "dashed" : "solid"} ${contour}` : "none", opacity: opacite, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
      {children}
    </div>
  );
}

/** Trois points d'attente (le message reste sans réponse). */
export function Points({ couleur = C.gris, taille = 26 }: { couleur?: string; taille?: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: taille, height: taille, borderRadius: "50%", background: couleur, opacity: 1 - i * 0.25 }} />
      ))}
    </>
  );
}

/** Deux traits de texte (une réponse partie), sans mot. */
export function Traits({ couleur = C.encre }: { couleur?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ width: 210, height: 14, borderRadius: 7, background: couleur }} />
      <div style={{ width: 140, height: 14, borderRadius: 7, background: a(couleur, 0.45) }} />
    </div>
  );
}

/** Dix barres : `pleines` pleines, le reste vide cerclé (une part en objets : 80 % = 8 sur 10). */
export function DixBarres({ x, y, l, h, pleines = 8, plein = C.ivoire, vide = C.grisClair, ecart = 20, montees = 10 }: { x: number; y: number; l: number; h: number; pleines?: number; plein?: string; vide?: string; ecart?: number; montees?: number }) {
  const lb = (l - 9 * ecart) / 10;
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: x + i * (lb + ecart), top: y, width: lb, height: h, boxSizing: "border-box", borderRadius: 14, background: i < pleines ? plein : "transparent", border: i < pleines ? "none" : `5px solid ${vide}`, opacity: i < montees ? 1 : 0, transform: `scaleY(${i < montees ? 1 : 0.2})`, transformOrigin: "50% 100%" }} />
      ))}
    </>
  );
}

/** Horizon (fil fin) et lune en encre, dans la zone d'appoint. `monte` : 0 = sous l'horizon, 1 = levée. */
export function Horizon({ cx, monte, r = 104, debut = 72, sol = 1508, id }: { cx: number; monte: number; r?: number; debut?: number; sol?: number; id: string }) {
  const cy = sol + r + 8 - monte * (2 * r + 40);
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <defs>
        <clipPath id={`ciel-${id}`}>
          <rect x={0} y={0} width={1080} height={sol} />
        </clipPath>
        <mask id={`croissant-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={1080} height={1920}>
          <rect x={0} y={0} width={1080} height={1920} fill="white" />
          <circle cx={cx + r * 0.45} cy={cy - r * 0.32} r={r * 0.86} fill="black" />
        </mask>
      </defs>
      <g clipPath={`url(#ciel-${id})`}>
        {monte < 0.9 ? <path d={`M${cx - r - 30} ${cy + 30} A${r + 40} ${r + 40} 0 0 1 ${cx - 20} ${cy - r - 34}`} fill="none" stroke={a(C.encre, 0.35)} strokeWidth={6} strokeDasharray="2 18" strokeLinecap="round" /> : null}
        <circle cx={cx} cy={cy} r={r} fill={C.encre} mask={`url(#croissant-${id})`} />
      </g>
      <line x1={debut} y1={sol} x2={1008} y2={sol} stroke={a(C.encre, 0.55)} strokeWidth={5} strokeLinecap="round" />
    </svg>
  );
}

/** Petite lune (croissant) dessinée sur un fond uni. */
export function Lune({ x, y, r, couleur, fond }: { x: number; y: number; r: number; couleur: string; fond: string }) {
  return (
    <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
      <circle cx={x} cy={y} r={r} fill={couleur} />
      <circle cx={x + r * 0.45} cy={y - r * 0.3} r={r * 0.85} fill={fond} />
    </svg>
  );
}

/** Un mot de la phrase : `*mot*` = orange (accent du fond). */
export function MotsAccent({ texte, fond }: { texte: string; fond: NomFond }) {
  const mots = texte.split(/\s+/).filter(Boolean);
  return (
    <>
      {mots.map((m, i) => (
        <span key={i} style={{ color: /\*/.test(m) ? accentDe(fond) : undefined }}>
          {i ? " " : ""}
          {m.replace(/\*/g, "")}
        </span>
      ))}
    </>
  );
}
