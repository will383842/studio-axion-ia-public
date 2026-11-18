/**
 * PETITS OBJETS 2027 (BR-OBJETS-2027-a) — le croquis (X1-08) et le trait de feutre (X1-09) deviennent de vrais objets
 * du registre : 3 `DefinitionObjet` bâties SANS les modifier sur les pièces pures `croquis.ts` et `trait-feutre.ts`.
 * `Rendu` = SVG pur (aucun hook, aucune bibliothèque de tracé : le tremblement vient de `aleaGraine`), même entrée = même image.
 * Non inscrit au plan de scènes (vague 2) : seul le registre les connaît. Imports RELATIFS seulement.
 * Aucun appel à Claude, aucun son, rien sur le visage (la zone du feutre est refusée si elle touche le visage).
 */
import type { JSX } from "react";
import { DUREE_SEC, type DefinitionObjet, type ProprietesObjet, type TonObjet } from "./contrat";
import { planCroquis, validerCroquis, type ParametresCroquis } from "./croquis";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";
import { pointsVisibles, traitFeutre, type GenreTraitFeutre } from "./trait-feutre";

const L = 1000;
const TOILE = { largeur: L, hauteur: L } as const;
const DUREE = { min: DUREE_SEC.min, max: DUREE_SEC.max } as const;
const f = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

/** Zone du feutre en % de la toile. */
export interface ParametresFeutre {
  boite: { x: number; y: number; largeur: number; hauteur: number };
}

const SVG_STYLE = { position: "absolute", inset: 0, overflow: "visible" } as const;
const tonDe = (pr: { ton?: TonObjet }): TonObjet => pr.ton ?? "neutre";

/** Rectangle à main levée : le contour de `planCroquis` repris point par point, avec un léger tremblement tiré de la graine. */
function cheminRectangle(nombres: [number, number, number, number], seed: number, rugosite: number): string {
  const [x, y, l, h] = nombres;
  const coins: [number, number][] = [[x, y], [x + l, y], [x + l, y + h], [x, y + h], [x, y]];
  const pts: string[] = [];
  coins.forEach((c, i) => {
    const dx = (aleaGraine(seed, 2 * i) - 0.5) * 8 * rugosite;
    const dy = (aleaGraine(seed, 2 * i + 1) - 0.5) * 8 * rugosite;
    pts.push(`${f(c[0] + dx)} ${f(c[1] + dy)}`);
  });
  return `M ${pts.join(" L ")}`;
}

export const OBJET_CROQUIS: DefinitionObjet<ParametresCroquis> = {
  id: "objet-croquis",
  famille: "manuscrit",
  capacite: "objet.manuscrit",
  valider: validerCroquis,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "mots-dits",
  Rendu(pr: ProprietesObjet<ParametresCroquis>): JSX.Element {
    const { image, dureeImages, fond, parametres, graine } = pr;
    const ton = tonDe(pr);
    const plan = planCroquis("rectangle", parametres, ton, fond, graine);
    const t = phaseObjet(image, dureeImages);
    return (
      <svg viewBox={`0 0 ${L} ${L}`} width="100%" height="100%" data-croquis="rectangle" style={SVG_STYLE}>
        <g opacity={t.opacite}>
          {plan ? plan.traits.map((tr, i) => <TraceSvg key={i} d={cheminRectangle(tr.nombres, tr.seed, plan.reglages.roughness)} t={t.trace} ton={ton} fond={fond} epaisseur={plan.reglages.strokeWidth} />) : null}
        </g>
      </svg>
    );
  },
};

function validerFeutre(genre: GenreTraitFeutre) {
  return (p: unknown): ParametresFeutre | null => {
    try {
      if (typeof p !== "object" || p === null) return null;
      const b = (p as { boite?: unknown }).boite;
      if (typeof b !== "object" || b === null) return null;
      const { x, y, largeur, hauteur } = b as Record<string, unknown>;
      if (![x, y, largeur, hauteur].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
      const boite = { x: x as number, y: y as number, largeur: largeur as number, hauteur: hauteur as number };
      return traitFeutre({ genre, graine: 0, zone: boite }) ? { boite } : null;
    } catch {
      return null;
    }
  };
}

function feutre(genre: GenreTraitFeutre, id: DefinitionObjet<ParametresFeutre>["id"]): DefinitionObjet<ParametresFeutre> {
  return {
    id,
    famille: "trait",
    capacite: "objet.trait",
    valider: validerFeutre(genre),
    toile: TOILE,
    dureeSec: DUREE,
    donnees: "mots-dits",
    Rendu(pr: ProprietesObjet<ParametresFeutre>): JSX.Element {
      const { image, dureeImages, fond, parametres, graine } = pr;
      const trait = validerFeutre(genre)(parametres) ? traitFeutre({ genre, graine, zone: parametres.boite }) : null;
      const t = phaseObjet(image, dureeImages);
      const pts = trait ? pointsVisibles(trait.points, t.trace) : [];
      const d = pts.length ? `M ${pts.map(([px, py]) => `${f((px * L) / 100)} ${f((py * L) / 100)}`).join(" L ")}` : "";
      return (
        <svg viewBox={`0 0 ${L} ${L}`} width="100%" height="100%" data-feutre={genre} style={SVG_STYLE}>
          <g opacity={t.opacite}>
            <path d={d} stroke={couleurDuTon(tonDe(pr), fond)} strokeWidth={trait ? trait.epaisseur : 0} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </svg>
      );
    },
  };
}

export const OBJET_FEUTRE_ENTOURAGE = feutre("entourage", "objet-feutre-entourage");
export const OBJET_FEUTRE_SOULIGNEMENT = feutre("soulignement", "objet-feutre-soulignement");

/** Données de planche (entrées valides). */
export const EXEMPLES_OBJETS_2027: { croquis: readonly ParametresCroquis[]; feutreEntourage: readonly ParametresFeutre[]; feutreSoulignement: readonly ParametresFeutre[] } = {
  croquis: [{ x: 15, y: 20, largeur: 45, hauteur: 25 }, { x: 10, y: 5, largeur: 60, hauteur: 30, rugosite: 1.4 }],
  feutreEntourage: [{ boite: { x: 20, y: 72, largeur: 40, hauteur: 18 } }],
  feutreSoulignement: [{ boite: { x: 10, y: 5, largeur: 50, hauteur: 6 } }],
};
