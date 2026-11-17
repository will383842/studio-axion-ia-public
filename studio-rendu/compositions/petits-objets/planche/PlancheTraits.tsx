/**
 * PLANCHE « TRAITS ET MARQUES » (C9-39) : grille qui joue chaque exemple des familles traits et marques (C9-06 à C9-10)
 * sur une silhouette témoin dessinée (formes simples, jamais une photo). Une pastille dit si l'objet touche la zone du visage.
 * Pur (aucun hook Remotion) : l'image est fixée par la prop `image`. Imports relatifs seulement. Rien d'inscrit.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../../../src/briques/jetons-motion";
import type { DefinitionObjet, ZoneObjet } from "../../../../src/briques/motion/petits-objets/contrat";
import { ZONE_VISAGE_OBJETS } from "../../../../src/briques/motion/petits-objets/zones";
import { EXEMPLES_FLECHES, OBJET_FLECHE_COURBE, OBJET_FLECHE_DROITE, OBJET_FLECHE_MAIN_LEVEE, OBJET_FLECHE_POINTILLEE } from "../../../../src/briques/motion/petits-objets/fleches";
import { EXEMPLES_SOULIGNEMENTS, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SURLIGNEUR } from "../../../../src/briques/motion/petits-objets/soulignements";
import { EXEMPLES_ENTOURAGES, DEF_CERCLE, DEF_DOUBLE_BOUCLE, DEF_OVALE } from "../../../../src/briques/motion/petits-objets/entourages";
import { EXEMPLES_CADRES, DEF_CADRE_COINS, DEF_CADRE_PASSAGE, DEF_CADRE_RECTANGLE } from "../../../../src/briques/motion/petits-objets/cadres";
import { EXEMPLES_MARQUES, OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE } from "../../../../src/briques/motion/petits-objets/marques";

export type FormatPlanche = "9x16" | "4x5";
export const DIMENSIONS_PLANCHE: Record<FormatPlanche, { largeur: number; hauteur: number }> = {
  "9x16": { largeur: 1080, hauteur: 1920 },
  "4x5": { largeur: 1080, hauteur: 1350 },
};
export const FPS_PLANCHE = 25;
export const DUREE_IMAGES_PLANCHE = 100;
/** Image figée de la planche : trait entièrement tracé. */
export const IMAGE_PLANCHE = 50;

type Point = { x: number; y: number };

export interface EntreePlanche {
  id: string;
  famille: "fleches" | "soulignements" | "marques" | "entourages" | "cadres";
  def: DefinitionObjet<unknown>;
  parametres: unknown;
}

function lister(famille: EntreePlanche["famille"], defs: readonly DefinitionObjet<unknown>[], exemples: readonly unknown[]): EntreePlanche[] {
  return defs.flatMap((def) => exemples.map((parametres, i) => ({ id: `${def.id}#${i + 1}`, famille, def, parametres })));
}

/** Toutes les entrées de la planche, dans l'ordre d'affichage. */
export const ENTREES_PLANCHE: readonly EntreePlanche[] = [
  ...lister("fleches", [OBJET_FLECHE_DROITE, OBJET_FLECHE_COURBE, OBJET_FLECHE_POINTILLEE, OBJET_FLECHE_MAIN_LEVEE] as unknown as DefinitionObjet<unknown>[], EXEMPLES_FLECHES),
  ...lister("soulignements", [OBJET_SOULIGNEMENT_DROIT, OBJET_SOULIGNEMENT_VAGUE, OBJET_SOULIGNEMENT_DOUBLE, OBJET_SURLIGNEUR] as unknown as DefinitionObjet<unknown>[], EXEMPLES_SOULIGNEMENTS),
  ...lister("marques", [OBJET_COCHE, OBJET_CROIX, OBJET_MOT_BARRE] as unknown as DefinitionObjet<unknown>[], EXEMPLES_MARQUES),
  ...lister("entourages", [DEF_CERCLE], EXEMPLES_ENTOURAGES.cercle),
  ...lister("entourages", [DEF_OVALE], EXEMPLES_ENTOURAGES.ovale),
  ...lister("entourages", [DEF_DOUBLE_BOUCLE], EXEMPLES_ENTOURAGES.doubleBoucle),
  ...lister("cadres", [DEF_CADRE_RECTANGLE], EXEMPLES_CADRES.rectangle),
  ...lister("cadres", [DEF_CADRE_COINS], EXEMPLES_CADRES.coins),
  ...lister("cadres", [DEF_CADRE_PASSAGE], EXEMPLES_CADRES.passage),
];

