import { COULEURS, POLICE_CORPS, POLICE_TITRE, TAILLES } from "../commun/constantes";
import { PageBase } from "../commun/PageBase";
import type { EtapeSpec } from "../commun/types";
import { W01 } from "../mini/W01";
import { chargerPoliceArchivoBlack, chargerPoliceJetBrainsMono } from "../polices";

interface Proprietes {
  titre: string;
  etapes: EtapeSpec[];
  index: number;
  total: number;
}

const ECART = 20;
const PASTILLE = 100;

/** T20 — processus de 3 à 5 étapes : pastille (rang en points) reliée à la suivante par un trait, carte avec titre et texte court. */
export function T20({ titre, etapes, index, total }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceJetBrainsMono();
  return (
    <PageBase titre={titre} index={index} total={total} libelle="T20">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: ECART }}>
        {etapes.map((e, i) => (
          <div key={i} style={{ flex: 1, display: "flex", gap: 24 }}>
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
                padding: "16px 28px",
                borderRadius: 28,
                background: COULEURS.pale,
                border: `4px solid ${COULEURS.encre}`,
              }}
            >
              <div style={{ fontFamily: POLICE_TITRE, fontSize: TAILLES.etapeTitre, lineHeight: 1.1, color: COULEURS.encre }}>{e.titre}</div>
              <div style={{ fontFamily: POLICE_CORPS, fontWeight: 500, fontSize: TAILLES.corps, lineHeight: 1.3, color: COULEURS.encre }}>{e.corps}</div>
            </div>
          </div>
        ))}
      </div>
    </PageBase>
  );
}
