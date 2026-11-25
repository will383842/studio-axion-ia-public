/**
 * PETITS OBJETS — grille en pointillé et vignettes numérotées (C9-23, famille schema). Pièces pures, NON inscrites (rien ne les importe).
 * Pointillé par tirets séparés (chaque tiret est un `TraceSvg`) ; sélection = cadre en ton accent ; numéros = rang, jamais une donnée ; aucune image dans les cases.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { PILE_CSS } from "../../charte/axion-2026";
import type { FondAxion } from "../../jetons-motion";
import { type DefinitionObjet, type ProprietesObjet, type TonObjet } from "./contrat";
import { IMAGES_ENTREE, IMAGES_SORTIE, phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

/** Grille : `colonnes` × `lignes` (1..4 chacune, au moins 2 cases) ; `interrogations` = rangs (depuis 0) des cases marquées « ? ». */
export interface ParametresGrille {
  colonnes: number;
  lignes: number;
  interrogations?: number[];
}
/** Vignettes : `n` cases numérotées 1..n (2..9). */
export interface ParametresVignettes {
  n: number;
}

const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1.5, max: 4 } as const;
/** Zone occupée : 700 × 700 sur 1000 × 1000 = 49 % du cadre (< SURFACE_MAX, cadre de sélection compris). */
const ZONE = { x: 150, y: 150, l: 700, h: 700 };
const ECART = 30;
const PAS_TIRET = 44;
const LONGUEUR_TIRET = 26;

const entier = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const f = (n: number): string => n.toFixed(1);
const borne01 = (n: number): number => Math.min(1, Math.max(0, n));

function validerGrille(p: unknown): ParametresGrille | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { colonnes, lignes, interrogations } = p as Record<string, unknown>;
    if (!entier(colonnes, 1, 4) || !entier(lignes, 1, 4) || colonnes * lignes < 2) return null;
    const sortie: ParametresGrille = { colonnes, lignes };
    if (interrogations !== undefined) {
      if (!Array.isArray(interrogations)) return null;
      const vus = new Set<number>();
      for (const r of interrogations) {
        if (!entier(r, 0, colonnes * lignes - 1) || vus.has(r)) return null;
        vus.add(r);
      }
      sortie.interrogations = [...interrogations];
    }
    return sortie;
  } catch {
    return null;
  }
}

function validerVignettes(p: unknown): ParametresVignettes | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { n } = p as Record<string, unknown>;
    return entier(n, 2, 9) ? { n } : null;
  } catch {
    return null;
  }
}

interface Case {
  x: number;
  y: number;
  l: number;
  h: number;
}

function disposer(colonnes: number, lignes: number): Case[] {
  const l = (ZONE.l - ECART * (colonnes - 1)) / colonnes;
  const h = (ZONE.h - ECART * (lignes - 1)) / lignes;
  const cases: Case[] = [];
  for (let r = 0; r < lignes; r++) for (let c = 0; c < colonnes; c++) cases.push({ x: ZONE.x + c * (l + ECART), y: ZONE.y + r * (h + ECART), l, h });
  return cases;
}

const rect = (c: Case, marge = 0): string => {
  const x0 = c.x - marge;
  const y0 = c.y - marge;
  const x1 = c.x + c.l + marge;
  const y1 = c.y + c.h + marge;
  return `M ${f(x0)} ${f(y0)} L ${f(x1)} ${f(y0)} L ${f(x1)} ${f(y1)} L ${f(x0)} ${f(y1)} Z`;
};

/** Tirets d'une case, tracés les uns après les autres (`t` global 0..1). */
function tiretsDeCase(c: Case): string[] {
  const cotes: [number, number, number, number][] = [
    [c.x, c.y, c.x + c.l, c.y],
    [c.x + c.l, c.y, c.x + c.l, c.y + c.h],
    [c.x + c.l, c.y + c.h, c.x, c.y + c.h],
    [c.x, c.y + c.h, c.x, c.y],
  ];
  const ds: string[] = [];
  for (const [x0, y0, x1, y1] of cotes) {
    const longueur = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(longueur / PAS_TIRET));
    const pas = longueur / n;
    const ux = (x1 - x0) / longueur;
    const uy = (y1 - y0) / longueur;
    for (let i = 0; i < n; i++) {
      const s0 = i * pas + (pas - Math.min(LONGUEUR_TIRET, pas * 0.6)) / 2;
      const s1 = s0 + Math.min(LONGUEUR_TIRET, pas * 0.6);
      ds.push(`M ${f(x0 + ux * s0)} ${f(y0 + uy * s0)} L ${f(x0 + ux * s1)} ${f(y0 + uy * s1)}`);
    }
  }
  return ds;
}

