import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { chargerPoliceArchivoBlack, FAMILLE_ARCHIVO_BLACK, policeArchivoBlackPrete } from "../polices";
import { avecDelai, DELAI_DELAYRENDER_MS, DELAI_POLICE_MS, etatPolices } from "./attente-police";
import { JAMBAGE_HAUT } from "./controle-debordement";
import type { MiseEnLignes } from "./ajustement";
import { enCapitales, mettreEnLignesCapitales } from "./capitales";
import { COULEURS, LARGEUR_TEXTE, POLICE_TITRE, TITRE } from "./constantes";

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
}

/** Attend que la police soit réellement chargée : jamais de mesure avec une police de secours. */
function attendrePolice(): Promise<void> {
  return avecDelai(policeArchivoBlackPrete(), DELAI_POLICE_MS, () => `Police Archivo Black non chargée après ${DELAI_POLICE_MS / 1000} s : titre non mesurable (${etatPolices()})`);
}

/** Mesure réelle d'une ligne (canvas) avec la police chargée, au corps `taille`. */
function mesurerLignes(contexte: CanvasRenderingContext2D, lignes: string[], taille: number): number {
  contexte.font = `${taille}px "${FAMILLE_ARCHIVO_BLACK}"`;
  return Math.max(...lignes.map((l) => contexte.measureText(l).width));
}

/** Titre de page EN CAPITALES : corps ajusté par dichotomie (90–170 px) sous `delayRender`, ligne la plus large à 984 ± 4 px ou bornée. */
export function Titre({ texte, maxLignes, hauteurMax, accent = false, couleur = COULEURS.encre, largeur = LARGEUR_TEXTE, min }: Proprietes) {
  chargerPoliceArchivoBlack();
  const [attente] = useState(() => delayRender(`Ajustement du titre « ${texte.slice(0, 24)} »`, { timeoutInMilliseconds: DELAI_DELAYRENDER_MS }));
  const [mise, setMise] = useState<MiseEnLignes | null>(null);
  // Capitales : le texte est passé en capitales AVANT la mesure (elles sont plus larges que les minuscules), jamais seulement au dessin.
  const capitales = enCapitales(texte);

  useEffect(() => {
    let vivant = true;
    attendrePolice()
      .then(() => {
        const contexte = document.createElement("canvas").getContext("2d");
        if (!contexte) throw new Error("Canvas 2D indisponible : titre non mesurable");
        const choix = mettreEnLignesCapitales(capitales, (lignes, taille) => mesurerLignes(contexte, lignes, taille), { maxLignes, hauteurMax: hauteurMax - JAMBAGE_HAUT, cible: largeur, ...(min ? { min } : {}) });
        if (vivant) setMise(choix);
        continueRender(attente);
      })
      .catch((e: unknown) => {
        // Pas de repli silencieux : l'erreur fait échouer le rendu.
        cancelRender(e);
      });
    return () => {
      vivant = false;
    };
  }, [capitales, maxLignes, hauteurMax, attente, largeur, min]);

  if (!mise) return <div data-titre-attente="" style={{ width: largeur, height: hauteurMax }} />;
  return (
    <div data-titre-taille={mise.taille} style={{ width: largeur, paddingTop: JAMBAGE_HAUT, fontFamily: POLICE_TITRE, fontSize: mise.taille, lineHeight: TITRE.interligne, color: couleur }}>
      {mise.lignes.map((ligne, i) => (
        <div key={i} style={{ whiteSpace: "nowrap", color: accent && i === mise.lignes.length - 1 ? COULEURS.orange : couleur }}>
          {ligne}
        </div>
      ))}
    </div>
  );
}
