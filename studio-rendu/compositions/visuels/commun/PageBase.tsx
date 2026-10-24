import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { rubriqueAffichee, TEXTES_FIXES, type TypePageAvecRubrique } from "../../../../src/briques/visuels/textes-fixes";
import { Annotation } from "./Annotation";
import { JAMBAGE, Zone } from "./controle-debordement";
import { COULEURS, LARGEUR_TEXTE, LARGEUR_TITRE, MARGE, PAGE, POLICE_CORPS, TAILLE_RUBRIQUE, TAILLE_SIGNATURE } from "./constantes";
import { Swipe } from "./Swipe";
import { Titre } from "./Titre";

interface Proprietes {
  /** Titre de page (2 lignes au plus) ; sans titre, le corps de page occupe toute la hauteur. */
  titre?: string;
  index: number;
  total: number;
  /** Corps de page : zone mesurée, le rendu échoue si son contenu déborde. */
  children: ReactNode;
  /** Type de la page de contenu : nomme la zone dans les messages d'échec et donne l'étiquette de rubrique (`RUBRIQUES`). */
  type: TypePageAvecRubrique;
  /** Étiquette posée par le CODE à droite de la rubrique (cas concret : « Scénario type · exemple illustratif »). */
  etiquette?: string;
  /** Hauteur (px) réservée au titre : plus basse pour les pages qui ont besoin de place (le titre reste ≥ 2 × le corps). */
  hauteurTitre?: number;
}

/** Hauteur (px) de la ligne de rubrique, marge basse comprise. */
export const HAUTEUR_RUBRIQUE = 44;

/**
 * Étiquette de rubrique : carré orange et mot en capitales (encre), au-dessus du titre. Le texte vient de `RUBRIQUES`, jamais du spec ;
 * sans texte (le titre dit déjà la rubrique), la ligne garde sa hauteur : la place du titre et du corps ne change pas.
 */
function Rubrique({ texte, etiquette }: { texte?: string; etiquette?: string }) {
  return (
    <div style={{ flex: "none", height: HAUTEUR_RUBRIQUE, display: "flex", alignItems: "flex-start", gap: 14 }}>
      {texte && (
        <>
          <div style={{ width: 22, height: 22, marginTop: 6, borderRadius: 6, background: COULEURS.orange, border: `3px solid ${COULEURS.encre}`, boxSizing: "border-box" }} />
          <div style={{ fontFamily: POLICE_CORPS, fontWeight: 700, fontSize: TAILLE_RUBRIQUE, lineHeight: "34px", letterSpacing: 3, color: COULEURS.encre }}>{texte}</div>
        </>
      )}
      {etiquette && (
        <div style={{ marginLeft: texte ? 10 : 0, marginTop: -2, padding: "1px 16px", borderRadius: 999, border: `3px dashed ${COULEURS.encre}`, background: COULEURS.blanc, fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: TAILLE_SIGNATURE, lineHeight: "32px", color: COULEURS.encre, whiteSpace: "nowrap" }}>
          {etiquette}
        </div>
      )}
    </div>
  );
}

/** Cadre commun des pages intérieures à fond crème : rubrique posée par le code, titre (zone mesurée), trait, corps (zone mesurée), repère de défilement avec la signature. */
export function PageBase({ titre, index, total, children, type, etiquette, hauteurTitre = PAGE.hauteurTitre }: Proprietes) {
  return (
    <AbsoluteFill style={{ background: COULEURS.creme, padding: MARGE, boxSizing: "border-box" }}>
      <Rubrique texte={rubriqueAffichee(type, titre)} etiquette={etiquette} />
      {titre && (
        <>
          <Zone libelle={`${type} : titre`} style={{ maxHeight: hauteurTitre, flex: "none" }}>
            <Titre texte={titre} maxLignes={2} hauteurMax={hauteurTitre - JAMBAGE} largeur={LARGEUR_TITRE} />
          </Zone>
          <div style={{ margin: "12px 0 16px" }}>
            <Annotation largeur={LARGEUR_TEXTE / 3} epaisseur={14} />
          </div>
        </>
      )}
      <Zone libelle={`${type} : corps`} corps style={{ flex: 1, minHeight: 0, width: LARGEUR_TEXTE, display: "flex", flexDirection: "column", marginBottom: PAGE.ecart }}>
        {children}
      </Zone>
      <div style={{ height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} signature={TEXTES_FIXES.signature} />
      </div>
    </AbsoluteFill>
  );
}
