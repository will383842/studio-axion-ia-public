/**
 * PLANCHE (C11-T6b-p, C11-T6b-c) : « Étape N » qui monte à trois instants, avec prise floutée sous l'étape (décor de démonstration,
 * aucune photo de personne), et pastille de contexte (sans fond).
 * Pur (aucun hook, aucune horloge, aucun hasard). Outil local : aucun générateur n'importe ce fichier ; rien n'est allumé.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { fondFlouSousEtape } from "../../src/briques/motion/titres-couverture/fond-etape";
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
const FENETRE_FOND = fondFlouSousEtape(0)[0];

/**
 * Décor de démonstration (aplat + formes de la charte) traité comme `ImageComposee` traite `fondFlouCartes` : flou et voile
 * sur ce seul calque, fondu linéaire aux bords de la fenêtre. Le flou passe par un filtre SVG (feGaussianBlur).
 */
function DecorFloute({ id, image, largeur, pal }: { id: string; image: number; largeur: number; pal: ReturnType<typeof couleursSur> }): JSX.Element {
  const t = image / IPS_PLANCHE;
  const f = FENETRE_FOND;
  const dedans = t >= f.debutSec && t < f.finSec;
  const fondu = dedans ? (f.fonduSec > 0 ? Math.max(0, Math.min(1, (t - f.debutSec) / f.fonduSec, (f.finSec - t) / f.fonduSec)) : 1) : 0;
  const flou = f.flouPx * fondu * (largeur / 1080);
  const voile = f.assombrir * fondu;
  const fid = `flou-${id}`;
  return (
    <div data-decor="floute" aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top: 0 }}>
        <defs>
          <filter id={fid} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={flou / 10} />
          </filter>
        </defs>
        <g filter={flou > 0 ? `url(#${fid})` : undefined}>
          <rect x="0" y="0" width="100" height="100" fill={pal.panneauRelief} />
          <rect x="8" y="55" width="50" height="35" fill={pal.texteDoux} opacity="0.6" />
          <circle cx="75" cy="30" r="16" fill={pal.texte} opacity="0.5" />
          <rect x="60" y="62" width="30" height="26" fill={pal.texteDoux} opacity="0.4" />
        </g>
      </svg>
      {voile > 0 ? <div style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, background: pal.texte, opacity: voile }} /> : null}
    </div>
  );
}

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
        {`Titres de couverture ${ratio} · ${fond} · avec prise floutée (C11-T6b-c)`}
      </div>
      <div style={{ position: "absolute", left: MARGE, top: LEGENDE, right: MARGE, display: "flex", flexWrap: "wrap", gap: MARGE, alignContent: "flex-start" }}>
        {CASES_PLANCHE.map((c) => (
          <div key={c} data-case={c} style={{ position: "relative", width: w, height: h, background: pal.panneauRelief, border: `1px solid ${pal.texteDoux}`, overflow: "hidden", boxSizing: "border-box" }}>
            {c === "pastille" ? (
              <PastilleContexte texte={TEXTE_PASTILLE} ratio={ratio} couleurTexte={pal.fond} couleurFond={pal.texte} />
            ) : (
              <>
                <DecorFloute id={`${ratio}-${fond}-${c}`} image={IMAGES_PLANCHE[c]} largeur={w} pal={pal} />
                <EtapeMontante numero={NUMERO} libelle={LIBELLE} debutImage={0} ips={IPS_PLANCHE} image={IMAGES_PLANCHE[c]} couleurTexte={pal.fond} couleurFond={pal.texte} />
              </>
            )}
            <span style={{ position: "absolute", left: 6, bottom: 4, fontSize: Math.max(12, w / 30), color: pal.texteDoux }}>{nom[c]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
