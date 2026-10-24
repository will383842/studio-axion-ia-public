import { HAUTEUR_MAQUETTE, LARGEUR_MAQUETTE, maquettesDesEtapes, type VarianteT20 } from "../../../../src/briques/visuels/maquettes-etapes";
import { BORD_DROIT_TEXTE, COULEURS, FILET, MARGE, POLICE_CORPS } from "../commun/constantes";
import { Numero } from "../commun/editorial";
import { colonne, largeurAuFacteur1 } from "../commun/geometrie";
import { PageBase } from "../commun/PageBase";
import { Dessin } from "../commun/Picto";
import { k, moinsK, Remplir } from "../commun/Remplir";
import type { EtapeSpec } from "../commun/types";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter, chargerPoliceTitre } from "../polices";
import { MiniMaquette } from "./maquettes-etapes";

interface Proprietes {
  titre: string;
  etapes: EtapeSpec[];
  index: number;
  total: number;
  variante?: VarianteT20;
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
export function T20({ titre, etapes, index, total, variante = "classique" }: Proprietes) {
  if (variante === "maquettes") return <EtapesMaquettes titre={titre} etapes={etapes} index={index} total={total} />;
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

/** Colonne du texte de la variante à maquettes : après les numéros et la mini-maquette. */
const X_TEXTE_MAQUETTE = X_TEXTE + LARGEUR_MAQUETTE + ECART;
/** Colonnes du texte des étapes à maquettes (places de la porte : `placesT20Maquettes`). */
export const colonnesT20Maquettes = (n: number) =>
  Array.from({ length: n }, (_, i) => colonne(X_TEXTE_MAQUETTE, i >= n - 2 ? BORD_DROIT_TEXTE_BAS : BORD_DROIT_TEXTE, COLONNE_NUMERO + LARGEUR_MAQUETTE));

/**
 * T20, variante « étapes à mini-maquettes » (L10) : même fil de numéros que l'ancienne page ; entre le numéro et le texte, chaque étape montre
 * une mini-maquette d'écran dessinée en SVG maison (`MiniMaquette`), choisie par le code d'après son texte (`maquettesDesEtapes`), toutes
 * différentes. Le texte est plus étroit (places de la porte : `placesT20Maquettes`), il s'arrête à x = 912 (860 pour les deux dernières).
 */
function EtapesMaquettes({ titre, etapes, index, total }: Omit<Proprietes, "variante">) {
  chargerPoliceInter();
  chargerPoliceTitre();
  const maquettes = maquettesDesEtapes(etapes);
  const colonnes = colonnesT20Maquettes(etapes.length);
  return (
    <PageBase titre={titre} index={index} total={total} type="T20">
      <Remplir max={1.6}>
        {etapes.map((e, i) => {
          const derniere = i === etapes.length - 1;
          const largeur = moinsK(largeurAuFacteur1(colonnes[i]), colonnes[i].croissance);
          return (
            <div key={i} style={{ display: "flex", gap: ECART }}>
              <div style={{ flex: "none", width: k(COLONNE_NUMERO), display: "flex", flexDirection: "column", alignItems: "center" }}>
                <Numero rang={i + 1} taille={k(56)} />
                {!derniere && <div style={{ flex: 1, width: FILET, minHeight: k(24), margin: `${k(10)} 0`, background: COULEURS.encre }} />}
              </div>
              <Dessin nom={`maquette-${maquettes[i]}`} grandit={{ largeur: LARGEUR_MAQUETTE, hauteur: HAUTEUR_MAQUETTE }} style={{ marginBottom: derniere ? 0 : k(30) }}>
                <MiniMaquette maquette={maquettes[i]} />
              </Dessin>
              <div style={{ display: "flex", flexDirection: "column", gap: k(8), paddingTop: k(6), paddingBottom: derniere ? 0 : k(30) }}>
                <div style={{ maxWidth: largeur, fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: k(36), lineHeight: 1.15, color: COULEURS.encre }}>{e.titre}</div>
                <div style={{ maxWidth: largeur, fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: k(30), lineHeight: 1.3, color: COULEURS.encre }}>{e.corps}</div>
              </div>
            </div>
          );
        })}
      </Remplir>
    </PageBase>
  );
}
