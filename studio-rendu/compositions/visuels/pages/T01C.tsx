import { AbsoluteFill } from "remotion";
import { Annotation } from "../commun/Annotation";
import { Badge } from "../commun/Badge";
import { COULEURS, MARGE, PAGE, TITRE } from "../commun/constantes";
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

const RAYON = 44;
const REMPLISSAGE = 44;
const LARGEUR_CADRE = 984 - 2 * 4 - 2 * REMPLISSAGE;

/**
 * T01C — couverture, variante C : grand cadre orange, titre et sous-titre en encre (encre sur orange : 5,4:1), grand décor clair en bas
 * à droite. Le décor prend la place laissée par le texte : la page ne laisse jamais de grand vide.
 */
export function T01C({ titre, sousTitre, deco = "E02", index, total }: Proprietes) {
  const Deco = COMPOSANTS_DECOR[deco];
  return (
    <AbsoluteFill style={{ background: COULEURS.creme, padding: MARGE, boxSizing: "border-box" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", boxSizing: "border-box", borderRadius: RAYON, background: COULEURS.orange, border: `4px solid ${COULEURS.encre}`, marginBottom: PAGE.ecart }}>
        <Zone libelle="T01C : texte" style={{ flex: "none", maxHeight: 720, padding: REMPLISSAGE, display: "flex", flexDirection: "column", gap: 30 }}>
          <Titre texte={titre} maxLignes={3} hauteurMax={380} largeur={LARGEUR_CADRE - TITRE.tolerance} />
          <Annotation largeur={LARGEUR_CADRE / 2} couleur={COULEURS.encre} />
          {sousTitre && <Badge texte={sousTitre} />}
        </Zone>
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div style={{ position: "absolute", right: REMPLISSAGE, bottom: REMPLISSAGE, height: "80%", maxHeight: 560, aspectRatio: "1" }}>
            <Deco taille="100%" sur="orange" />
          </div>
        </div>
      </div>
      <div style={{ height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} />
      </div>
    </AbsoluteFill>
  );
}
