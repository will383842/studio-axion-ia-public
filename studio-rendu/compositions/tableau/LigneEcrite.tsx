/**
 * LIGNE ÉCRITE (TB-05) : un élément de texte de la page (ligne, chiffre, mention, lignes d'une bulle) se dévoile de
 * gauche à droite par un MASQUE, ligne visuelle après ligne visuelle ; la pointe du crayon suit le bord (même courbe
 * « écrire » que le stylo), sur la largeur mesurée par la mise en page. Texte d'un seul tenant, à la police de
 * l'habillage, sans crénage ni ligatures : la mesure (chasse des polices dessinées) est exacte, le bord finit au
 * dernier mot.
 * Le texte est TOUJOURS en écriture (noir) : l'orange ne sert qu'aux traits (mots importants soulignés, marques).
 */
import type { ReactNode } from "react";
import { COULEURS_VIDEO } from "../../../src/briques/habillage/charte-video";
import { APPROCHE_EM } from "../../../src/briques/motion/jetons";
import { adoucir } from "../../../src/briques/stylo/courbes";
import { STYLE_ECRITURE_EXACTE } from "../../../src/briques/stylo/mesure-ecriture";
import { policeDe } from "./plan";
import type { NiveauMise, RectPx } from "./types";

export interface ProprietesLigneVisuelle {
  texte: string;
  /** Rectangle de la ligne (mise en page). */
  px: RectPx;
  taille: number;
  niveau: NiveauMise;
  /** Avancement de l'écriture (0 à 1, temps linéaire ; le bord suit la courbe adoucie du crayon). */
  u: number;
  /** Largeur de l'image : le masque s'ouvre jusqu'au bord droit. */
  largeurImage: number;
}

/** Bord dévoilé (px depuis le début de la ligne) pour un avancement `u`. */
export const bordDevoile = (u: number, largeur: number) => adoucir(u) * largeur;

export function LigneEcrite({ texte, px, taille, niveau, u, largeurImage }: ProprietesLigneVisuelle): ReactNode {
  if (u <= 0) return null;
  const police = policeDe(niveau);
  // Le masque déborde un peu en haut, en bas et à gauche (accents, jambages) ; à droite il s'arrête au bord dévoilé.
  const marge = Math.round(taille * 0.35);
  const gauche = px.x - marge;
  const largeur = largeurImage - gauche;
  const ouvert = u >= 1 ? largeur : marge + bordDevoile(u, px.largeur);
  return (
    <div
      style={{
        position: "absolute",
        left: gauche,
        top: px.y - marge,
        width: largeur,
        height: px.hauteur + 2 * marge,
        clipPath: u >= 1 ? undefined : `inset(0px ${(largeur - ouvert).toFixed(2)}px 0px 0px)`,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: marge,
          top: marge,
          height: px.hauteur,
          lineHeight: `${px.hauteur}px`,
          fontFamily: `"${police.famille}", sans-serif`,
          fontWeight: police.graisse,
          fontSize: taille,
          letterSpacing: `${APPROCHE_EM[niveau]}em`,
          ...STYLE_ECRITURE_EXACTE,
          color: COULEURS_VIDEO.ecriture,
          whiteSpace: "pre",
        }}
      >
        {texte}
      </span>
    </div>
  );
}
