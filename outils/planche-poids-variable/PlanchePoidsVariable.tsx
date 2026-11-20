/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * PLANCHE D'ATTENTE (BR-POIDS-PLANCHE-v19c) : le mot qui s'épaissit, à 7, 4 et 2 graisses côte à côte, avec le nombre
 * d'images en plus. Pur (aucun hook, aucune horloge, aucun hasard). Imports relatifs seulement. Rien n'est branché
 * (BR-POIDS-VARIABLE-IV-b) : aucun fichier de la vidéo n'importe celui-ci.
 */
import type { JSX } from "react";
import { couleursSur, type FondAxion } from "../../src/briques/jetons-motion";
import { GRAISSE_MIN, graisseAuTemps, largeurReservee } from "../../src/briques/sous-titres/poids-variable";

export interface MotPoids {
  mot: string;
  debut: number;
  fin: number;
}
export type PhrasePoids = readonly MotPoids[];

/** Mots contigus : chacun commence quand le précédent finit. */
const phrase = (...mots: [string, number][]): PhrasePoids => {
  let t = 0;
  return mots.map(([mot, duree]) => {
    const m = { mot, debut: Math.round(t * 1000) / 1000, fin: Math.round((t + duree) * 1000) / 1000 };
    t += duree;
    return m;
  });
};

export const PHRASES_POIDS: readonly PhrasePoids[] = [
  phrase(["Ce", 0.2], ["contrat", 0.55], ["est", 0.22], ["vraiment", 0.6], ["illégal", 0.7]),
  phrase(["Tu", 0.2], ["n'as", 0.28], ["jamais", 0.6], ["payé", 0.45], ["ça", 0.26]),
  phrase(["Ton", 0.26], ["droit", 0.55], ["reste", 0.4], ["gratuit", 0.6], ["ici", 0.28]),
];

export const PAS_GRAISSE = [50, 100, 300] as const;
export type PasGraisse = (typeof PAS_GRAISSE)[number];
const LIBELLES: Record<PasGraisse, string> = { 50: "7 graisses (aujourd'hui)", 100: "4 graisses", 300: "2 graisses" };

/** Même arrondi que `graisseAuPalier` de BR-POIDS-PALIERS-v19c, recopié pour la planche. */
export function graisseArrondie(t: number, debut: number, fin: number, pas: number): number {
  return GRAISSE_MIN + pas * Math.round((graisseAuTemps(t, debut, fin) - GRAISSE_MIN) / pas);
}

/** Six instants relatifs au mot : 0,1 s avant, début, 1/3, 2/3, fin − 0,001 s, 0,1 s après. */
export const INSTANTS_MOT: readonly ((debut: number, fin: number) => number)[] = [
  (d) => d - 0.1,
  (d) => d,
  (d, f) => d + (f - d) / 3,
  (d, f) => d + (2 * (f - d)) / 3,
  (_d, f) => f - 0.001,
  (_d, f) => f + 0.1,
];
const NOMS_INSTANTS = ["0,1 s avant", "début", "1/3", "2/3", "fin", "0,1 s après"];

/** Images en plus : changements de graisse arrondie d'une image à la suivante, de chaque mot, à `fps` images/s. */
export function imagesEnPlus(phrases: readonly PhrasePoids[], pas: number, fps = 25): number {
  let somme = 0;
  for (const p of phrases) {
    for (const m of p) {
      const premiere = Math.floor(m.debut * fps);
      const derniere = Math.ceil(m.fin * fps);
      let prec = graisseArrondie(premiere / fps, m.debut, m.fin, pas);
      for (let f = premiere + 1; f <= derniere; f++) {
        const g = graisseArrondie(f / fps, m.debut, m.fin, pas);
        if (g !== prec) somme += 1;
        prec = g;
      }
    }
  }
  return somme;
}

const TAILLE = 48;

export function PlanchePoidsVariable({ fond, famille }: { fond: FondAxion; famille: string }): JSX.Element {
  const pal = couleursSur(fond);
  return (
    <div data-planche={`poids-variable-${fond}`} style={{ background: pal.fond, color: pal.texte, fontFamily: famille, padding: 24, width: 3300 }}>
      <div style={{ fontSize: 26, color: pal.texteDoux, paddingBottom: 16 }}>{"Planche d'attente : rien n'est branché (BR-POIDS-VARIABLE-IV-b)"}</div>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {PAS_GRAISSE.map((pas) => (
          <div key={pas} data-colonne={pas} style={{ flex: 1, borderLeft: `1px solid ${pal.filet}`, paddingLeft: 16 }}>
            <div style={{ fontSize: 26, color: pal.accent, paddingBottom: 8 }}>{LIBELLES[pas]}</div>
            {PHRASES_POIDS.map((p, g) =>
              INSTANTS_MOT.map((instantDe, i) => (
                <div key={`${g}-${i}`} style={{ display: "flex", alignItems: "baseline", gap: 14, padding: "2px 0", borderBottom: `1px solid ${pal.filet}` }}>
                  <span style={{ width: 90, fontSize: 16, color: pal.texteDoux }}>{NOMS_INSTANTS[i]}</span>
                  {p.map((m, j) => (
                    <span
                      key={j}
                      data-mot={`${g}-${pas}-${i}-${j}`}
                      style={{
                        display: "inline-block",
                        width: largeurReservee(m.mot, TAILLE),
                        fontFamily: famille,
                        fontSize: TAILLE,
                        fontWeight: graisseArrondie(instantDe(m.debut, m.fin), m.debut, m.fin, pas),
                      }}
                    >
                      {m.mot}
                    </span>
                  ))}
                </div>
              )),
            )}
            <div data-surcout={pas} style={{ fontSize: 30, paddingTop: 12, color: pal.texte }}>
              {`${imagesEnPlus(PHRASES_POIDS, pas)} images en plus`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
