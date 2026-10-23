import React from "react";
/**
 * L6 · KIT DES MISES EN PAGE (repris du kit des maquettes v2 validées, #308) : ressorts courts et nets, grain de papier,
 * marque, texte posé (`TexteL6`) avec ses accents, coche verte, lignes muettes, carte muette, pastille. Couleurs de la
 * charte duo uniquement ; jamais de volet, de rideau, d'éclair ni de fondu « diaporama ».
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { disposer, type ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { FAMILLE_ANTON, FAMILLE_TITRE } from "../../commune/polices";
import { Icone } from "../../interface-claire/elements";
import { lueurDuJeu } from "../plans/fond-fort";
import { Fond } from "../socle/Fond";
import { a, C, couleurs, heure, type TexteL6 } from "./geo";

export { a, C, Icone };
export const FPS = 25;

/** Ressort léger (0 → 1, dépasse un peu) qui démarre à l'image `debut`. */
export function ressort(image: number, debut: number, raideur = 170, amorti = 15) {
  return spring({ frame: image - debut, fps: FPS, config: { stiffness: raideur, damping: amorti, mass: 0.8 } });
}
/** Ressort sans dépassement (tracés, compteurs). */
export function doux(image: number, debut: number, duree = 14) {
  return spring({ frame: image - debut, fps: FPS, config: { stiffness: 120, damping: 26 }, durationInFrames: duree });
}
/** Progression linéaire bornée. */
export const prog = (image: number, debut: number, duree: number) => interpolate(image, [debut, debut + Math.max(1, duree)], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
export const borne = (x: number, de = 0, a2 = 1) => Math.max(de, Math.min(a2, x));
/** Entrée nette : monte de `dy` px et grandit de 0,92 à 1. */
export const entree = (p: number, dy = 60): React.CSSProperties => ({ opacity: borne(p * 3), transform: `translateY(${(1 - p) * dy}px) scale(${0.92 + 0.08 * p})` });

/** Image (25 i/s) d'un événement de l'écran (voix), ou du départ par défaut (s). */
export const img = (p: Pick<ProprietesEcran, "evenements">, cible: string, defautS: number) => Math.round(heure(p, cible, defautS) * FPS);

/** L'image courante. */
export const useImage = () => useCurrentFrame();

/** Grain de papier léger (matière de la charte). */
function Grain({ sombre, L, H }: { sombre: boolean; L: number; H: number }) {
  const id = `grain-l6-${sombre ? "s" : "c"}`;
  return (
    <svg width={L} height={H} style={{ position: "absolute", left: 0, top: 0, opacity: sombre ? 0.07 : 0.05, mixBlendMode: sombre ? "screen" : "multiply" }}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={7} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}

/** Fond de l'écran : celui de la charte (lueur tirée comprise), ou un aplat orange plein. */
export function FondL6({ p, aplat }: { p: ProprietesEcran; aplat?: boolean }) {
  return (
    <>
      {aplat ? <AbsoluteFill style={{ background: C.orangeVif }} /> : <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...lueurDuJeu(p.jeu)} />}
      <Grain sombre={!aplat && p.fond === "sombre"} L={p.largeur} H={p.hauteur} />
    </>
  );
}

/** La marque « axion-ia.com » à la place de la v4 (« ia » à l'accent). */
export function MarqueL6({ p, couleur, accent }: { p: ProprietesEcran; couleur?: string; accent?: string }) {
  const b = disposer(p).textes.find((x) => x.nom === "marque")!;
  const k = couleurs(p.fond);
  return (
    <div style={{ position: "absolute", left: b.boite.x, top: b.boite.y, width: b.boite.largeur, textAlign: "center", fontFamily: FAMILLE_TITRE, fontWeight: 700, fontSize: b.tailleRendue, letterSpacing: `${b.approche}em`, color: couleur ?? k.texte, whiteSpace: "nowrap" }}>
      axion-<span style={{ color: accent ?? (couleur ? undefined : k.accent) }}>ia</span>.com
    </div>
  );
}

/** Morceaux d'une ligne balisée `*mot*`. */
const morceaux = (l: string) => l.split(/(\*[^*]+\*)/).filter(Boolean);

/**
 * Un texte posé. `ligne(i)` : style de la ligne i (entrée animée) ; `couleur`, `accent` : couleurs du texte et des mots
 * balisés ; `style` : style de l'ensemble.
 */
export function TexteL({ t, couleur, accent, ligne, style, decalage }: { t: TexteL6; couleur: string; accent: string; ligne?: (i: number) => React.CSSProperties; style?: React.CSSProperties; decalage?: { x: number; y: number } }) {
  const anton = t.police === "anton";
  return (
    <div style={{ position: "absolute", left: t.boite.x - (decalage?.x ?? 0), top: t.boite.y - (decalage?.y ?? 0), width: t.boite.largeur, textAlign: t.align, fontFamily: anton ? FAMILLE_ANTON : FAMILLE_TITRE, fontWeight: anton ? 400 : 700, fontSize: t.taille, lineHeight: t.interligne, letterSpacing: t.approche ? `${t.approche}em` : undefined, textTransform: anton || t.capitales ? "uppercase" : "none", color: couleur, whiteSpace: "nowrap", ...style }}>
      {t.lignes.map((l, i) => (
        <div key={i} style={{ height: t.taille * t.interligne, ...(ligne ? ligne(i) : {}) }}>
          {morceaux(l).map((m, j) => (
            <span key={j} style={{ color: m.startsWith("*") ? accent : undefined }}>
              {m.replace(/\*/g, "")}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Coche verte (validation), trait blanc ; `trace` 0 → 1 dessine la coche. */
export function Coche({ x, y, r, echelle = 1, trace = 1, ombre = true, style }: { x: number; y: number; r: number; echelle?: number; trace?: number; ombre?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: x - r, top: y - r, width: 2 * r, height: 2 * r, borderRadius: "50%", background: C.vert, transform: `scale(${echelle})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: ombre ? `0 ${r * 0.2}px ${r * 0.5}px ${a(C.vert, 0.3)}` : undefined, ...style }}>
      <svg width={r * 1.25} height={r * 1.25} viewBox="0 0 24 24" fill="none" stroke={C.blanc} strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - borne(trace)} />
      </svg>
    </div>
  );
}

/** Lignes muettes (barres grises) : le corps d'un document, sans faux contenu. */
export function Lignes({ n, largeur, epaisseur = 16, ecart = 14, couleur, visibles = n, dernier = 0.6 }: { n: number; largeur: number; epaisseur?: number; ecart?: number; couleur: string; visibles?: number; dernier?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: ecart }}>
      {Array.from({ length: n }, (_, i) => {
        const q = borne(visibles - i);
        const l = (i === n - 1 ? dernier : 0.82 + (0.18 * ((i * 37) % 5)) / 4) * largeur;
        return <div key={i} style={{ width: l * q, height: epaisseur, borderRadius: epaisseur / 2, background: couleur }} />;
      })}
    </div>
  );
}

/** Carte muette (vignette, titre muet, lignes) : aucun texte lisible, rien d'inventé. */
export function CarteMuette({ x, y, l, h, lignes = 2, contour, coche, style }: { x: number; y: number; l: number; h: number; lignes?: number; contour?: string; coche?: number; style?: React.CSSProperties }) {
  const e = Math.max(3, Math.round(l * 0.018));
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, boxSizing: "border-box", borderRadius: l * 0.08, background: C.blanc, border: contour ? `${e}px solid ${contour}` : undefined, padding: l * 0.07, boxShadow: `0 ${l * 0.04}px ${l * 0.1}px ${a(C.encre, 0.14)}`, ...style }}>
      <div style={{ width: "100%", height: h * 0.42, borderRadius: l * 0.045, background: `linear-gradient(135deg, ${C.grisClair}, ${a(C.orange, 0.55)})` }} />
      <div style={{ marginTop: h * 0.06, width: "78%", height: Math.max(6, h * 0.07), borderRadius: 99, background: C.encre }} />
      <div style={{ marginTop: h * 0.05 }}>
        <Lignes n={lignes} largeur={l * 0.86 - 2 * e} epaisseur={Math.max(4, h * 0.04)} ecart={Math.max(3, h * 0.03)} couleur={a(C.gris, 0.45)} />
      </div>
      {coche !== undefined ? <Coche x={l - e} y={0} r={Math.max(14, l * 0.11)} echelle={coche} /> : null}
    </div>
  );
}

/** Pastille ronde avec un numéro (Anton) ou une icône. */
export function Rond({ x, y, d, fondR, couleur, numero, icone, style }: { x: number; y: number; d: number; fondR: string; couleur: string; numero?: string; icone?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: x - d / 2, top: y - d / 2, width: d, height: d, borderRadius: "50%", background: fondR, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FAMILLE_ANTON, fontSize: d * 0.5, color: couleur, ...style }}>
      {icone ? <Icone nom={icone} taille={d * 0.52} couleur={couleur} epaisseur={2.4} /> : numero}
    </div>
  );
}

/** Pilules posées par `pastilles` (dispositions) : fond plein, coche ou rond à gauche, texte posé. */
export function Pilules({ formes, textes, nom, image, debut, fond, couleurTexte, coche = true }: { formes: { nom: string; boite: { x: number; y: number; largeur: number; hauteur: number } }[]; textes: TexteL6[]; nom: string; image: number; debut: (i: number) => number; fond: string; couleurTexte: string; coche?: boolean }) {
  const f = formes.filter((x) => x.nom.startsWith(`${nom}-`));
  return (
    <>
      {f.map((x, i) => {
        const q = ressort(image, debut(i), 220, 14);
        const t = textes.find((y) => y.nom === x.nom);
        const h = x.boite.hauteur;
        return (
          <div key={x.nom} style={{ position: "absolute", left: 0, top: 0, opacity: borne(q * 3), transform: `translateY(${(1 - q) * 40}px)` }}>
            <div style={{ position: "absolute", left: x.boite.x, top: x.boite.y, width: x.boite.largeur, height: h, borderRadius: h / 2, background: fond }} />
            {coche ? <Coche x={x.boite.x + h / 2} y={x.boite.y + h / 2} r={h * 0.36} echelle={q} ombre={false} /> : <Rond x={x.boite.x + h / 2} y={x.boite.y + h / 2} d={h * 0.62} fondR={C.orangeVif} couleur={C.blanc} />}
            {t ? <TexteL t={t} couleur={couleurTexte} accent={C.orangeVif} /> : null}
          </div>
        );
      })}
    </>
  );
}

/** Géométrie d'arc (0° = midi, sens horaire). */
export function pt(cx: number, cy: number, r: number, ang: number): [number, number] {
  const t = ((ang - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
}
export function arc(cx: number, cy: number, r: number, de: number, vers: number) {
  if (vers - de < 0.01) return "";
  if (vers - de >= 359.99) vers = de + 359.99;
  const [x0, y0] = pt(cx, cy, r, de);
  const [x1, y1] = pt(cx, cy, r, vers);
  const grand = vers - de > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${grand} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
