import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { rubriqueAffichee } from "../../../../src/briques/visuels/rubrique";
import { TEXTES_FIXES, type TypePageAvecRubrique } from "../../../../src/briques/visuels/textes-fixes";
import { JAMBAGE, Zone } from "./controle-debordement";
import { BORD_DROIT_TEXTE, COULEURS, FILET, LARGEUR_TEXTE, LARGEUR_TITRE_BORNE, MARGE, PAGE, POLICE_CORPS, TAILLE_SIGNATURE } from "./constantes";
import { Filet, Rubrique } from "./editorial";
import { Swipe } from "./Swipe";
import { Titre } from "./Titre";

interface Proprietes {
  /** Titre de page (2 lignes au plus) ; sans titre, le corps de page occupe toute la hauteur. */
  titre?: string;
  index: number;
  total: number;
  /** Corps de page : zone mesurée, le rendu échoue si son contenu déborde. */
  children: ReactNode;
  /** Type de la page de contenu : nomme la zone dans les messages d'échec et donne l'étiquette de rubrique (`rubriqueAffichee`). */
  type: TypePageAvecRubrique;
  /** Étiquette posée par le CODE à droite de la rubrique (cas concret : « Scénario type · exemple illustratif »). */
  etiquette?: string;
  /** Hauteur (px) réservée au titre. */
  hauteurTitre?: number;
  /**
   * Corps à fond perdu (style C) : la zone du corps s'étend d'un bord de page à l'autre, sans marge ; chaque élément y pose lui-même la marge
   * de 64 px (`DANS_LA_COLONNE`), un bloc plein y touche les deux bords et garde son texte dans la colonne.
   */
  fondPerdu?: boolean;
}

/** Marges d'un élément du corps `fondPerdu` : son texte reste dans la colonne (x ≥ 64) ; un bloc plein porte ces marges en remplissage. */
export const DANS_LA_COLONNE = { paddingLeft: MARGE, paddingRight: MARGE } as const;

/** Colonne de texte de la grille (x = 64 → 912) : titres, filets et corps s'arrêtent au même bord droit. */
export const LARGEUR_COLONNE = BORD_DROIT_TEXTE - MARGE;

/** Hauteur (px) de la ligne de rubrique, marge basse comprise. */
export const HAUTEUR_RUBRIQUE = 56;
/** Espace (px) entre le titre et le filet, puis entre le filet et le corps de page. */
export const ECART_FILET = { avant: 20, apres: 36 } as const;

/**
 * Rubrique posée par le code (petites capitales espacées) et, à droite, l'étiquette éventuelle (texte du code, filet de 2 px autour).
 * Sans texte (le titre dit déjà la rubrique), la ligne garde sa hauteur : la place du titre et du corps ne change pas.
 */
function LigneRubrique({ texte, etiquette }: { texte?: string; etiquette?: string }) {
  return (
    <div style={{ flex: "none", width: LARGEUR_COLONNE, height: HAUTEUR_RUBRIQUE, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
      {texte ? <Rubrique texte={texte} /> : <div />}
      {etiquette && (
        <div style={{ marginTop: -8, padding: "4px 16px", borderRadius: 999, border: `${FILET}px solid ${COULEURS.encre}`, fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: TAILLE_SIGNATURE, lineHeight: "32px", color: COULEURS.encre, whiteSpace: "nowrap" }}>{etiquette}</div>
      )}
    </div>
  );
}

/**
 * Cadre ÉDITORIAL (A) des pages intérieures à fond crème : rubrique en petites capitales posée par le code, titre en capitales (zone mesurée),
 * filet de 2 px pleine colonne, corps (zone mesurée), pied avec la marque « Axion-IA ».
 */
export function PageBase({ titre, index, total, children, type, etiquette, hauteurTitre = PAGE.hauteurTitre, fondPerdu = false }: Proprietes) {
  return (
    <AbsoluteFill style={{ background: COULEURS.creme, padding: MARGE, boxSizing: "border-box" }}>
      <LigneRubrique texte={rubriqueAffichee(type, titre)} etiquette={etiquette} />
      {titre && (
        <>
          <Zone libelle={`${type} : titre`} style={{ maxHeight: hauteurTitre, flex: "none" }}>
            <Titre texte={titre} maxLignes={2} hauteurMax={hauteurTitre - JAMBAGE} largeur={LARGEUR_TITRE_BORNE} />
          </Zone>
          <Filet style={{ width: LARGEUR_COLONNE, margin: `${ECART_FILET.avant - JAMBAGE}px 0 ${ECART_FILET.apres}px` }} />
        </>
      )}
      <Zone
        libelle={`${type} : corps`}
        corps
        style={{ flex: 1, minHeight: 0, width: fondPerdu ? LARGEUR_TEXTE + 2 * MARGE : LARGEUR_TEXTE, display: "flex", flexDirection: "column", marginBottom: PAGE.ecart, ...(fondPerdu ? { marginLeft: -MARGE, marginRight: -MARGE } : {}) }}
      >
        {children}
      </Zone>
      <div style={{ flex: "none", height: PAGE.hauteurPied }}>
        <Swipe index={index} total={total} signature={TEXTES_FIXES.signature} />
      </div>
    </AbsoluteFill>
  );
}
