/** PETITS OBJETS — dossier qui se remplit, chronomètre, barre de progression. Pièces pures, non inscrites. Tracés par `<TraceSvg>`. Imports relatifs seulement. */
import type { JSX } from "react";
import { PILE_CSS } from "../../charte/axion-2026";
import { DUREE_SEC, type DefinitionObjet, type ProprietesObjet, type TonObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { tremblement } from "./tremblement";
import { TraceSvg } from "./TraceSvg";
import { couleurDuTon } from "./tons";

const TOILE = { largeur: 1080, hauteur: 1920 } as const;
const borne01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const entier = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const lire = (p: unknown): Record<string, unknown> | null => (typeof p === "object" && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : null);

/* ------------------------------ Dossier ------------------------------ */

export interface ParamDossier {
  /** Feuilles qui entrent dans le dossier, 1 à 5. */
  feuilles: number;
}
export const FEUILLES_MAX = 5;

function validerDossier(p: unknown): ParamDossier | null {
  const o = lire(p);
  return o && entier(o.feuilles, 1, FEUILLES_MAX) ? { feuilles: o.feuilles } : null;
}

const D = { x: 260, y: 760, l: 560, h: 420 } as const;
const cheminDossier = (): string =>
  `M ${D.x} ${D.y + D.h} L ${D.x} ${D.y} L ${D.x + D.l * 0.35} ${D.y} L ${D.x + D.l * 0.42} ${D.y + 50} L ${D.x + D.l} ${D.y + 50} L ${D.x + D.l} ${D.y + D.h} Z`;
/** Feuille `i` : un rectangle qui dépasse du dossier, décalé vers le haut à chaque feuille. */
const cheminFeuille = (i: number): string => {
  const x = D.x + 40 + i * 14;
  const haut = D.y + 30 - (i + 1) * 22;
  return `M ${x} ${D.y + 50} L ${x} ${haut} L ${x + D.l - 120} ${haut} L ${x + D.l - 120} ${D.y + 50}`;
};

function RenduDossier({ image, fps, dureeImages, fond, ton = "neutre", graine, parametres }: ProprietesObjet<ParamDossier>): JSX.Element {
  const { trace, opacite } = phaseObjet(image, dureeImages);
  const p = validerDossier(parametres);
  const t = tremblement(graine, image, fps);
  const n = p?.feuilles ?? 0;
  const avance = (k: number) => borne01(trace * (n + 1) - k);
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true">
      {p ? (
        <g opacity={opacite} transform={`translate(${t.dx.toFixed(2)} ${t.dy.toFixed(2)}) rotate(${t.angle.toFixed(2)} ${D.x + D.l / 2} ${D.y + D.h / 2})`}>
          <TraceSvg d={cheminDossier()} t={avance(0)} ton={ton} fond={fond} />
          {Array.from({ length: n }, (_, i) => (
            <TraceSvg key={i} d={cheminFeuille(i)} t={avance(i + 1)} ton={ton} fond={fond} epaisseur={4} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}

export const DEF_DOSSIER: DefinitionObjet<ParamDossier> = {
  id: "objet-dossier", famille: "schema", capacite: "objet.schema", valider: validerDossier, toile: TOILE,
  dureeSec: { min: DUREE_SEC.min, max: 3 }, donnees: "aucune", Rendu: RenduDossier,
};

/* ------------------------------ Chronomètre ------------------------------ */

export interface ParamChrono {
  /** Durée affichée, en secondes entières (1 à 5999) : un nombre dit, contrôlé par la garde Studio. */
  dureeSec: number;
}
export const DUREE_CHRONO_MAX = 5999;

function validerChrono(p: unknown): ParamChrono | null {
  const o = lire(p);
  return o && entier(o.dureeSec, 1, DUREE_CHRONO_MAX) ? { dureeSec: o.dureeSec } : null;
}

/** « mm:ss » ; au-delà de 99 minutes le nombre de minutes garde tous ses chiffres. */
export function formaterChrono(secondes: number): string {
  const s = Number.isFinite(secondes) ? Math.max(0, Math.round(secondes)) : 0;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

const C = { cx: 540, cy: 900, r: 190 } as const;
function cheminCadran(): string {
  const pts: string[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI - Math.PI / 2;
    pts.push(`${(C.cx + Math.cos(a) * C.r).toFixed(1)},${(C.cy + Math.sin(a) * C.r).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")}`;
}
function cheminAiguille(secondes: number): string {
  const a = ((secondes % 60) * 6 - 90) * (Math.PI / 180);
  return `M ${C.cx} ${C.cy} L ${(C.cx + Math.cos(a) * C.r * 0.75).toFixed(1)} ${(C.cy + Math.sin(a) * C.r * 0.75).toFixed(1)}`;
}

function RenduChrono({ image, fps, dureeImages, fond, ton = "neutre", graine, parametres }: ProprietesObjet<ParamChrono>): JSX.Element {
  const { trace, opacite } = phaseObjet(image, dureeImages);
  const p = validerChrono(parametres);
  const t = tremblement(graine, image, fps);
  /** Le compteur monte avec le tracé ; une fois le tracé fini, l'affichage est la durée exacte. */
  const secondes = p ? (trace >= 1 ? p.dureeSec : Math.floor(p.dureeSec * trace)) : 0;
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true">
      {p ? (
        <g opacity={opacite} transform={`translate(${t.dx.toFixed(2)} ${t.dy.toFixed(2)}) rotate(${t.angle.toFixed(2)} ${C.cx} ${C.cy})`}>
          <TraceSvg d={cheminCadran()} t={trace} ton={ton} fond={fond} />
          <TraceSvg d={cheminAiguille(secondes)} t={trace} ton={ton} fond={fond} />
          <text x={C.cx} y={C.cy + C.r + 90} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={700} fontSize={84} fill={couleurDuTon(ton, fond)}>
            {formaterChrono(secondes)}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export const DEF_CHRONO: DefinitionObjet<ParamChrono> = {
  id: "objet-chrono", famille: "chiffre", capacite: "objet.chiffre", valider: validerChrono, toile: TOILE,
  dureeSec: { min: 1, max: DUREE_SEC.max }, donnees: "nombres-dits", Rendu: RenduChrono,
};

/* ------------------------------ Barre de progression ------------------------------ */

export interface ParamBarre {
  /** Avancement, 0..1. Aucun nombre n'est écrit. */
  progression: number;
  /** Preuve du « fait » : sans elle, la barre à 100 % n'est jamais sauge. */
  preuve?: string;
}

function validerBarre(p: unknown): ParamBarre | null {
  const o = lire(p);
  if (!o || typeof o.progression !== "number" || !Number.isFinite(o.progression) || o.progression < 0 || o.progression > 1) return null;
  if (o.preuve !== undefined && typeof o.preuve !== "string") return null;
  return o.preuve === undefined ? { progression: o.progression } : { progression: o.progression, preuve: o.preuve };
}

/** Sauge (`valide`) seulement à 100 % et avec une preuve non vide ; sinon accent (ou le ton demandé s'il n'est pas `valide`). */
export function tonBarre(p: ParamBarre, demande: TonObjet = "accent"): TonObjet {
  if (demande !== "valide") return demande;
  return p.progression >= 1 && typeof p.preuve === "string" && p.preuve.trim() !== "" ? "valide" : "accent";
}

const B = { x: 140, y: 940, l: 800, h: 44 } as const;
const cheminCadre = (): string => `M ${B.x} ${B.y} L ${B.x + B.l} ${B.y} L ${B.x + B.l} ${B.y + B.h} L ${B.x} ${B.y + B.h} Z`;
const cheminRemplissage = (progression: number): string => `M ${B.x + 8} ${B.y + B.h / 2} L ${(B.x + 8 + (B.l - 16) * progression).toFixed(1)} ${B.y + B.h / 2}`;

function RenduBarre({ image, fps, dureeImages, fond, ton = "accent", graine, parametres }: ProprietesObjet<ParamBarre>): JSX.Element {
  const { trace, opacite } = phaseObjet(image, dureeImages);
  const p = validerBarre(parametres);
  const t = tremblement(graine, image, fps);
  const tonFinal = p ? tonBarre(p, ton) : ton;
  return (
    <svg viewBox={`0 0 ${TOILE.largeur} ${TOILE.hauteur}`} width="100%" height="100%" aria-hidden="true">
      {p ? (
        <g opacity={opacite} transform={`translate(${t.dx.toFixed(2)} ${t.dy.toFixed(2)}) rotate(${t.angle.toFixed(2)} ${B.x + B.l / 2} ${B.y + B.h / 2})`}>
          <TraceSvg d={cheminCadre()} t={trace} ton="neutre" fond={fond} epaisseur={4} />
          {p.progression > 0 ? <TraceSvg d={cheminRemplissage(p.progression)} t={trace} ton={tonFinal} fond={fond} epaisseur={B.h - 16} /> : null}
        </g>
      ) : null}
    </svg>
  );
}

export const DEF_BARRE_PROGRESSION: DefinitionObjet<ParamBarre> = {
  id: "objet-barre-progression", famille: "chiffre", capacite: "objet.chiffre", valider: validerBarre, toile: TOILE,
  dureeSec: { min: DUREE_SEC.min, max: 3 }, donnees: "aucune", Rendu: RenduBarre,
};

/** Données de planche (C9-39/C9-40) : entrées valides. */
export const EXEMPLES_DOSSIER_CHRONO_BARRE = {
  dossier: [{ feuilles: 1 }, { feuilles: 3 }, { feuilles: 5 }],
  chrono: [{ dureeSec: 90 }, { dureeSec: 1260 }],
  barre: [{ progression: 0.4 }, { progression: 1, preuve: "tableau terminé" }],
} as const satisfies { dossier: readonly ParamDossier[]; chrono: readonly ParamChrono[]; barre: readonly ParamBarre[] };
