import type { CSSProperties, ReactNode } from "react";
import type { IdIllustration, NomIcone } from "../../../../src/briques/visuels/registre-illustrations";
import { Icone2Tons } from "../icones/Icone2Tons";
import { COMPOSANTS_ILLUSTRATIONS } from "../illustrations";
import type { CouleursDessin } from "../illustrations/palette";
import { ECHELLE, k } from "./Remplir";
import { ATTRIBUT_DESSIN } from "./zones";

/** Icône de la banque (liste fermée), dans une enveloppe marquée `ATTRIBUT_DESSIN` : la mesure du rendu vérifie qu'aucun texte ne s'y pose. */
export function Picto({ nom, taille, couleurs }: { nom: NomIcone; taille: number | string; couleurs?: CouleursDessin }) {
  return (
    <div {...{ [ATTRIBUT_DESSIN]: nom }} style={{ flex: "none", width: taille, height: taille, lineHeight: 0 }}>
      <Icone2Tons nom={nom} taille="100%" {...couleurs} />
    </div>
  );
}

/** Illustration de la banque (I01…I12), marquée comme dessin : aucun texte ne s'y pose (mesure du rendu). */
export function Scene({ id, taille, couleurs }: { id: IdIllustration; taille: number | string; couleurs?: CouleursDessin }) {
  const Illustration = COMPOSANTS_ILLUSTRATIONS[id];
  return (
    <div {...{ [ATTRIBUT_DESSIN]: id }} style={{ flex: "none", width: taille, height: taille, lineHeight: 0 }}>
      <Illustration taille="100%" {...couleurs} />
    </div>
  );
}

/**
 * Enveloppe commune des dessins faits sur place (flèches, interrupteurs, jauge, liaisons) : marquée `ATTRIBUT_DESSIN` comme les dessins de la
 * banque, la mesure du rendu vérifie qu'aucun texte ne s'y pose.
 */
export function Dessin({ nom, children, style, grandit }: { nom: string; children: ReactNode; style?: CSSProperties; grandit?: { largeur: number; hauteur: number } }) {
  // `grandit` : dessin de taille fixe agrandi avec le facteur de remplissage de la page (`Remplir`), l'enveloppe prend la taille agrandie.
  return (
    <div {...{ [ATTRIBUT_DESSIN]: nom }} style={{ flex: "none", lineHeight: 0, ...(grandit ? { width: k(grandit.largeur), height: k(grandit.hauteur) } : {}), ...style }}>
      {grandit ? <div style={{ width: grandit.largeur, height: grandit.hauteur, transform: ECHELLE, transformOrigin: "0 0" }}>{children}</div> : children}
    </div>
  );
}