/** Rang (depuis 0) de la case sélectionnée à `image` : une case par palier pendant la tenue, jamais en arrière, dernière case à la fin. */
export function caseSelectionnee(image: number, dureeImages: number, n: number): number {
  if (!Number.isFinite(image) || !Number.isFinite(dureeImages) || !Number.isInteger(n) || n < 1) return 0;
  const debut = IMAGES_ENTREE;
  const tenue = Math.max(1, dureeImages - IMAGES_SORTIE - debut);
  if (image >= dureeImages - IMAGES_SORTIE) return n - 1;
  // Les n cases tiennent toutes dans la tenue (pas = tenue / n, sans plancher) : aucune case sautée, la dernière est atteinte avant la sortie.
  return Math.min(n - 1, Math.max(0, Math.floor(((image - debut) * n) / tenue)));
}

function Texte({ x, y, taille, contenu, ton, fond, opacite }: { x: number; y: number; taille: number; contenu: string; ton: TonObjet; fond: FondAxion; opacite: number }): JSX.Element {
  return (
    <text x={f(x)} y={f(y)} fontSize={Math.round(taille)} fontFamily={PILE_CSS} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={couleurDuTon(ton, fond)} opacity={opacite}>
      {contenu}
    </text>
  );
}

const GRILLE: DefinitionObjet<ParametresGrille> = {
  id: "objet-grille-pointillee",
  famille: "schema",
  capacite: "objet.schema",
  valider: validerGrille,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "aucune",
  Rendu(pr: ProprietesObjet<ParametresGrille>): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const ton = pr.ton ?? "neutre";
    const phase = phaseObjet(image, dureeImages);
    const cases = disposer(parametres.colonnes, parametres.lignes);
    const marques = new Set(parametres.interrogations ?? []);
    const n = cases.length;
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          {cases.map((c, i) => {
            const ds = tiretsDeCase(c);
            const k = ds.length;
            const t = phase.trace * n - i;
            return (
              <g key={i}>
                {ds.map((d, j) => (
                  <TraceSvg key={j} d={d} t={borne01(t * k - j)} ton={ton} fond={fond} epaisseur={5} />
                ))}
                {marques.has(i) ? <Texte x={c.x + c.l / 2} y={c.y + c.h / 2} taille={Math.min(c.l, c.h) * 0.5} contenu="?" ton={ton} fond={fond} opacite={borne01(t)} /> : null}
              </g>
            );
          })}
        </g>
      </svg>
    );
  },
};

const VIGNETTES: DefinitionObjet<ParametresVignettes> = {
  id: "objet-vignettes-numerotees",
  famille: "schema",
  capacite: "objet.schema",
  valider: validerVignettes,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "aucune",
  Rendu(pr: ProprietesObjet<ParametresVignettes>): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const ton = pr.ton ?? "neutre";
    const phase = phaseObjet(image, dureeImages);
    const { n } = parametres;
    const colonnes = n <= 3 ? n : n === 4 ? 2 : 3;
    const lignes = Math.ceil(n / colonnes);
    const cases = disposer(colonnes, lignes).slice(0, n);
    const sel = caseSelectionnee(image, dureeImages, n);
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          {cases.map((c, i) => (
            <g key={i}>
              <TraceSvg d={rect(c)} t={phase.trace} ton={ton} fond={fond} epaisseur={4} />
              <Texte x={c.x + c.l / 2} y={c.y + c.h / 2} taille={Math.min(c.l, c.h) * 0.4} contenu={String(i + 1)} ton={ton} fond={fond} opacite={phase.trace} />
            </g>
          ))}
          <g data-selection={sel}>
            <TraceSvg d={rect(cases[sel], 10)} t={phase.trace} ton="accent" fond={fond} epaisseur={9} />
          </g>
        </g>
      </svg>
    );
  },
};

export const OBJET_GRILLE_POINTILLEE = GRILLE;
export const OBJET_VIGNETTES_NUMEROTEES = VIGNETTES;

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_GRILLE: readonly ParametresGrille[] = [
  { colonnes: 3, lignes: 2, interrogations: [1, 4] },
  { colonnes: 2, lignes: 2, interrogations: [3] },
  { colonnes: 4, lignes: 1 },
];
export const EXEMPLES_VIGNETTES: readonly ParametresVignettes[] = [{ n: 3 }, { n: 5 }, { n: 9 }];
