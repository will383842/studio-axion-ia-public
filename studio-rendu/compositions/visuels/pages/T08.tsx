import { BORDURE_CARTE, COULEURS, MARGE, OMBRE_DECALAGE, POLICE_CORPS, TAILLES } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { largeurTexteMax } from "../commun/zones";
import { TEXTES_FIXES } from "../../../../src/briques/visuels/textes-fixes";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  avant: string;
  apres: string;
  index: number;
  total: number;
}

/** Pictogramme sans texte : trois formes en désordre (avant) ou alignées (après). */
function Pictogramme({ range }: { range: boolean }) {
  const forme = { fill: range ? COULEURS.creme : COULEURS.orange, stroke: COULEURS.encre, strokeWidth: 6, strokeLinejoin: "round" as const };
  return (
    <svg width={230} height={230} viewBox="0 0 230 230" role="img" aria-hidden>
      {range ? (
        <>
          <circle cx="48" cy="115" r="34" {...forme} />
          <rect x="94" y="81" width="68" height="68" rx="8" {...forme} />
          <path d="M178 149 H224 L201 81 Z" {...forme} />
        </>
      ) : (
        <>
          <circle cx="62" cy="52" r="34" {...forme} />
          <rect x="120" y="76" width="68" height="68" rx="8" {...forme} transform="rotate(24 154 110)" />
          <path d="M40 206 H108 L74 140 Z" {...forme} transform="rotate(-18 74 176)" />
        </>
      )}
    </svg>
  );
}

const REMPLISSAGE = 36;
/** Abscisse du début du texte d'un panneau : marge, bordure, remplissage. */
const X_TEXTE = MARGE + BORDURE_CARTE + REMPLISSAGE;

function Panneau({ etiquette, texte, fond, range }: { etiquette: string; texte: string; fond: string; range: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 28,
        padding: `20px ${REMPLISSAGE}px 60px`,
        borderRadius: 32,
        background: fond,
        border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, maxWidth: largeurTexteMax(X_TEXTE) }}>
        <div style={{ padding: "10px 28px", borderRadius: 999, background: COULEURS.encre, color: COULEURS.creme, fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: TAILLES.badge, lineHeight: 1.25 }}>{etiquette}</div>
        <div style={{ fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: TAILLES.panneau, lineHeight: 1.3, color: COULEURS.encre }}>{texte}</div>
      </div>
      <div style={{ flexShrink: 0, alignSelf: "center" }}>
        <Pictogramme range={range} />
      </div>
    </div>
  );
}

/** T08 — avant / après : deux panneaux (avant sur fond pâle, après sur l'orange) reliés par une flèche vers le bas. Étiquettes génériques posées par le code. */
export function T08({ titre, avant, apres, index, total }: Proprietes) {
  chargerPoliceInter();
  return (
    <PageBase titre={titre} index={index} total={total} type="T08">
      {/* Même bord droit que les cartes des autres pages (elles réservent la marge de leur ombre). */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingRight: OMBRE_DECALAGE }}>
        <Panneau etiquette={TEXTES_FIXES.t08Avant} texte={avant} fond={COULEURS.pale} range={false} />
        <div style={{ flex: "none", height: 84, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <svg width={64} height={64} viewBox="0 0 64 64" role="img" aria-hidden>
            <path d="M32 6 V54 M12 36 L32 56 L52 36" fill="none" stroke={COULEURS.encre} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <Panneau etiquette={TEXTES_FIXES.t08Apres} texte={apres} fond={COULEURS.orange} range />
      </div>
    </PageBase>
  );
}
