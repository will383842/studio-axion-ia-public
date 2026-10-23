import { BORDURE_CARTE, COULEURS, MARGE, OMBRE_DECALAGE, POLICE_CORPS, TAILLES } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { styleCarte } from "../commun/style-carte";
import { W01 } from "../mini/W01";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  points: { texte: string }[];
  index: number;
  total: number;
}

const PASTILLE = 104;
const ECART_PASTILLE = 28;
const REMPLISSAGE = 28;
/** Abscisse du début du texte d'un point : marge, bordure, remplissage, pastille, espace. */
const X_TEXTE = MARGE + BORDURE_CARTE + REMPLISSAGE + PASTILLE + ECART_PASTILLE;

/** T06 — liste numérotée courte (3 à 4 points) : une ligne par point, le rang est montré par la pastille numérotée (`W01`). */
export function T06({ titre, points, index, total }: Proprietes) {
  chargerPoliceInter();
  return (
    <PageBase titre={titre} index={index} total={total} type="T06">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, paddingRight: OMBRE_DECALAGE, paddingBottom: OMBRE_DECALAGE }}>
        {points.map((p, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: ECART_PASTILLE,
              padding: `20px ${REMPLISSAGE}px`,
              borderRadius: 28,
              ...styleCarte(i + 1),
              border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`,
            }}
          >
            <div style={{ flexShrink: 0, width: PASTILLE, height: PASTILLE }}>
              <W01 taille={PASTILLE} rang={i + 1} />
            </div>
            <div style={{ maxWidth: largeurTexteMax(X_TEXTE, BORD_DROIT_TEXTE_BAS), fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: TAILLES.liste, lineHeight: 1.3, color: COULEURS.encre }}>{p.texte}</div>
          </div>
        ))}
      </div>
    </PageBase>
  );
}
