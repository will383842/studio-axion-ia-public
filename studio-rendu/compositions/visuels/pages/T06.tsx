import { BORD_DROIT_TEXTE, COULEURS, MARGE, POLICE_CORPS } from "../commun/constantes";
import { filetAuDessus, Numero } from "../commun/editorial";
import { PageBase } from "../commun/PageBase";
import { k, moinsK, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceTitre } from "../polices";

interface Proprietes {
  titre: string;
  points: { texte: string }[];
  index: number;
  total: number;
}

/** Colonne du numéro (px avant remplissage) et espace jusqu'au texte. */
const COLONNE_NUMERO = 112;
const ECART = 24;
const X_TEXTE = MARGE + COLONNE_NUMERO + ECART;

/**
 * T06 — liste numérotée courte (3 à 4 points), style ÉDITORIAL (A, ART-1) : grand numéro orange (« 01 », posé par le code), texte en Inter
 * SemiBold, filet de 2 px entre les points. Les points gardent la hauteur de leur contenu ; le groupe grandit pour remplir la page.
 */
export function T06({ titre, points, index, total }: Proprietes) {
  chargerPoliceInter();
  chargerPoliceTitre();
  return (
    <PageBase titre={titre} index={index} total={total} type="T06">
      <Remplir max={2.2} ecart={32}>
        {points.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: ECART, ...filetAuDessus(i === 0, 28) }}>
            <div style={{ flex: "none", width: k(COLONNE_NUMERO) }}>
              <Numero rang={i + 1} taille={k(72)} />
            </div>
            <div style={{ maxWidth: moinsK(largeurTexteMax(X_TEXTE, i === points.length - 1 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE), COLONNE_NUMERO), fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(38), lineHeight: 1.28, color: COULEURS.encre }}>{p.texte}</div>
          </div>
        ))}
      </Remplir>
    </PageBase>
  );
}
