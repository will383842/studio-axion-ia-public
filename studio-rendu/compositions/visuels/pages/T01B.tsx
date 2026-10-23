import { AbsoluteFill } from "remotion";
import { Annotation } from "../commun/Annotation";
import { Badge } from "../commun/Badge";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE, MARGE, PAGE } from "../commun/constantes";
import { Zone } from "../commun/controle-debordement";
import { Swipe } from "../commun/Swipe";
import { Titre } from "../commun/Titre";
import { COMPOSANTS_DECOR } from "../decor/formes";
import type { TypeDecor } from "../../../../src/briques/visuels/registre-decor";

interface Proprietes {
  titre: string;
  sousTitre?: string;
  deco?: TypeDecor;
  index: number;
  total: number;
}

/** T01B — couverture, variante B : grand bloc orange décoré en haut (il prend la place laissée par le texte), puis titre (dernière ligne en orange), trait et sous-titre. */
export function T01B({ titre, sousTitre, deco = "E01", index, total }: Proprietes) {
  const Deco = COMPOSANTS_DECOR[deco];
  return (
    <AbsoluteFill style={{ background: COULEURS.creme, padding: MARGE, boxSizing: "border-box" }}>
      <div style={{ flex: 1, minHeight: 360, boxSizing: "border-box", borderRadius: 44, background: COULEURS.orange, border: `4px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Le décor suit la place laissée par le texte : 60 % de la hauteur du bloc, au plus 520 px. */}
        <div style={{ height: "60%", maxHeight: 520, aspectRatio: "1" }}>
          <Deco taille="100%" sur="orange" />
        </div>
      </div>
      <Zone libelle="T01B : texte" style={{ flex: "none", maxHeight: 760, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", gap: 34, margin: `34px 0 ${PAGE.ecart}px` }}>
        <Titre texte={titre} maxLignes={3} hauteurMax={470} largeur={LARGEUR_TITRE} accent />
        <Annotation largeur={LARGEUR_TEXTE / 2} />
        {sousTitre && <Badge texte={sousTitre} />}
      </Zone>
      <div style={{ height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} />
      </div>
    </AbsoluteFill>
  );
}
