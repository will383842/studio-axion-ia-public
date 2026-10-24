import { BORD_DROIT_TEXTE, COULEURS, FILET, MARGE, POLICE_CORPS } from "../commun/constantes";
import { Numero } from "../commun/editorial";
import { PageBase } from "../commun/PageBase";
import { k, moinsK, Remplir } from "../commun/Remplir";
import type { EtapeSpec } from "../commun/types";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceTitre } from "../polices";

interface Proprietes {
  titre: string;
  etapes: EtapeSpec[];
  index: number;
  total: number;
}

/** Colonne des numéros (px avant remplissage), reliés par un filet vertical de 2 px. */
const COLONNE_NUMERO = 96;
const ECART = 28;
const X_TEXTE = MARGE + COLONNE_NUMERO + ECART;

/**
 * T20 — processus de 3 à 5 étapes, style ÉDITORIAL (A, ART-1) : numéro orange (« 01 », posé par le code) dans une colonne à gauche, un
 * filet vertical fin relie les numéros (le fil du processus) ; titre de l'étape en Inter Bold, texte court en Inter SemiBold. Les étapes
 * gardent la hauteur de leur contenu ; le groupe grandit pour remplir la page.
 */
export function T20({ titre, etapes, index, total }: Proprietes) {
  chargerPoliceInter();
  chargerPoliceTitre();
  return (
    <PageBase titre={titre} index={index} total={total} type="T20">
      <Remplir max={2}>
        {etapes.map((e, i) => {
          const derniere = i === etapes.length - 1;
          const largeur = moinsK(largeurTexteMax(X_TEXTE, i >= etapes.length - 2 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE), COLONNE_NUMERO);
          return (
            <div key={i} style={{ display: "flex", gap: ECART }}>
              <div style={{ flex: "none", width: k(COLONNE_NUMERO), display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Numero rang={i + 1} taille={k(56)} />
                {!derniere && <div style={{ flex: 1, width: FILET, minHeight: k(24), margin: `${k(10)} 0`, background: COULEURS.encre }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: k(8), paddingTop: k(6), paddingBottom: derniere ? 0 : k(30) }}>
                <div style={{ maxWidth: largeur, fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(38), lineHeight: 1.15, color: COULEURS.encre }}>{e.titre}</div>
                <div style={{ maxWidth: largeur, fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(31), lineHeight: 1.3, color: COULEURS.encre }}>{e.corps}</div>
              </div>
            </div>
          );
        })}
      </Remplir>
    </PageBase>
  );
}
