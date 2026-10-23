import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { Annotation } from "./Annotation";
import { JAMBAGE, Zone } from "./controle-debordement";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE, MARGE, PAGE } from "./constantes";
import { Swipe } from "./Swipe";
import { Titre } from "./Titre";

interface Proprietes {
  /** Titre de page (2 lignes au plus) ; sans titre, le corps de page occupe toute la hauteur. */
  titre?: string;
  index: number;
  total: number;
  /** Corps de page : zone mesurée, le rendu échoue si son contenu déborde. */
  children: ReactNode;
  /** Nom de la page dans les messages d'échec. */
  libelle: string;
}

/** Cadre commun des pages à fond crème : titre (zone mesurée), trait, corps (zone mesurée), repère de défilement. */
export function PageBase({ titre, index, total, children, libelle }: Proprietes) {
  return (
    <AbsoluteFill style={{ background: COULEURS.creme, padding: MARGE, boxSizing: "border-box" }}>
      {titre && (
        <>
          <Zone libelle={`${libelle} : titre`} style={{ maxHeight: PAGE.hauteurTitre, flex: "none" }}>
            <Titre texte={titre} maxLignes={2} hauteurMax={PAGE.hauteurTitre - JAMBAGE} largeur={LARGEUR_TITRE} />
          </Zone>
          <div style={{ margin: "18px 0 22px" }}>
            <Annotation largeur={LARGEUR_TEXTE / 3} epaisseur={14} />
          </div>
        </>
      )}
      <Zone libelle={`${libelle} : corps`} style={{ flex: 1, minHeight: 0, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", marginBottom: PAGE.ecart }}>
        {children}
      </Zone>
      <div style={{ height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} />
      </div>
    </AbsoluteFill>
  );
}
