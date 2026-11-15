import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { chargerPoliceTitre, FAMILLE_TITRE, policeTitrePrete } from "../polices";
import { avecDelai, DELAI_DELAYRENDER_MS, DELAI_POLICE_MS, etatPolices } from "./attente-police";
import type { MiseEnLignes } from "./ajustement";
import { enCapitales, mettreEnLignesCapitales } from "./capitales";
import { COULEURS, GRAISSE_TITRE, LARGEUR_TEXTE, POLICE_TITRE } from "./constantes";
import { depassementsEncre, interligneCapitales, type MesureEncre } from "./interligne-capitales";

interface Proprietes {
  texte: string;
  maxLignes: number;
  /** Hauteur disponible (px) pour le bloc de titre. */
  hauteurMax: number;
  /** Dernière ligne en orange (grand élément). */
  accent?: boolean;
  /** Couleur du texte (encre par défaut ; crème sur la page sombre). */
  couleur?: string;
  /** Largeur (px) du bloc ; la ligne la plus large vise cette largeur. */
  largeur?: number;
  /** Corps minimal (px), si la page accepte un titre plus petit que celui des titres de page. */
  min?: number;
  /** Corps maximal (px) : les couvertures et le message clé montent plus haut que les titres de page. */
  max?: number;
  /** Grands titres du style C : un mot d'au moins `MOT_SEUL_GRAND_TITRE` signes peut tenir seul sur sa ligne (`OptionsAjustement.motSeulMin`). */
  grand?: boolean;
}

/** Longueur minimale d'un mot admis seul sur une ligne d'un grand titre (couvertures, message clé, page sombre). */
export const MOT_SEUL_GRAND_TITRE = 5;
/** Grands titres : on ne garde une ligne de moins que si le corps y reste à 97 % du plus grand (le style C vise le plus grand corps). */
export const TOLERANCE_GRAND_TITRE = 0.97;

/** Marge (px) par ligne retirée de la hauteur offerte à la mise en lignes : l'arrondi de chaque ligne au pixel près. */
const ARRONDI_PAR_LIGNE_PX = 1;

/** Attend que la police soit réellement chargée : jamais de mesure avec une police de secours. */
function attendrePolice(): Promise<void> {
  return avecDelai(policeTitrePrete(), DELAI_POLICE_MS, () => `Police Inter Display Black non chargée après ${DELAI_POLICE_MS / 1000} s : titre non mesurable (${etatPolices()})`);
}

/** Mesure réelle d'une ligne (canvas) avec la police chargée, au corps `taille`. */
function mesurerLignes(contexte: CanvasRenderingContext2D, lignes: string[], taille: number): number {
  contexte.font = `${GRAISSE_TITRE} ${taille}px "${FAMILLE_TITRE}"`;
  return Math.max(...lignes.map((l) => contexte.measureText(l).width));
}

/** Encre réelle d'une ligne dans Manrope 800 (canvas, corps 1000 px : em = valeur / 1000), mise en cache. La police est reposée à chaque appel : `mesurerLignes` change `font`. */
function creerMesureEncre(contexte: CanvasRenderingContext2D): MesureEncre {
  const cache = new Map<string, { haut: number; bas: number }>();
  return (ligne) => {
    contexte.font = `${GRAISSE_TITRE} 1000px "${FAMILLE_TITRE}"`;
    let mesure = cache.get(ligne);
    if (!mesure) {
      const m = contexte.measureText(ligne);
      mesure = { haut: m.actualBoundingBoxAscent / 1000, bas: m.actualBoundingBoxDescent / 1000 };
      cache.set(ligne, mesure);
    }
    return mesure;
  };
}

/** Hauteur (px) d'un titre en capitales : lignes à l'interligne calculé, plus l'encre qui dépasse en haut (accents) et en bas (jambages). */
function hauteurTitre(lignes: string[], taille: number, encre?: MesureEncre): number {
  const interligne = interligneCapitales(lignes, encre);
  const d = depassementsEncre(lignes, interligne, encre);
  return taille * (lignes.length * interligne + d.haut + d.bas);
}

/**
 * Titre EN CAPITALES (Inter Display Black) : corps ajusté par dichotomie sous `delayRender`, ligne la plus large à la largeur visée ± 4 px ou
 * bornée. L'interligne se calcule sur les lignes retenues (`interligneCapitales` : jamais une cédille contre un accent) et le bloc réserve
 * l'encre qui dépasse de la première et de la dernière ligne : rien n'est coupé, rien ne se touche.
 */
export function Titre({ texte, maxLignes, hauteurMax, accent = false, couleur = COULEURS.encre, largeur = LARGEUR_TEXTE, min, max, grand = false }: Proprietes) {
  chargerPoliceTitre();
  const [attente] = useState(() => delayRender(`Ajustement du titre « ${texte.slice(0, 24)} »`, { timeoutInMilliseconds: DELAI_DELAYRENDER_MS }));
  const [mise, setMise] = useState<(MiseEnLignes & { interligne: number; haut: number; bas: number }) | null>(null);
  // Capitales : le texte est passé en capitales AVANT la mesure (elles sont plus larges que les minuscules), jamais seulement au dessin.
  const capitales = enCapitales(texte);

  useEffect(() => {
    let vivant = true;
    attendrePolice()
      .then(() => {
        const contexte = document.createElement("canvas").getContext("2d");
        if (!contexte) throw new Error("Canvas 2D indisponible : titre non mesurable");
        const encre = creerMesureEncre(contexte);
        const choix = mettreEnLignesCapitales(capitales, (lignes, taille) => mesurerLignes(contexte, lignes, taille), { maxLignes, hauteurMax: hauteurMax - maxLignes * ARRONDI_PAR_LIGNE_PX, cible: largeur, hauteur: (lignes, taille) => hauteurTitre(lignes, taille, encre), ...(min ? { min } : {}), ...(max ? { max } : {}), ...(grand ? { motSeulMin: MOT_SEUL_GRAND_TITRE, toleranceCorps: TOLERANCE_GRAND_TITRE } : {}) });
        // Même encre pour l'ajustement et pour le dessin : l'interligne et les dépassements se calculent ici, une fois.
        const interligne = interligneCapitales(choix.lignes, encre);
        const d = depassementsEncre(choix.lignes, interligne, encre);
        if (vivant) setMise({ ...choix, interligne, haut: d.haut, bas: d.bas });
        continueRender(attente);
      })
      .catch((e: unknown) => {
        // Pas de repli silencieux : l'erreur fait échouer le rendu.
        cancelRender(e);
      });
    return () => {
      vivant = false;
    };
  }, [capitales, maxLignes, hauteurMax, attente, largeur, min, max, grand]);

  if (!mise) return <div data-titre-attente="" style={{ width: largeur, height: hauteurMax }} />;
  const { interligne } = mise;
  return (
    <div
      data-titre-taille={mise.taille}
      style={{ width: largeur, paddingTop: Math.ceil(mise.haut * mise.taille), paddingBottom: Math.ceil(mise.bas * mise.taille), fontFamily: POLICE_TITRE, fontWeight: GRAISSE_TITRE, fontSize: mise.taille, lineHeight: interligne, color: couleur }}
    >
      {mise.lignes.map((ligne, i) => (
        <div key={i} style={{ whiteSpace: "nowrap", color: accent && i === mise.lignes.length - 1 ? COULEURS.orange : couleur }}>
          {ligne}
        </div>
      ))}
    </div>
  );
}
