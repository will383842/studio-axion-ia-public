/**
 * DESSIN DU TUTORIEL SANS VOIX COMPOSÉ (lot qualité 25-11, QUAL-3) : PUR. Il dessine fidèlement les `ElementVisible`
 * d'une `ImageSansVoix` (rect, opacité, z, remplissage, contour, texte en lignes, barre, progression, icône, curseur).
 * Aucun calcul de temps ni de mise en page : tout vient de la géométrie (QUAL-1). Couleurs : uniquement la table de
 * couleurs NOMMÉES de la charte (aucune valeur en dur) ; police Manrope ; jamais bleu ni jaune.
 * Imports relatifs seulement (lu par Remotion).
 */
import type { CSSProperties, ReactNode } from "react";
import { COULEURS_HEX, INTERLIGNE, PLANCHER_TEXTE } from "../../../../src/briques/plan-scenes/tutoriel/sans-voix/grammaire";
import type { CouleurCharte, ElementVisible, FormatImage, ImageSansVoix } from "../../../../src/briques/plan-scenes/tutoriel/sans-voix/types";

/** Table des couleurs nommées de la charte (celle de la grammaire, QUAL-1). */
export const COULEURS_SANS_VOIX: Record<CouleurCharte, string> = COULEURS_HEX;

const couleur = (nom: CouleurCharte | undefined, repli: CouleurCharte): string => COULEURS_SANS_VOIX[nom ?? repli];
/** Ombre douce : le noir de la charte (COULEURS_HEX.noir, lu en rvb) avec une opacité de 12 %. */
const OMBRE_DOUCE = (() => {
  const [r, v, b] = [1, 3, 5].map((i) => parseInt(COULEURS_SANS_VOIX.noir.slice(i, i + 2), 16));
  return `0 10px 28px rgba(${r}, ${v}, ${b}, 0.12)`;
})();
/** Interligne de repli (rect ou lignes incohérents) : l'interligne unique de la grammaire. */
const INTERLIGNE_REPLI = INTERLIGNE;
/**
 * Taille de repli d'un texte sans `taillePx` : le plancher de lisibilité de la grammaire (PLANCHER_TEXTE).
 * Un texte sans `taillePx` est une anomalie de la géométrie : on le signale (console.warn) au lieu de le taire.
 */
export const TAILLE_REPLI_PX = PLANCHER_TEXTE;
const FAMILLE = "Manrope, sans-serif";

function Icone({ el }: { el: ElementVisible }) {
  const { largeur: l, hauteur: h } = el.rect;
  const c = couleur(el.couleur ?? el.remplissage, "terracotta");
  const taille = Math.min(l, h);
  const tour = Number.isFinite(el.progression) ? (((el.progression as number) % 1) + 1) % 1 : 0;
  const forme = (() => {
    switch (el.icone) {
      case "cloche":
        return (
          <>
            <path d="M12 3 C7.5 3 6 6.5 6 10 L6 14 L4 17 L20 17 L18 14 L18 10 C18 6.5 16.5 3 12 3 Z" fill={c} />
            <path d="M9.5 19 A2.6 2.6 0 0 0 14.5 19 Z" fill={c} />
          </>
        );
      case "point":
        return <circle cx={12} cy={12} r={9} fill={c} />;
      case "pastille":
        return <circle cx={12} cy={12} r={10} fill={c} />;
      case "horloge":
        return (
          <>
            <circle cx={12} cy={12} r={9.5} fill="none" stroke={c} strokeWidth={2.2} />
            {/* Deux aiguilles qui partent du centre (12, 12) et se lisent comme un chevron : la petite (heures, longueur 4, trait 2,2) est
                FIXE à 300° (10 h) ; la grande (minutes, longueur 6,5, trait 1,8) TOURNE de `progression` × 360° depuis midi. Bouts ronds. */}
            <path d="M12 12 L12 8" fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" transform="rotate(300 12 12)" />
            <path d="M12 12 L12 5.5" fill="none" stroke={c} strokeWidth={1.8} strokeLinecap="round" transform={`rotate(${tour * 360} 12 12)`} />
          </>
        );
      case "boite":
        // Cube (stock) : contour hexagonal, arêtes de la face du dessus et arête verticale du devant.
        return (
          <g fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 L20 7.5 L20 16.5 L12 21 L4 16.5 L4 7.5 Z" />
            <path d="M4 7.5 L12 12 L20 7.5 M12 12 L12 21" />
          </g>
        );
      case "seuil":
        // Seuil : une ligne horizontale en haut et, en dessous d'elle, une flèche verticale qui pointe vers le bas (sous le seuil).
        return (
          <g fill="none" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6 L21 6" />
            <path d="M12 10 L12 20 M7.5 15.5 L12 20 L16.5 15.5" />
          </g>
        );
      case "valeur":
        // Pile de pièces (sans « € » ni chiffre) : trois pièces empilées, vues en perspective.
        return (
          <g fill="none" stroke={c} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            {[16.5, 11, 5.5].map((y) => (
              <g key={y}>
                <ellipse cx={12} cy={y} rx={7.5} ry={2.5} />
                <path d={`M4.5 ${y} v2.6 a7.5 2.5 0 0 0 15 0 v-2.6`} />
              </g>
            ))}
          </g>
        );
      case "fleche":
        return <path d="M4 12 L19 12 M13 6 L19 12 L13 18" fill="none" stroke={c} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />;
      default:
        return null;
    }
  })();
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" style={{ position: "absolute", left: (l - taille) / 2, top: (h - taille) / 2 }}>
      {forme}
    </svg>
  );
}

