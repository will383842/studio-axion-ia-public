import { COULEURS, POLICE_CORPS, TAILLES } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import { W01 } from "../mini/W01";
import { chargerPoliceJetBrainsMono } from "../polices";

interface Proprietes {
  titre: string;
  points: { texte: string }[];
  index: number;
  total: number;
}

/** T06 — liste numérotée courte (3 à 5 points) : une ligne par point, le rang est montré par des points (jamais de chiffre). */
export function T06({ titre, points, index, total }: Proprietes) {
  chargerPoliceJetBrainsMono();
  return (
    <PageBase titre={titre} index={index} total={total} libelle="T06">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        {points.map((p, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              gap: 28,
              padding: "20px 28px",
              borderRadius: 28,
              background: COULEURS.pale,
              border: `4px solid ${COULEURS.encre}`,
            }}
          >
            <div style={{ flexShrink: 0, width: 104, height: 104 }}>
              <W01 taille={104} rang={i + 1} />
            </div>
            <div style={{ fontFamily: POLICE_CORPS, fontWeight: 500, fontSize: TAILLES.liste, lineHeight: 1.3, color: COULEURS.encre }}>{p.texte}</div>
          </div>
        ))}
      </div>
    </PageBase>
  );
}
