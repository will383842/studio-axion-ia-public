import React from "react";
/**
 * TYP-D · les objets que devient un mot (maquette TYP-D-1 / TYP-D-2) : la CLOCHE (alerte), l'ENVELOPPE (e-mail),
 * l'HORLOGE (une heure). Chacun : `trace` 0 → 1 (le contour se dessine autour du mot posé), puis `plein` 0 → 1 (il
 * devient l'objet : rempli, il sonne, se ferme, ses aiguilles vont à l'heure). Le mot reste gravé dedans. Aucun JSX ni
 * calcul au niveau module.
 */
import { styleAnton } from "./commun";
import { tailleMotGeant } from "./donnees";

export interface ProprietesObjet {
  /** Boîte de l'objet (px). */
  x: number;
  y: number;
  l: number;
  h: number;
  mot: string;
  trace: number;
  plein: number;
  /** Couleur du trait et du mot avant le remplissage ; couleur du plein ; couleur du mot sur le plein. */
  trait: string;
  remplissage: string;
  motSurPlein: string;
  /** Temps écoulé depuis le remplissage (s) : la cloche sonne, les aiguilles finissent leur course. */
  depuis: number;
  heure?: { h: number; m: number };
}

/** Couleur intermédiaire (mélange linéaire de deux #RRGGBB). */
function melange(a: string, b: string, x: number): string {
  const p = (c: string, i: number) => parseInt(c.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `#${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * x).toString(16).padStart(2, "0")).join("")}`;
}

/* ---------------------------------- Cloche ---------------------------------- */
// Tracé de la maquette (grille 24) : corps à épaules rondes, lèvre, bouton, battant.
const CORPS = "M3.2 17.2C5 16.2 6.2 14.9 6.2 12.6V9.8C6.2 6.2 8.4 3.4 12 3.4C15.6 3.4 17.8 6.2 17.8 9.8V12.6C17.8 14.9 19 16.2 20.8 17.2";

export function Cloche(p: ProprietesObjet) {
  const e = Math.min(p.l, p.h) / 24;
  const x = p.x + (p.l - 24 * e) / 2;
  const fini = p.trace >= 0.85;
  // Elle sonne : balancement amorti autour du bouton, battant déporté.
  const balance = p.plein > 0 ? -10 * Math.exp(-p.depuis * 1.2) * Math.cos(p.depuis * 9) * p.plein : 0;
  const plein = p.plein > 0 ? p.remplissage : undefined;
  const taille = tailleMotGeant(p.mot, 10.4 * e, 3.6 * e);
  const couleurMot = melange(p.trait, p.motSurPlein, p.plein);
  return (
    <div style={{ position: "absolute", left: x, top: p.y, width: 24 * e, height: 24 * e, transform: `rotate(${balance}deg)`, transformOrigin: `${12 * e}px ${2.2 * e}px` }}>
      <svg width={24 * e} height={24 * e} viewBox="0 0 24 24" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} fill="none" stroke={p.plein > 0 ? p.remplissage : p.trait} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round">
        {plein ? <path d={CORPS + "Z"} fill={plein} fillOpacity={p.plein} stroke="none" /> : null}
        <path d={CORPS} pathLength={1} strokeDasharray={`${p.trace} 2`} />
        {fini ? (
          <>
            <rect x={2.2} y={17.2} width={19.6} height={1.6} rx={0.8} fill={plein ?? "none"} fillOpacity={p.plein} />
            <circle cx={12} cy={2.2} r={1.2} fill={plein ?? "none"} fillOpacity={p.plein} />
            <circle cx={12 + 1.2 * p.plein} cy={20.6} r={1.4} fill={plein ?? (p.trait as string)} />
          </>
        ) : null}
        {p.plein > 0 ? (
          <g strokeWidth={0.45} opacity={p.plein}>
            <path d="M1.2 7.5Q-0.4 10.5 1.2 13.5" />
            <path d="M22.8 7.5Q24.4 10.5 22.8 13.5" />
          </g>
        ) : null}
      </svg>
      <div style={{ position: "absolute", left: 0, width: 24 * e, textAlign: "center", top: 10.6 * e - taille * 0.5 }}>
        <div style={styleAnton(taille, couleurMot)}>{p.mot}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Enveloppe -------------------------------- */
export function Enveloppe(p: ProprietesObjet) {
  const l = Math.min(p.l, 820);
  const h = Math.min(p.h, l * 0.66);
  const x = p.x + (p.l - l) / 2;
  const y = p.y + (p.h - h) / 2;
  const r = 34;
  const contour = `M${r} 0H${l - r}A${r} ${r} 0 0 1 ${l} ${r}V${h - r}A${r} ${r} 0 0 1 ${l - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`;
  // Le rabat se referme : du haut ouvert (pointe en haut) à la pointe au milieu.
  const pointe = h * (0.55 * Math.min(1, p.plein * 1.3));
  const taille = tailleMotGeant(p.mot, l * 0.78, h * 0.3);
  const couleurMot = melange(p.trait, p.motSurPlein, p.plein);
  const penche = -4 * p.plein;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: l, height: h, transform: `rotate(${penche}deg)` }}>
      <svg width={l} height={h} viewBox={`0 0 ${l} ${h}`} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {p.plein > 0 ? <path d={contour} fill={p.remplissage} fillOpacity={p.plein} /> : null}
        <path d={contour} stroke={p.plein > 0 ? p.remplissage : p.trait} strokeWidth={14} pathLength={1} strokeDasharray={`${p.trace} 2`} />
        {p.plein > 0 ? <path d={`M${r * 0.6} ${r * 0.5}L${l / 2} ${pointe}L${l - r * 0.6} ${r * 0.5}`} stroke={p.motSurPlein} strokeWidth={14} opacity={p.plein} /> : null}
      </svg>
      <div style={{ position: "absolute", left: 0, width: l, textAlign: "center", top: h * (0.5 + 0.18 * p.plein) - taille * 0.5 }}>
        <div style={{ ...styleAnton(taille, couleurMot), display: "inline-block" }}>{p.mot}</div>
      </div>
    </div>
  );
}

