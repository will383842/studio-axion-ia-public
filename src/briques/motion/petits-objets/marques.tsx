/**
 * PETITS OBJETS — marques (C9-09) : coche (avec ou sans rond), croix, mot barré. Pièces pures, NON inscrites (rien ne les importe).
 * Tracés par `TraceSvg` ; aucun texte (le mot barré reste celui de l'image dessous), aucun filtre.
 * Coche sauge seulement avec une `preuve` non vide ; croix et barré : terracotta (`erreur`) ou neutre. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { SURFACE_MAX, type DefinitionObjet, type ProprietesObjet, type TonObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { cheminCercleObjet, TraceSvg } from "./TraceSvg";

/** Boîte en % de la toile. */
export interface BoiteMarque {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
export interface ParametresMarque {
  boite: BoiteMarque;
  /** Coche seulement : preuve de la validation ; vide ou absente = jamais de sauge. */
  preuve?: string;
  /** Coche seulement : rond autour de la coche. */
  rond?: boolean;
}

const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 0.8, max: 3 } as const;
const DECALAGE_CROIX = 4;
const ANGLE_BARRE_MAX = 12;
const EPAISSEUR = 9;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const borne01 = (n: number): number => Math.min(1, Math.max(0, n));
const f = (n: number): string => n.toFixed(1);

function valider(p: unknown): ParametresMarque | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const b = r.boite;
    if (typeof b !== "object" || b === null) return null;
    const { x, y, largeur, hauteur } = b as Record<string, unknown>;
    if (!nombre(x) || !nombre(y) || !nombre(largeur) || !nombre(hauteur)) return null;
    if (x < 0 || y < 0 || largeur <= 0 || hauteur <= 0 || x + largeur > 100 || y + hauteur > 100) return null;
    if ((largeur * hauteur) / 10000 > SURFACE_MAX) return null;
    const sortie: ParametresMarque = { boite: { x, y, largeur, hauteur } };
    if (r.preuve !== undefined) {
      if (typeof r.preuve !== "string") return null;
      sortie.preuve = r.preuve;
    }
    if (r.rond !== undefined) {
      if (typeof r.rond !== "boolean") return null;
      sortie.rond = r.rond;
    }
    return sortie;
  } catch {
    return null;
  }
}

interface Px {
  x: number;
  y: number;
  l: number;
  h: number;
}
const enPx = (b: BoiteMarque): Px => ({ x: (b.x * L) / 100, y: (b.y * H) / 100, l: (b.largeur * L) / 100, h: (b.hauteur * H) / 100 });

type Variante = "coche" | "croix" | "barre";

function Dessin({ variante, p, image, dureeImages, ton, fond, graine }: { variante: Variante; p: ParametresMarque; image: number; dureeImages: number; ton: TonObjet; fond: ProprietesObjet<ParametresMarque>["fond"]; graine: number }): JSX.Element {
  const b = enPx(p.boite);
  const t = phaseObjet(image, dureeImages).trace;
  if (variante === "coche") {
    const avecRond = p.rond === true;
    const tc = avecRond ? borne01((t - 0.4) / 0.6) : t;
    const d = `M ${f(b.x + b.l * 0.22)} ${f(b.y + b.h * 0.55)} L ${f(b.x + b.l * 0.42)} ${f(b.y + b.h * 0.78)} L ${f(b.x + b.l * 0.8)} ${f(b.y + b.h * 0.24)}`;
    return (
      <>
        {avecRond ? <TraceSvg d={cheminCercleObjet(b.x, b.y, b.l, b.h, graine % 7)} t={borne01(t / 0.6)} ton={ton} fond={fond} epaisseur={EPAISSEUR} /> : null}
        <TraceSvg d={d} t={tc} ton={ton} fond={fond} epaisseur={EPAISSEUR} />
      </>
    );
  }
  if (variante === "croix") {
    const t2 = phaseObjet(image - DECALAGE_CROIX, dureeImages).trace;
    const d1 = `M ${f(b.x)} ${f(b.y)} L ${f(b.x + b.l)} ${f(b.y + b.h)}`;
    const d2 = `M ${f(b.x + b.l)} ${f(b.y)} L ${f(b.x)} ${f(b.y + b.h)}`;
    return (
      <>
        <TraceSvg d={d1} t={t} ton={ton} fond={fond} epaisseur={EPAISSEUR} />
        <TraceSvg d={d2} t={t2} ton={ton} fond={fond} epaisseur={EPAISSEUR} />
      </>
    );
  }
  /* Barré : un trait en biais (4 à 12°, sens tiré de la graine) au travers de la boîte. */
  const degres = 4 + aleaGraine(graine, 1) * (ANGLE_BARRE_MAX - 4);
  const sens = aleaGraine(graine, 2) < 0.5 ? -1 : 1;
  const dy = Math.tan((Math.min(degres, ANGLE_BARRE_MAX) * Math.PI) / 180) * b.l * sens;
  const cy = b.y + b.h / 2;
  const d = `M ${f(b.x)} ${f(cy - dy / 2)} L ${f(b.x + b.l)} ${f(cy + dy / 2)}`;
  return <TraceSvg d={d} t={t} ton={ton} fond={fond} epaisseur={EPAISSEUR} />;
}

function creer(variante: Variante, id: DefinitionObjet<ParametresMarque>["id"]): DefinitionObjet<ParametresMarque> {
  return {
    id,
    famille: "marque",
    capacite: "objet.marque",
    valider,
    toile: TOILE,
    dureeSec: DUREE,
    donnees: "aucune",
    Rendu(pr): JSX.Element {
      const { image, dureeImages, fond, parametres, graine } = pr;
      let ton: TonObjet;
      if (variante === "coche") ton = typeof parametres.preuve === "string" && parametres.preuve.trim() !== "" ? "valide" : "neutre";
      else ton = pr.ton === "erreur" ? "erreur" : "neutre";
      const phase = phaseObjet(image, dureeImages);
      return (
        <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <g opacity={phase.opacite}>
            <Dessin variante={variante} p={parametres} image={image} dureeImages={dureeImages} ton={ton} fond={fond} graine={graine} />
          </g>
        </svg>
      );
    },
  };
}

export const OBJET_COCHE = creer("coche", "objet-coche");
export const OBJET_CROIX = creer("croix", "objet-croix");
export const OBJET_MOT_BARRE = creer("barre", "objet-mot-barre");

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_MARQUES: readonly ParametresMarque[] = [
  { boite: { x: 20, y: 30, largeur: 40, hauteur: 25 } },
  { boite: { x: 30, y: 35, largeur: 30, hauteur: 30 }, rond: true, preuve: "chiffre dit à l'image" },
  { boite: { x: 15, y: 45, largeur: 55, hauteur: 12 } },
];