export function seChevauchent(a: ZoneObjet, b: ZoneObjet): boolean {
  return a.x < b.x + b.largeur && b.x < a.x + a.largeur && a.y < b.y + b.hauteur && b.y < a.y + a.hauteur;
}

const englobante = (zs: ZoneObjet[]): ZoneObjet => {
  const x = Math.min(...zs.map((z) => z.x)), y = Math.min(...zs.map((z) => z.y));
  return { x, y, largeur: Math.max(...zs.map((z) => z.x + z.largeur)) - x, hauteur: Math.max(...zs.map((z) => z.y + z.hauteur)) - y };
};

/** Zone occupée par l'objet, en % du cadre (boîte des paramètres ; flèche = boîte de ses deux bouts ; trait = bande fine). */
export function zoneDeLEntree(e: EntreePlanche): ZoneObjet {
  const p = e.parametres as ZoneObjet & { de: Point; vers: Point & ZoneObjet; boite: ZoneObjet };
  if (e.famille === "fleches") return { x: Math.min(p.de.x, p.vers.x), y: Math.min(p.de.y, p.vers.y), largeur: Math.abs(p.vers.x - p.de.x), hauteur: Math.abs(p.vers.y - p.de.y) };
  if (e.famille === "marques") return p.boite;
  if (e.famille === "soulignements") return { x: p.x, y: p.y - 2, largeur: p.largeur, hauteur: 4 };
  if (p.vers) return englobante([p, p.vers]);
  return p;
}

/** Silhouette témoin neutre : tête et épaules dessinées, calées sur la zone du visage. */
function Silhouette({ fond }: { fond: FondAxion }): JSX.Element {
  const c = couleursSur(fond).texteDoux;
  const z = ZONE_VISAGE_OBJETS;
  const cx = z.x + z.largeur / 2;
  return (
    <svg data-silhouette-temoin="oui" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <ellipse cx={cx} cy={z.y + z.hauteur / 2} rx={z.largeur * 0.36} ry={z.hauteur * 0.5} fill={c} opacity={0.35} />
      <path d={`M ${cx - 38} 100 Q ${cx - 38} ${z.y + z.hauteur + 6} ${cx} ${z.y + z.hauteur + 6} Q ${cx + 38} ${z.y + z.hauteur + 6} ${cx + 38} 100 Z`} fill={c} opacity={0.25} />
      <rect x={z.x} y={z.y} width={z.largeur} height={z.hauteur} fill="none" stroke={c} strokeWidth={0.3} strokeDasharray="1.5 1.5" />
    </svg>
  );
}

/** Plus petite grille de cases carrées qui tient dans le format. */
export function colonnesPlanche(n: number, largeur: number, hauteur: number): number {
  for (let c = 1; c <= n; c++) if (Math.ceil(n / c) * (largeur / c) <= hauteur) return c;
  return n;
}

export function PlancheTraits({ fond, format, image = IMAGE_PLANCHE }: { fond: FondAxion; format: FormatPlanche; image?: number }): JSX.Element {
  const { largeur, hauteur } = DIMENSIONS_PLANCHE[format];
  const cols = colonnesPlanche(ENTREES_PLANCHE.length, largeur, hauteur);
  const cote = largeur / cols;
  const pal = couleursSur(fond);
  return (
    <div data-planche={`traits-${format}-${fond}`} style={{ position: "relative", width: largeur, height: hauteur, background: pal.fond, display: "flex", flexWrap: "wrap", alignContent: "flex-start", overflow: "hidden", fontFamily: FAMILLE_CSS_AXION }}>
      {ENTREES_PLANCHE.map((e) => {
        const touche = seChevauchent(zoneDeLEntree(e), ZONE_VISAGE_OBJETS);
        return (
          <div key={e.id} data-objet={e.id} style={{ position: "relative", width: cote, height: cote, boxSizing: "border-box", border: `1px solid ${pal.texteDoux}` }}>
            <Silhouette fond={fond} />
            <div style={{ position: "absolute", inset: 0 }}>
              {e.def.Rendu({ image, fps: FPS_PLANCHE, dureeImages: DUREE_IMAGES_PLANCHE, fond, graine: 7, parametres: e.parametres })}
            </div>
            <span data-chevauche-visage={touche ? "oui" : "non"} style={{ position: "absolute", left: 4, top: 2, fontSize: Math.max(8, cote / 16), color: touche ? "#C0392B" : pal.texte }}>
              {e.id.replace("objet-", "")}{touche ? " · touche le visage" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