/* ---------------------------------- Horloge --------------------------------- */
export function Horloge(p: ProprietesObjet) {
  const r = Math.min(p.l, p.h) / 2 - 10;
  const cx = p.x + p.l / 2;
  const cy = p.y + p.h / 2;
  const cible = p.heure ?? { h: 10, m: 10 };
  // Les aiguilles partent de midi et vont à l'heure dite (arrivée douce).
  const course = 1 - (1 - Math.min(1, p.depuis / 0.6)) ** 3;
  const aMin = ((cible.m / 60) * 360) * course;
  const aH = (((cible.h % 12) + cible.m / 60) / 12) * 360 * course;
  const contraste = p.motSurPlein;
  const taille = tailleMotGeant(p.mot, r * 1.25, r * (0.62 - 0.26 * p.plein));
  const yMot = cy + r * 0.44 * p.plein - taille * 0.5;
  const couleurMot = melange(p.trait, p.motSurPlein, p.plein);
  const rad = (a: number) => (a * Math.PI) / 180;
  return (
    <>
      <svg width={1080} height={p.y + p.h + 20} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} fill="none" strokeLinecap="round">
        {p.plein > 0 ? <circle cx={cx} cy={cy} r={r} fill={p.remplissage} fillOpacity={p.plein} /> : null}
        <circle cx={cx} cy={cy} r={r} stroke={p.plein > 0 ? p.remplissage : p.trait} strokeWidth={16} pathLength={1} strokeDasharray={`${p.trace} 2`} transform={`rotate(-90 ${cx} ${cy})`} />
        {p.plein > 0 ? (
          <g stroke={contraste} opacity={p.plein}>
            {Array.from({ length: 12 }, (_, k) => {
              const a = rad(k * 30);
              const r0 = r - 30;
              const r1 = r - (k % 3 === 0 ? 78 : 54);
              return <path key={k} d={`M${(cx + r0 * Math.sin(a)).toFixed(1)} ${(cy - r0 * Math.cos(a)).toFixed(1)}L${(cx + r1 * Math.sin(a)).toFixed(1)} ${(cy - r1 * Math.cos(a)).toFixed(1)}`} strokeWidth={k % 3 === 0 ? 14 : 8} />;
            })}
            <path d={`M${cx} ${cy}L${(cx + (r - 70) * Math.sin(rad(aMin))).toFixed(1)} ${(cy - (r - 70) * Math.cos(rad(aMin))).toFixed(1)}`} strokeWidth={16} />
            <path d={`M${cx} ${cy}L${(cx + r * 0.5 * Math.sin(rad(aH))).toFixed(1)} ${(cy - r * 0.5 * Math.cos(rad(aH))).toFixed(1)}`} strokeWidth={26} />
            <circle cx={cx} cy={cy} r={18} fill={contraste} stroke="none" />
          </g>
        ) : null}
      </svg>
      <div style={{ position: "absolute", left: cx - r, width: 2 * r, textAlign: "center", top: yMot }}>
        <div style={{ ...styleAnton(taille, couleurMot), display: "inline-block" }}>{p.mot}</div>
      </div>
    </>
  );
}
