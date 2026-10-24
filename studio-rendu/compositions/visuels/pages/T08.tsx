import { TEXTES_FIXES } from "../../../../src/briques/visuels/textes-fixes";
import { BORD_DROIT_TEXTE, COULEURS, MARGE, POLICE_CORPS } from "../commun/constantes";
import { Etiquette } from "../commun/editorial";
import { DANS_LA_COLONNE, PageBase } from "../commun/PageBase";
import { k, Remplir } from "../commun/Remplir";
import { BORD_DROIT_TEXTE_BAS, largeurTexteMax } from "../commun/zones";
import { chargerPoliceInter } from "../polices";

interface Proprietes {
  titre: string;
  avant: string;
  apres: string;
  index: number;
  total: number;
}

/** Corps (px, avant remplissage) d'un texte selon sa longueur : court, il est plus grand. */
const corps = (t: string) => (t.length <= 30 ? 56 : 46);

/**
 * T08 — avant / après, style TYPOGRAPHIQUE (C, ART-1) : « AVANT » et sa phrase sur la crème, puis un bloc orange à fond perdu qui porte
 * « APRÈS » et sa phrase, en grand. Aucune forme décorative : le contraste crème / orange dit le changement. Étiquettes posées par le code.
 * Le groupe grandit pour remplir la page (`Remplir`).
 */
export function T08({ titre, avant, apres, index, total }: Proprietes) {
  chargerPoliceInter();
  const texte = (t: string, poids: number, bord: number) => ({ maxWidth: largeurTexteMax(MARGE, bord), fontFamily: POLICE_CORPS, fontWeight: poids, fontSize: k(corps(t)), lineHeight: 1.18, color: COULEURS.encre });
  return (
    <PageBase titre={titre} index={index} total={total} type="T08" fondPerdu>
      <Remplir max={2.8}>
        <div style={{ ...DANS_LA_COLONNE, display: "flex", flexDirection: "column", gap: k(16), paddingBottom: k(44) }}>
          <Etiquette texte={TEXTES_FIXES.t08Avant.toLocaleUpperCase("fr-FR")} taille={k(28)} />
          <div style={texte(avant, 600, BORD_DROIT_TEXTE)}>{avant}</div>
        </div>
        <div style={{ ...DANS_LA_COLONNE, display: "flex", flexDirection: "column", gap: k(16), paddingTop: k(44), paddingBottom: k(48), background: COULEURS.orange }}>
          <Etiquette texte={TEXTES_FIXES.t08Apres.toLocaleUpperCase("fr-FR")} taille={k(28)} />
          <div style={texte(apres, 700, BORD_DROIT_TEXTE_BAS)}>{apres}</div>
        </div>
      </Remplir>
    </PageBase>
  );
}
