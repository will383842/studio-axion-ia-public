/**
 * PLANCHE D'ATTENTE (C11-T6b-p) : « Étape N » qui monte à trois instants et pastille de contexte, sans prise floutée.
 * Pur (aucun hook, aucune horloge, aucun hasard). Outil local : aucun générateur n'importe ce fichier ; rien n'est allumé.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { ENTREE_S, RATIOS_COUVERTURE, SORTIE_S, TENUE_S, type RatioCouverture } from "../../src/briques/motion/titres-couverture/etapes";
import { EtapeMontante } from "../../studio-rendu/compositions/commune/titres-couverture/EtapeMontante";
import { PastilleContexte } from "../../studio-rendu/compositions/commune/titres-couverture/PastilleContexte";

export const RATIOS_PLANCHE = RATIOS_COUVERTURE;
export const CASES_PLANCHE = ["etape-entree", "etape-tenue", "etape-sortie", "pastille"] as const;
export type CasePlanche = (typeof CASES_PLANCHE)[number];

export const IPS_PLANCHE = 30;
const nEntree = Math.round(ENTREE_S * IPS_PLANCHE);
const nTenue = Math.round(TENUE_S * IPS_PLANCHE);
const nSortie = Math.round(SORTIE_S * IPS_PLANCHE);
/** Début de l'étape à l'image 0 ; instants : milieu de l'entrée, milieu de la tenue, milieu de la sortie. */
export const IMAGES_PLANCHE: Record<Exclude<CasePlanche, "pastille">, number> = {
  "etape-entree": Math.round(nEntree / 2),
  "etape-tenue": nEntree + Math.round(nTenue / 2),
  "etape-sortie": nEntree + nTenue + Math.round(nSortie / 2),
};

const PROPORTION: Record<RatioCouverture, number> = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1, "16:9": 16 / 9 };
export const DIMENSIONS_PLANCHE: Record<RatioCouverture, { largeur: number; hauteur: number }> = {
  "9:16": { largeur: 1080, hauteur: 1920 },
  "4:5": { largeur: 1080, hauteur: 1350 },
  "1:1": { largeur: 1080, hauteur: 1080 },
  "16:9": { largeur: 1920, hauteur: 1080 },
};
const NUMERO = 3;
const LIBELLE = "Le bon réflexe";
const TEXTE_PASTILLE = "Cas concret";
const MARGE = 20;
const LEGENDE = 56;

export function PlancheTitresCouverture({ ratio, fond }: { ratio: RatioCouverture; fond: FondAxion }): JSX.Element {
  const { largeur, hauteur } = DIMENSIONS_PLANCHE[ratio];
  const pal = couleursSur(fond);
  const hMax = (hauteur - LEGENDE - 3 * MARGE) / 2;
  const wMax = (largeur - 3 * MARGE) / 2;
  const w = Math.min(wMax, hMax * PROPORTION[ratio]);
  const h = w / PROPORTION[ratio];
  const nom: Record<CasePlanche, string> = {
    "etape-entree": "entrée",
    "etape-tenue": "tenue",
    "etape-sortie": "sortie",
    pastille: "pastille",
  };
  return (
    <div data-planche={`titres-couverture-${ratio}-${fond}`} style={{ position: "relative", width: largeur, height: hauteur, background: pal.fond, overflow: "hidden", fontFamily: FAMILLE_CSS_AXION }}>
      <div style={{ position: "absolute", left: MARGE, top: MARGE / 2, fontSize: 28, color: pal.texte }}>
        {`Titres de couverture ${ratio} · ${fond} · sans prise floutée (C11-T6b-c)`}
      </div>
      <div style={{ position: "absolute", left: MARGE, top: LEGENDE, right: MARGE, display: "flex", flexWrap: "wrap", gap: MARGE, alignContent: "flex-start" }}>
        {CASES_PLANCHE.map((c) => (
          <div key={c} data-case={c} style={{ position: "relative", width: w, height: h, background: pal.panneauRelief, border: `1px solid ${pal.texteDoux}`, overflow: "hidden", boxSizing: "border-box" }}>
            {c === "pastille" ? (
              <PastilleContexte texte={TEXTE_PASTILLE} ratio={ratio} couleurTexte={pal.fond} couleurFond={pal.texte} />
            ) : (
              <EtapeMontante numero={NUMERO} libelle={LIBELLE} debutImage={0} ips={IPS_PLANCHE} image={IMAGES_PLANCHE[c]} couleurTexte={pal.fond} couleurFond={pal.texte} />
            )}
            <span style={{ position: "absolute", left: 6, bottom: 4, fontSize: Math.max(12, w / 30), color: pal.texteDoux }}>{nom[c]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
