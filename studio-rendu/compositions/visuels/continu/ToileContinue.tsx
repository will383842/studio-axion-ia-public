/**
 * La toile continue : UNE image de N × 1080 px (hauteur 1350 en 4:5, 1440 en 3:4), découpée ensuite en N pages par l'opération `toile-continue`.
 * Ordre des calques : fond (crème, pages sombres, halos) → calque du parcours (`left = debut × 1080`, + 45 px en 3:4) → chaque plaquette hors
 * parcours dans son cadre 1080 × hauteur → raccords centrés sur leur couture (`[data-a-cheval]`) → grain → en-tête et pied de chaque page.
 * Aucune plaquette ne dessine son en-tête ni son pied.
 */
import { GABARITS } from "../../../../src/briques/visuels/continu/registre-gabarits";
import { PARCOURS } from "../../../../src/briques/visuels/continu/registre-parcours";
import { RACCORDS } from "../../../../src/briques/visuels/continu/registre-raccords";
import type { VersionsToile } from "../../../../src/domaine/visuels/continu/proprietes-toile";
import type { ToileSpecType } from "../../../../src/domaine/visuels/continu/schema-toile";
import { Entete } from "./commun/Entete";
import { Fond, Grain, type Halo } from "./commun/Fond";
import { Pied } from "./commun/Pied";
import { DECALAGE_PARCOURS_34, HAUTEURS, LARGEUR_PAGE } from "./constantes-continu";
import { COMPOSANTS_PARCOURS, COMPOSANTS_PLAQUETTES, COMPOSANTS_RACCORDS } from "./registre-composants";

export type ProprietesToile = {
  toile: ToileSpecType;
  versions: VersionsToile;
};

/** Parcours de la toile (au plus un, contigu : garanti par le schéma) et sa première page, ou `null`. PUR. */
export function parcoursDe(toile: ToileSpecType): { id: string; debut: number; longueur: number; sombres: readonly number[] } | null {
  for (const p of PARCOURS) {
    const debut = toile.pages.findIndex((page) => page.type === p.pagesTypes[0]);
    if (debut >= 0) return { id: p.id, debut, longueur: p.pagesTypes.length, sombres: p.sombres };
  }
  return null;
}

/** Index des pages à fond sombre (gabarit `sombre`, ou position sombre du parcours). PUR. */
export function pagesSombres(toile: ToileSpecType): number[] {
  const pa = parcoursDe(toile);
  return toile.pages.flatMap((page, i) => {
    if (pa && i >= pa.debut && i < pa.debut + pa.longueur) return pa.sombres.includes(i - pa.debut) ? [i] : [];
    return GABARITS.find((g) => g.type === page.type)?.sombre ? [i] : [];
  });
}

/** Halos de la maquette (`.pg .glow`), en coordonnées de la toile : ils passent les coutures sans bord. PUR. */
export function halosDe(n: number, hauteur: number): Halo[] {
  return Array.from({ length: n }, (_, i) => [
    { x: i * LARGEUR_PAGE + Math.round(LARGEUR_PAGE * 1.05), y: Math.round(hauteur * 0.08), r: 900, a: 0.18 },
    { x: i * LARGEUR_PAGE - Math.round(LARGEUR_PAGE * 0.1), y: hauteur, r: 700, a: 0.12 },
  ]).flat();
}

export function ToileContinue({ toile }: ProprietesToile) {
  const n = toile.pages.length;
  const hauteur = HAUTEURS[toile.format];
  const pa = parcoursDe(toile);
  const sombres = pagesSombres(toile);
  const Parcours = pa ? COMPOSANTS_PARCOURS[pa.id] : undefined;
  if (pa && !Parcours) throw new Error(`Parcours sans composant : ${pa.id}`);
  const dansParcours = (i: number) => !!pa && i >= pa.debut && i < pa.debut + pa.longueur;
  return (
    <div style={{ position: "relative", width: n * LARGEUR_PAGE, height: hauteur, overflow: "hidden" }}>
      <Fond pages={n} hauteur={hauteur} sombres={sombres} halos={halosDe(n, hauteur)} />
      {pa && Parcours ? (
        <div data-parcours={pa.id} style={{ position: "absolute", left: pa.debut * LARGEUR_PAGE, top: toile.format === "3:4" ? DECALAGE_PARCOURS_34 : 0, width: pa.longueur * LARGEUR_PAGE, height: HAUTEURS["4:5"] }}>
          <Parcours pages={toile.pages.slice(pa.debut, pa.debut + pa.longueur)} debut={pa.debut} total={n} sombres={pa.sombres} />
        </div>
      ) : null}
      {toile.pages.map((page, i) => {
        if (dansParcours(i)) return null;
        const Plaquette = COMPOSANTS_PLAQUETTES[page.type];
        if (!Plaquette) throw new Error(`Plaquette sans composant : ${page.type}`);
        return (
          <div key={i} data-page={i} style={{ position: "absolute", left: i * LARGEUR_PAGE, top: 0, width: LARGEUR_PAGE, height: hauteur }}>
            <Plaquette page={page} index={i} total={n} hauteur={hauteur} sombre={sombres.includes(i)} />
          </div>
        );
      })}
      {toile.raccords.map((r) => {
        const Raccord = COMPOSANTS_RACCORDS[r.type];
        const d = RACCORDS.find((x) => x.type === r.type)?.diametre;
        if (!Raccord || !d) throw new Error(`Raccord sans composant : ${r.type}`);
        return (
          <div key={r.couture} data-a-cheval={r.type} style={{ position: "absolute", left: r.couture * LARGEUR_PAGE - d / 2, top: r.y - d / 2, width: d, height: d, zIndex: 5 }}>
            <Raccord diametre={d} />
          </div>
        );
      })}
      <Grain pages={n} hauteur={hauteur} sombres={sombres} />
      {toile.pages.map((page, i) => (
        <Entete key={`e${i}`} index={i} rubrique={page.rubrique} sombre={sombres.includes(i)} />
      ))}
      {toile.pages.map((_, i) => (
        <Pied key={`p${i}`} index={i} total={n} sombre={sombres.includes(i)} />
      ))}
    </div>
  );
}
