/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * PLANCHE D'ATTENTE (C10-07-PLANCHE-v19c) : pour chaque couleur de la charte en fond, la même phrase en ivoire, en noir
 * et en blanc, avec le contour proposé par `contourPourFond`, le contraste mesuré et la réserve. Pur (aucun hook, aucune
 * horloge, aucun hasard). Imports relatifs seulement. Rien n'est branché : aucun fichier de la vidéo n'importe celui-ci.
 */
import type { JSX } from "react";
import { PALETTE } from "../../src/briques/charte/axion-2026";
import { FAMILLE_CSS_AXION } from "../../src/briques/jetons-motion";
import { contourPourFond, type ResultatContour } from "../../src/briques/sous-titres/fond-clair";

export const TEXTES_PLANCHE = ["ivoire", "noir", "blanc"] as const;
export const PHRASE_PLANCHE = "Ton droit reste gratuit";

type NomCouleur = keyof typeof PALETTE;
export interface CaseFondClair {
  fond: NomCouleur;
  texte: (typeof TEXTES_PLANCHE)[number];
  resultat: ResultatContour;
}

export function casesFondClair(): CaseFondClair[] {
  const cases: CaseFondClair[] = [];
  for (const fond of Object.keys(PALETTE) as NomCouleur[]) {
    for (const texte of TEXTES_PLANCHE) {
      cases.push({ fond, texte, resultat: contourPourFond(PALETTE[fond], PALETTE[texte]) });
    }
  }
  return cases;
}

const virgule = (n: number): string => n.toFixed(2).replace(".", ",");
const nomContour = (c: string | null): string => (c === null ? "aucun" : c === PALETTE.noir ? "noir" : c);

export function PlancheFondClair(): JSX.Element {
  return (
    <div style={{ fontFamily: FAMILLE_CSS_AXION, padding: 24, background: PALETTE.gris, color: PALETTE.noir }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 16px" }}>Planche d&apos;attente C10-07 : rien n&apos;est branché</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {casesFondClair().map(({ fond, texte, resultat }) => (
          <div
            key={`${fond}-${texte}`}
            data-fond={fond}
            data-texte={texte}
            data-reserve={resultat.reserve}
            data-contour={resultat.contour !== null ? "oui" : "non"}
            style={{ width: 340, padding: 16, background: PALETTE[fond], boxSizing: "border-box" }}
          >
            <div
              style={{
                fontFamily: FAMILLE_CSS_AXION,
                fontWeight: 800,
                fontSize: 36,
                color: PALETTE[texte],
                ...(resultat.contour !== null
                  ? { WebkitTextStroke: `2px ${resultat.contour}`, paintOrder: "stroke fill" }
                  : {}),
              }}
            >
              {PHRASE_PLANCHE}
            </div>
            <div style={{ fontSize: 13, marginTop: 8, color: PALETTE[texte] }}>
              {`${fond} / ${texte} : contraste ${virgule(resultat.contraste)} ; contour : ${nomContour(resultat.contour)} ; réserve : ${resultat.reserve === "aucune" ? "aucune" : "contraste faible"}`}
            </div>
            <span data-cellule-fin="" />
          </div>
        ))}
      </div>
    </div>
  );
}