function Texte({ el }: { el: ElementVisible }) {
  const lignes = el.lignes && el.lignes.length > 0 ? el.lignes : el.texte ? [el.texte] : [];
  if (el.taillePx === undefined) console.warn(`DessinSansVoix : le texte « ${el.id} » n'a pas de taillePx, repli ${TAILLE_REPLI_PX} px`);
  const taille = el.taillePx ?? TAILLE_REPLI_PX;
  // Interligne = ce que mesure le contrôle : hauteur du rect / (nombre de lignes × taille).
  const brut = lignes.length > 0 ? el.rect.hauteur / (lignes.length * taille) : NaN;
  const interligne = Number.isFinite(brut) && brut >= 0.8 && brut <= 2.5 ? brut : INTERLIGNE_REPLI;
  const centre = el.alignement === "centre";
  const epaisseur = Math.max(2, taille * 0.08);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: centre ? "center" : "flex-start", fontFamily: FAMILLE, fontSize: taille, fontWeight: el.graisse ?? 600, color: couleur(el.couleur, "noir"), lineHeight: interligne, whiteSpace: "nowrap", textAlign: centre ? "center" : "left" }}>
      {lignes.map((ligne, i) => (
        <div key={i} style={{ position: "relative", display: "inline-block" }}>
          {ligne}
          {el.barre !== undefined && el.barre > 0 ? (
            <svg width="100%" height={epaisseur} style={{ position: "absolute", left: 0, top: "50%", marginTop: -epaisseur / 2, overflow: "visible" }}>
              <rect x={0} y={0} width={`${Math.min(1, el.barre) * 100}%`} height={epaisseur} rx={epaisseur / 2} fill={COULEURS_SANS_VOIX.terracotta} />
            </svg>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Curseur({ el }: { el: ElementVisible }) {
  const pointe = el.pointe ?? { x: el.rect.x, y: el.rect.y };
  const anneau = Math.max(0, Math.min(1, el.anneauClic ?? 0));
  return (
    <div style={{ position: "absolute", inset: 0, opacity: el.opacite, zIndex: el.z, pointerEvents: "none" }}>
      {anneau > 0 ? (
        <span style={{ position: "absolute", left: pointe.x - 40, top: pointe.y - 40, width: 80, height: 80, boxSizing: "border-box", borderRadius: 40, border: `4px solid ${COULEURS_SANS_VOIX.terracotta}`, opacity: 1 - anneau, transform: `scale(${0.4 + anneau * 0.9})` }} />
      ) : null}
      <svg width={44} height={56} viewBox="0 0 22 28" style={{ position: "absolute", left: pointe.x - 1, top: pointe.y - 1, transform: `scale(${1 - 0.1 * anneau})`, transformOrigin: "2px 2px" }}>
        <path d="M1 1 L1 22 L6.5 17 L10 26 L14 24.5 L10.5 15.8 L18 15.8 Z" fill={COULEURS_SANS_VOIX.noir} stroke={COULEURS_SANS_VOIX.ivoire} strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Element({ el }: { el: ElementVisible }) {
  if (el.genre === "curseur") return <Curseur el={el} />;
  const { x, y, largeur, hauteur } = el.rect;
  const style: CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    width: largeur,
    height: hauteur,
    opacity: el.opacite,
    zIndex: el.z,
    boxSizing: "border-box",
    borderRadius: el.rayonPx ?? 0,
    background: el.remplissage ? COULEURS_SANS_VOIX[el.remplissage] : "transparent",
    // Contour terracotta (carte de l'alerte, mise en valeur) : UN SEUL trait de 3 px ; les autres contours restent à 2 px.
    border: el.contour ? `${el.contour === "terracotta" ? 3 : 2}px solid ${COULEURS_SANS_VOIX[el.contour]}` : undefined,
    boxShadow: el.ombre ? OMBRE_DOUCE : undefined,
  };
  let contenu: ReactNode = null;
  if (el.genre === "texte") contenu = <Texte el={el} />;
  else if (el.icone) contenu = <Icone el={el} />;
  return (
    <div data-id={el.id} style={style}>
      {contenu}
    </div>
  );
}

export function DessinSansVoix({ image, format }: { image: ImageSansVoix; format: FormatImage }) {
  const ordonnes = image.elements.filter((e) => e.opacite > 0.005).map((e, i) => ({ e, i })).sort((a, b) => a.e.z - b.e.z || a.i - b.i);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", width: format.largeur, height: format.hauteur, background: couleur(image.fond, "ivoire"), fontFamily: FAMILLE }}>
      {ordonnes.map(({ e }) => (
        <Element key={e.id} el={e} />
      ))}
    </div>
  );
}
