/**
 * CALAGE DES MODÈLES 7 À 13 SUR LA PAROLE (brique `motion`, lot F2) : mêmes règles que `calage.ts` (chaque élément
 * apparaît quand la voix le dit ; instants croissants, 0,35 s d'écart au moins, chute finale libre). Les 6 premiers
 * modèles passent par `calerCarte`, inchangé. PUR, sans alias « @/ ».
 */
import { calerCarte, horairesParDefaut, instantDit, type MotCalage } from "./calage";
import type { CarteModele } from "./types";
import type { CarteModeleEtendu, CarteMotionTous } from "./types-etendus";
import { IDS_MODELES_MOTION_ETENDUS } from "./catalogue-etendu";

/** Instants des éléments d'une suite (retrouvés dans la parole, sinon répartis), croissants et bornés. */
function suite(textes: string[], existants: (number | undefined)[], mots: MotCalage[], debutCarteSec: number, dureeSec: number, avecTitre: boolean): number[] {
  const fin = Math.max(0.5, dureeSec - 1.4);
  const defaut = horairesParDefaut(textes.length, dureeSec, avecTitre);
  let dernier = avecTitre ? 0.45 : -0.35;
  return textes.map((tx, i) => {
    const v = existants[i] ?? instantDit(tx, mots, debutCarteSec, Math.max(0, dernier)) ?? defaut[i];
    const borne = Math.min(fin, Math.max(dernier + 0.35, v));
    dernier = borne;
    return +borne.toFixed(3);
  });
}

/** Cale une carte des modèles 7 à 13 sur la parole. */
export function calerCarteEtendue(carte: CarteModeleEtendu, mots: MotCalage[], debutCarteSec: number, dureeSec: number): CarteModeleEtendu {
  const fin = Math.max(0.5, dureeSec - 1.4);
  switch (carte.modele) {
    case "graphique": {
      const d = carte.donnees;
      const a = suite(
        d.series.map((s) => `${s.libelle} ${s.valeur}`),
        d.series.map((s) => s.aSec),
        mots,
        debutCarteSec,
        dureeSec,
        true,
      );
      return { modele: "graphique", donnees: { ...d, series: d.series.map((s, i) => ({ ...s, aSec: a[i] })) } };
    }
    case "check-list": {
      const d = carte.donnees;
      const a = suite(
        d.elements.map((e) => e.texte),
        d.elements.map((e) => e.aSec),
        mots,
        debutCarteSec,
        dureeSec,
        !!d.titre,
      );
      return { modele: "check-list", donnees: { ...d, elements: d.elements.map((e, i) => ({ ...e, aSec: a[i] })) } };
    }
    case "capture-annotee": {
      const d = carte.donnees;
      const a = suite(
        d.annotations.map((x) => x.texte ?? ""),
        d.annotations.map((x) => x.aSec),
        mots,
        debutCarteSec,
        dureeSec,
        true,
      );
      return { modele: "capture-annotee", donnees: { ...d, annotations: d.annotations.map((x, i) => ({ ...x, aSec: a[i] })) } };
    }
    case "probleme-solution": {
      const d = carte.donnees;
      const v = d.aSecSolution ?? instantDit(`solution ${d.solution.titre}`, mots, debutCarteSec, 0.9) ?? Math.min(1.9, dureeSec * 0.4);
      return { modele: "probleme-solution", donnees: { ...d, aSecSolution: Math.min(fin, Math.max(1.2, v)) } };
    }
    case "icone-mot": {
      const d = carte.donnees;
      const v = d.aSec ?? instantDit(d.mot, mots, debutCarteSec) ?? 0.45;
      return { modele: "icone-mot", donnees: { ...d, aSec: Math.min(fin, v) } };
    }
    case "documentaire": {
      const d = carte.donnees;
      const v = d.aSec ?? instantDit(d.lieu ?? d.date ?? "", mots, debutCarteSec) ?? 0.4;
      return { modele: "documentaire", donnees: { ...d, aSec: Math.min(fin, Math.min(1.2, v)) } };
    }
    default:
      return carte;
  }
}

/** Cale une carte de l'un des 13 modèles (les 6 premiers par `calerCarte`, inchangé). */
export function calerCarteTous(carte: CarteMotionTous, mots: MotCalage[], debutCarteSec: number, dureeSec: number): CarteMotionTous {
  if ((IDS_MODELES_MOTION_ETENDUS as string[]).includes(carte.modele)) return calerCarteEtendue(carte as CarteModeleEtendu, mots, debutCarteSec, dureeSec);
  return calerCarte(carte as CarteModele, mots, debutCarteSec, dureeSec);
}
