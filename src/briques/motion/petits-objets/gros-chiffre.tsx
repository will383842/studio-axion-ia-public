/**
 * PETITS OBJETS — gros chiffre (C9-13) : préfixe « + », unité, étoile décorative. Pièce pure, NON inscrite (rien ne l'importe).
 * Le chiffre monte vers la valeur pendant l'entrée puis tient la valeur exacte ; aucun nombre n'est fabriqué ici (la valeur vient
 * de l'appelant, que la garde Studio contrôle : `donnees: "nombres-dits"`). Étoile : une seule, tracée, jamais de note.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { PILE_CSS } from "../../charte/axion-2026";
import type { DefinitionObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

export interface ParametresGrosChiffre {
  valeur: number;
  prefixe?: "+";
  /** Deux mots au plus, sans chiffre. */
  unite?: string;
  etoile?: boolean;
}

const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1, max: 4 } as const;
const VALEUR_MAX = 1e12;
const DECIMALES_MAX = 2;
const MOTS_UNITE_MAX = 2;
const LONGUEUR_UNITE_MAX = 20;
const LARGEUR_CHIFFRE = 560;
const TAILLE_CHIFFRE_MAX = 260;
const TAILLE_UNITE = 44;
const ESPACE_MILLIERS = "\u00a0"; // insécable normale (présente dans Manrope), pas U+202F

const decimalesDe = (v: number): number => {
  for (let d = 0; d <= DECIMALES_MAX; d++) if (Math.abs(v * 10 ** d - Math.round(v * 10 ** d)) < 1e-9) return d;
  return -1;
};

function valider(p: unknown): ParametresGrosChiffre | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const v = r.valeur;
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v >= VALEUR_MAX || decimalesDe(v) < 0) return null;
    const sortie: ParametresGrosChiffre = { valeur: v };
    if (r.prefixe !== undefined) {
      if (r.prefixe !== "+") return null;
      sortie.prefixe = "+";
    }
    if (r.unite !== undefined) {
      if (typeof r.unite !== "string") return null;
      const u = r.unite.trim();
      if (u === "" || u.length > LONGUEUR_UNITE_MAX || /\d/.test(u) || u.split(/\s+/).length > MOTS_UNITE_MAX) return null;
      sortie.unite = u;
    }
    if (r.etoile !== undefined) {
      if (typeof r.etoile !== "boolean") return null;
      sortie.etoile = r.etoile;
    }
    return sortie;
  } catch {
    return null;
  }
}

/** Écriture française : espace insécable (U+00A0) pour les milliers, virgule décimale. Pur. */
export function ecrireNombreFr(valeur: number, decimales = Math.max(0, decimalesDe(valeur))): string {
  const [entier = "0", frac] = Math.abs(valeur).toFixed(decimales).split(".");
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);
  return frac ? `${groupe},${frac}` : groupe;
}

/** Contour d'une étoile à cinq branches (un seul tracé fermé). */
function cheminEtoile(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rayon = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + Math.cos(a) * rayon).toFixed(1)} ${(cy + Math.sin(a) * rayon).toFixed(1)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

export const OBJET_GROS_CHIFFRE: DefinitionObjet<ParametresGrosChiffre> = {
  id: "objet-gros-chiffre",
  famille: "chiffre",
  capacite: "objet.chiffre",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "nombres-dits",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const ton = pr.ton ?? "neutre";
    const phase = phaseObjet(image, dureeImages);
    const decimales = Math.max(0, decimalesDe(parametres.valeur));
    const pas = 10 ** decimales;
    const courant = phase.trace >= 1 ? parametres.valeur : Math.min(parametres.valeur, Math.round(parametres.valeur * pas * phase.trace) / pas);
    const prefixe = parametres.prefixe ?? "";
    const final = `${prefixe}${ecrireNombreFr(parametres.valeur, decimales)}`;
    const affiche = `${prefixe}${ecrireNombreFr(courant, decimales)}`;
    const taille = Math.min(TAILLE_CHIFFRE_MAX, LARGEUR_CHIFFRE / (final.length * 0.62));
    const couleur = couleurDuTon(ton, fond);
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <text data-role="chiffre" x={500} y={520} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={800} fontSize={taille.toFixed(1)} fill={couleur}>
            {affiche}
          </text>
          {parametres.unite ? (
            <text data-role="unite" x={500} y={600} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={600} fontSize={TAILLE_UNITE} fill={couleur}>
              {parametres.unite}
            </text>
          ) : null}
          {parametres.etoile ? <TraceSvg d={cheminEtoile(770, 270, 50)} t={phase.trace} ton={ton} fond={fond} epaisseur={6} /> : null}
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_GROS_CHIFFRE: readonly ParametresGrosChiffre[] = [
  { valeur: 20, unite: "minutes" },
  { valeur: 3, prefixe: "+", etoile: true },
  { valeur: 1250, unite: "mots" },
];
