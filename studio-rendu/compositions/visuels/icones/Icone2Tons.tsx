/**
 * Icône Lucide « deux tons » : un fond (disque, carré arrondi ou goutte, choisi selon l'icône et son sens) SOUS le trait
 * d'encre. Les icônes de réponse (coche, croix, flèche) ont un traitement « pastille » : fond cerné d'encre et tracé
 * clair cerné d'encre. Décorative (aria-hidden), sans texte. Couleurs : la palette de la charte uniquement.
 */
import type { ReactNode } from "react";
import { palette, type CouleursDessin, type PaletteDessin } from "../illustrations/palette";
import { LUCIDE, type NoeudLucide, type NomLucide } from "./lucide";

export interface ProprietesIcone2Tons extends CouleursDessin {
  nom: NomLucide;
  taille: number | string;
  /** Trait d'encre (grille 24) ; 2,25 par défaut (un peu plus que Lucide, pour rester net posé sur le fond). */
  trait?: number;
}

type Fond = "disque" | "carre" | "goutte";

/** Forme du fond selon l'objet : rond pour le temps, la mesure et les idées ; carré pour les objets « boîte » ; goutte pour l'élan. */
const FONDS: Record<Exclude<NomLucide, "coche" | "croix" | "fleche">, Fond> = {
  horloge: "disque", cible: "disque", question: "disque", "coche-cercle": "disque", engrenage: "disque", loupe: "disque",
  ampoule: "disque", etoile: "disque", utilisateurs: "disque", telephone: "disque", sablier: "disque", lien: "disque",
  courrier: "carre", calendrier: "carre", dossier: "carre", document: "carre", liste: "carre", ordinateur: "carre",
  valise: "carre", batiment: "carre", maison: "carre", graphique: "carre", corbeille: "carre", cadenas: "carre", bouclier: "carre",
  eclair: "goutte", fusee: "goutte", envoyer: "goutte", crayon: "goutte", drapeau: "goutte", hausse: "goutte",
  baisse: "goutte", cle: "goutte", bulle: "goutte", alerte: "goutte", telechargement: "goutte", balance: "goutte",
};

/** Sens négatif : fond pâle cerné d'orange plutôt qu'un aplat orange. */
const NEGATIVES: ReadonlySet<NomLucide> = new Set<NomLucide>(["baisse", "alerte", "corbeille"]);

function formeFond(fond: Fond, remplissage: string, contour: string, epaisseur: number): ReactNode {
  const trait = epaisseur > 0 ? { stroke: contour, strokeWidth: epaisseur } : { stroke: "none" };
  if (fond === "disque") return <circle cx="13.25" cy="13.5" r="9.5" fill={remplissage} {...trait} />;
  if (fond === "carre") return <rect x="4" y="5" width="17.5" height="17" rx="5" fill={remplissage} {...trait} />;
  return <path d="M13 4.5H20.5Q21.5 4.5 21.5 5.5V13A8.5 8.5 0 0 1 13 21.5A8.5 8.5 0 0 1 4.5 13A8.5 8.5 0 0 1 13 4.5Z" fill={remplissage} {...trait} />;
}

function traces(noeuds: readonly NoeudLucide[], p: PaletteDessin): ReactNode {
  return noeuds.map(([balise, attributs], i) => {
    const Balise = balise;
    // Lucide remplit parfois un point en `currentColor` : on le ramène à l'encre de la charte.
    const a = attributs.fill === "currentColor" ? { ...attributs, fill: p.encre } : attributs;
    return <Balise key={i} {...a} />;
  });
}

/** Tracé clair cerné d'encre (traitement « pastille »), réduit autour du centre. */
function traceCerne(noeuds: readonly NoeudLucide[], p: PaletteDessin, echelle: number, trait: number, clair: string): ReactNode {
  const d = 12 * (1 - echelle);
  return (
    <g transform={`translate(${d} ${d}) scale(${echelle})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke={p.encre} strokeWidth={(trait + 2.4) / echelle}>{traces(noeuds, p)}</g>
      <g stroke={clair} strokeWidth={trait / echelle}>{traces(noeuds, p)}</g>
    </g>
  );
}

export function Icone2Tons({ nom, taille, trait = 2.25, ...c }: ProprietesIcone2Tons) {
  const p = palette(c);
  let contenu: ReactNode;
  if (nom === "coche") {
    contenu = (
      <>
        <rect x="2" y="2" width="20" height="20" rx="6.5" fill={p.orange} stroke={p.encre} strokeWidth="1.5" />
        {traceCerne(LUCIDE.coche, p, 0.74, trait, p.papier)}
      </>
    );
  } else if (nom === "croix") {
    contenu = (
      <>
        <circle cx="12" cy="12" r="10" fill={p.pale} stroke={p.encre} strokeWidth="1.5" />
        {traceCerne(LUCIDE.croix, p, 0.66, trait, p.orange)}
      </>
    );
  } else if (nom === "fleche") {
    contenu = (
      <>
        <rect x="1.5" y="5.5" width="21" height="13" rx="6.5" fill={p.orange} stroke={p.encre} strokeWidth="1.5" />
        {traceCerne(LUCIDE.fleche, p, 0.62, trait, p.papier)}
      </>
    );
  } else {
    const negative = NEGATIVES.has(nom);
    contenu = (
      <>
        {negative ? formeFond(FONDS[nom], p.pale, p.orange, 1.25) : formeFond(FONDS[nom], p.orange, p.orange, 0)}
        <g fill="none" stroke={p.encre} strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round">
          {traces(LUCIDE[nom], p)}
        </g>
      </>
    );
  }
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden>
      {contenu}
    </svg>
  );
}
