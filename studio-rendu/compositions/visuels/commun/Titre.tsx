import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { chargerPoliceArchivoBlack, FAMILLE_ARCHIVO_BLACK } from "../polices";
import { choisirMiseEnLignes, type MiseEnLignes } from "./ajustement";
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
async function attendrePolice(): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if ([...document.fonts].some((f) => f.family === FAMILLE_ARCHIVO_BLACK && f.status === "loaded")) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("Police Archivo Black non chargée : titre non mesurable");
}

/** Mesure réelle d'une ligne (canvas) avec la police chargée, au corps `taille`. */
function mesurerLignes(contexte: CanvasRenderingContext2D, lignes: string[], taille: number): number {
  contexte.font = `${taille}px "${FAMILLE_ARCHIVO_BLACK}"`;
  return Math.max(...lignes.map((l) => contexte.measureText(l).width));
}

/** Titre de page : corps ajusté par dichotomie (90–170 px) sous `delayRender`, ligne la plus large à 984 ± 4 px ou bornée. */
export function Titre({ texte, maxLignes, hauteurMax, accent = false, couleur = COULEURS.encre, largeur = LARGEUR_TEXTE, min }: Proprietes) {
  chargerPoliceArchivoBlack();
  const [attente] = useState(() => delayRender(`Ajustement du titre « ${texte.slice(0, 24)} »`));
  const [mise, setMise] = useState<MiseEnLignes | null>(null);

  useEffect(() => {
    let vivant = true;
    attendrePolice()
      .then(() => {
        const contexte = document.createElement("canvas").getContext("2d");
        if (!contexte) throw new Error("Canvas 2D indisponible : titre non mesurable");
        const choix = choisirMiseEnLignes(texte, (lignes, taille) => mesurerLignes(contexte, lignes, taille), { maxLignes, hauteurMax, cible: largeur, ...(min ? { min } : {}) });
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
  }, [texte, maxLignes, hauteurMax, attente, largeur, min]);

  if (!mise) return <div data-titre-attente="" style={{ width: largeur, height: hauteurMax }} />;
  return (
    <div data-titre-taille={mise.taille} style={{ width: largeur, fontFamily: POLICE_TITRE, fontSize: mise.taille, lineHeight: TITRE.interligne, color: couleur }}>
      {mise.lignes.map((ligne, i) => (
        <div key={i} style={{ whiteSpace: "nowrap", color: accent && i === mise.lignes.length - 1 ? COULEURS.orange : couleur }}>
          {ligne}
        </div>
      ))}
    </div>
  );
}
