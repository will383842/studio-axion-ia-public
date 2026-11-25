/**
 * PETITS OBJETS — cartes à coche (C9-15) : une à quatre cartes empilées, chacune avec sa coche. Pièce pure, NON inscrite (rien ne l'importe).
 * Cadre et coche tracés par `TraceSvg` (réutilise la coche de C9-09 : même tracé, même durée). Texte de chaque carte : 4 mots au plus, en Manrope.
 * Coche sauge seulement avec une `preuve` non vide ; sinon ton neutre. Aucun filtre, aucune couleur : un ton. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { PILE_CSS } from "../../charte/axion-2026";
import { couleursSur } from "../../jetons-motion";
import { MOTS_MAX, SURFACE_MAX, type DefinitionObjet, type TonObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

export interface BoiteCartes {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
export interface ParametresCartes {
  boite: BoiteCartes;
  /** 1 à 4 textes, chacun de 4 mots au plus (mots dits : garde Studio C9-04). */
  cartes: string[];
  /** Preuve de la validation ; vide ou absente = coches jamais sauge. */
  preuve?: string;
}

export const CARTES_MAX = 4;
const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1.2, max: 4 } as const;
const DECALAGE_CARTE = 4;
const CARACTERES_MAX = 40;
const EPAISSEUR = 6;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const borne01 = (n: number): number => Math.min(1, Math.max(0, n));
const f = (n: number): string => n.toFixed(1);
const nbMots = (t: string): number => t.trim().split(/\s+/).filter(Boolean).length;

function valider(p: unknown): ParametresCartes | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const b = r.boite;
    if (typeof b !== "object" || b === null) return null;
    const { x, y, largeur, hauteur } = b as Record<string, unknown>;
    if (!nombre(x) || !nombre(y) || !nombre(largeur) || !nombre(hauteur)) return null;
    if (x < 0 || y < 0 || largeur <= 0 || hauteur <= 0 || x + largeur > 100 || y + hauteur > 100) return null;
    if ((largeur * hauteur) / 10000 > SURFACE_MAX) return null;
    if (!Array.isArray(r.cartes) || r.cartes.length < 1 || r.cartes.length > CARTES_MAX) return null;
    const cartes: string[] = [];
    for (const c of r.cartes) {
      if (typeof c !== "string") return null;
      const t = c.trim();
      if (t === "" || nbMots(t) > MOTS_MAX || t.length > CARACTERES_MAX) return null;
      cartes.push(t);
    }
    const sortie: ParametresCartes = { boite: { x, y, largeur, hauteur }, cartes };
    if (r.preuve !== undefined) {
      if (typeof r.preuve !== "string") return null;
      sortie.preuve = r.preuve;
    }
    return sortie;
  } catch {
    return null;
  }
}

export const OBJET_CARTES_COCHE: DefinitionObjet<ParametresCartes> = {
  id: "objet-cartes-coche",
  famille: "etiquette",
  capacite: "objet.cartes",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "mots-dits",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres, ton: tonDemande } = pr;
    const { boite, cartes } = parametres;
    const phase = phaseObjet(image, dureeImages);
    const sauge = typeof parametres.preuve === "string" && parametres.preuve.trim() !== "";
    const tonCoche: TonObjet = sauge ? "valide" : "neutre";
    const tonCadre: TonObjet = tonDemande === "accent" ? "accent" : "neutre";
    const bx = (boite.x * L) / 100;
    const by = (boite.y * H) / 100;
    const bl = (boite.largeur * L) / 100;
    const bh = (boite.hauteur * H) / 100;
    const n = cartes.length;
    const ecart = Math.min(24, bh * 0.05);
    const hc = (bh - ecart * (n - 1)) / n;
    const encre = couleursSur(fond).texte;
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          {cartes.map((texte, i) => {
            const y = by + i * (hc + ecart);
            const t = phaseObjet(image - i * DECALAGE_CARTE, dureeImages).trace;
            const cote = Math.min(hc * 0.5, 70);
            const cx = bx + 24;
            const cy = y + (hc - cote) / 2;
            const tc = borne01((t - 0.3) / 0.7);
            const tx = cx + cote + 22;
            const taille = Math.max(12, Math.min(hc * 0.36, 52, ((bl - (tx - bx) - 20) / Math.max(1, texte.length)) / 0.6));
            const cadre = `M ${f(bx)} ${f(y)} L ${f(bx + bl)} ${f(y)} L ${f(bx + bl)} ${f(y + hc)} L ${f(bx)} ${f(y + hc)} Z`;
            const coche = `M ${f(cx + cote * 0.12)} ${f(cy + cote * 0.55)} L ${f(cx + cote * 0.4)} ${f(cy + cote * 0.82)} L ${f(cx + cote * 0.92)} ${f(cy + cote * 0.2)}`;
            return (
              <g key={i}>
                <TraceSvg d={cadre} t={t} ton={tonCadre} fond={fond} epaisseur={EPAISSEUR} />
                <TraceSvg d={coche} t={tc} ton={tonCoche} fond={fond} epaisseur={EPAISSEUR + 2} />
                <text x={f(tx)} y={f(y + hc / 2)} dominantBaseline="central" fontFamily={PILE_CSS} fontWeight={700} fontSize={f(taille)} fill={encre} fillOpacity={borne01(t * 2 - 0.4)}>
                  {texte}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_CARTES: readonly ParametresCartes[] = [
  { boite: { x: 15, y: 40, largeur: 70, hauteur: 12 }, cartes: ["Premier point"] },
  { boite: { x: 15, y: 30, largeur: 70, hauteur: 28 }, cartes: ["Premier point", "Deuxième point"], preuve: "les deux points sont dits" },
  { boite: { x: 12, y: 20, largeur: 76, hauteur: 50 }, cartes: ["Un", "Deux mots", "Trois petits mots", "Quatre mots bien là"] },
];
