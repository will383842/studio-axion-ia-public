/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * PLANCHE D'ATTENTE (C11-T7-PLANCHE-v19c) : le « mode carte » (un groupe de sous-titres devient une carte plein cadre),
 * dessiné en réduction à partir de la géométrie pure, en 9:16 et 4:5, à quatre instants. Pur (aucun hook, aucune
 * horloge, aucun hasard). Imports relatifs seulement. Rien n'est branché : aucun fichier de la vidéo n'importe celui-ci.
 */
import type { JSX } from "react";
import { FAMILLE_CSS_AXION } from "../../src/briques/jetons-motion";
import { geometrieCarteGroupe, type FondCarte } from "../../src/briques/sous-titres/mode-carte";

export interface GroupeCarte {
  mots: string[];
  debutSec: number;
  finSec: number;
}
export interface FormatCarte {
  nom: string;
  largeur: number;
  hauteur: number;
}

const mots = (texte: string) => texte.split(" ");
export const GROUPES_CARTE: readonly GroupeCarte[] = [
  { mots: mots("Gratuit"), debutSec: 0, finSec: 1.6 },
  { mots: mots("Ton droit reste gratuit"), debutSec: 0, finSec: 1.6 },
  { mots: mots("Ce contrat que tu as signé n'est pas valable"), debutSec: 0, finSec: 1.6 },
];
export const FORMATS_CARTE = [
  { nom: "9:16", largeur: 1080, hauteur: 1920 },
  { nom: "4:5", largeur: 1080, hauteur: 1350 },
] as const;
export const INSTANTS_CARTE = [0, 0.1, 0.8, 1.6];
export const ECHELLE_PLANCHE = 0.25;
const FONDS: readonly FondCarte[] = ["ivoire", "noir", "terracotta"];

/** Une vignette : la carte à l'instant `instant`, ou vide si la géométrie est `null`. */
export function VignetteCarte({
  fond,
  format,
  groupe,
  indexGroupe,
  instant,
}: {
  fond: FondCarte;
  format: FormatCarte;
  groupe: GroupeCarte;
  indexGroupe: number;
  instant: number;
}): JSX.Element {
  const g = geometrieCarteGroupe({ mots: groupe.mots.map((mot) => ({ mot })), debutSec: groupe.debutSec, finSec: groupe.finSec, fond }, format.largeur, format.hauteur, instant);
  const cle = `${fond}-${format.nom}-${indexGroupe}-${instant}`;
  const taille = { width: format.largeur * ECHELLE_PLANCHE, height: format.hauteur * ECHELLE_PLANCHE };
  return (
    <figure style={{ margin: 0 }}>
      {g ? (
        <div
          data-carte={cle}
          style={{
            ...taille,
            background: g.couleurs.fond,
            color: g.couleurs.texte,
            opacity: g.opacite,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            overflow: "hidden",
            fontFamily: FAMILLE_CSS_AXION,
            fontWeight: 800,
            fontSize: g.taillePolice * ECHELLE_PLANCHE,
            lineHeight: g.interligne,
          }}
        >
          {g.lignes.map((l, i) => (
            <div key={i} data-ligne={i}>
              {l}
            </div>
          ))}
        </div>
      ) : (
        <div data-carte={cle} data-vide="1" style={{ ...taille, outline: "1px dashed currentColor" }} />
      )}
      <figcaption style={{ fontSize: 13 }}>{g ? `opacité ${g.opacite.toFixed(2).replace(".", ",")}` : "hors durée"}</figcaption>
    </figure>
  );
}

export function PlancheModeCarte(): JSX.Element {
  return (
    <div style={{ fontFamily: FAMILLE_CSS_AXION, padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>{"Planche d'attente C11-T7 : rien n'est branché ; jamais sur un plan où l'on voit la personne"}</h1>
      {FONDS.map((fond) =>
        FORMATS_CARTE.map((format) =>
          GROUPES_CARTE.map((groupe, i) => (
            <div key={`${fond}-${format.nom}-${i}`} style={{ display: "flex", gap: 12, margin: "8px 0" }}>
              {INSTANTS_CARTE.map((t) => (
                <VignetteCarte key={t} fond={fond} format={format} groupe={groupe} indexGroupe={i} instant={t} />
              ))}
            </div>
          )),
        ),
      )}
    </div>
  );
}
