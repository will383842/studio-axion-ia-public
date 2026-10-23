import { BORDURE_CARTE, COULEURS, MARGE, OMBRE_DECALAGE, POLICE_CORPS, POLICE_TITRE, TAILLES } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { styleCarte } from "../commun/style-carte";
import type { EtapeSpec } from "../commun/types";
import { W01 } from "../mini/W01";
import { chargerPoliceArchivoBlack, chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  etapes: EtapeSpec[];
  index: number;
  total: number;
}

const ECART = 20;
const PASTILLE = 100;
const ECART_PASTILLE = 24;
const REMPLISSAGE = 28;
/** Abscisse du début du texte d'une étape : marge, pastille, espace, bordure, remplissage. */
const X_TEXTE = MARGE + PASTILLE + ECART_PASTILLE + BORDURE_CARTE + REMPLISSAGE;

/** T20 — processus de 3 à 5 étapes : pastille (rang en chiffre) reliée à la suivante par un trait, carte avec titre et texte court. */
export function T20({ titre, etapes, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  return (
    <PageBase titre={titre} index={index} total={total} type="T20">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: ECART, paddingRight: OMBRE_DECALAGE, paddingBottom: OMBRE_DECALAGE }}>
        {etapes.map((e, i) => (
          <div key={i} style={{ flex: 1, display: "flex", gap: ECART_PASTILLE }}>
            <div style={{ flex: "none", width: PASTILLE, display: "flex", flexDirection: "column", alignItems: "center", marginBottom: i < etapes.length - 1 ? -ECART : 0 }}>
              <W01 taille={PASTILLE} rang={i + 1} />
              {i < etapes.length - 1 && <div style={{ flex: 1, width: 10, background: COULEURS.encre }} />}
            </div>
            <div
              style={{
                flex: 1,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 10,
                padding: `16px ${REMPLISSAGE}px`,
                borderRadius: 28,
                ...styleCarte(i + 1),
                border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`,
              }}
            >
              <div style={{ maxWidth: largeurTexteMax(X_TEXTE, BORD_DROIT_TEXTE_BAS), fontFamily: POLICE_TITRE, fontSize: TAILLES.etapeTitre, lineHeight: 1.1, color: COULEURS.encre }}>{e.titre}</div>
              <div style={{ maxWidth: largeurTexteMax(X_TEXTE, BORD_DROIT_TEXTE_BAS), fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: TAILLES.corps, lineHeight: 1.3, color: COULEURS.encre }}>{e.corps}</div>
            </div>
          </div>
        ))}
      </div>
    </PageBase>
  );
}
