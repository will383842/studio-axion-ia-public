import { useRef } from "react";
import { chargerPoliceArchivoBlack, chargerPoliceInter } from "../polices";
import { COMPOSANTS_MINI } from "../mini";
import type { CarteSpec } from "./types";
import { useControleDebordement } from "./controle-debordement";
import { BORDURE_CARTE, COULEURS, POLICE_CORPS, POLICE_TITRE, REMPLISSAGE_CARTE, TAILLES } from "./constantes";
import { ECART_MINI_LIGNE, ECART_MINI_TITRE, largeursTexteCarte } from "./mise-en-page";
import { styleCarte } from "./style-carte";

interface Proprietes {
  carte: CarteSpec;
  /** Rang de la carte dans la page (à partir de 1). */
  rang: number;
  /** Côté (px) du mini-visuel. */
  miniTaille: number;
  /** Carte large (page à une colonne) : mini-visuel à gauche, titre et texte à droite. */
  enLigne?: boolean;
  /** Abscisse (px) du bord gauche de la carte dans la page : le texte s'arrête à `BORD_DROIT_TEXTE` (zones réservées). */
  gauche: number;
  /** Facteur de typographie (1 par défaut) : une page à peu de cartes et peu de texte agrandit ses caractères au lieu de laisser du vide. */
  echelle?: number;
  /** Carte de la dernière rangée : son texte peut descendre sous y = 1080 et s'arrête alors avant le compteur de Meta. */
  derniereRangee?: boolean;
}

/** Titre d'une carte en grille à deux colonnes (4 à 6 cartes) : corps réduit, pour qu'un mot de 10 lettres tienne à côté du mini-visuel avant x = 912 (Archivo Black est large). */
const FACTEUR_TITRE_COLONNE = 0.85;

/** Carte de la page dense : mini-visuel éventuel, titre en Archivo Black, corps en Inter SemiBold. Textes du spec seulement. */
export function Carte({ carte, rang, miniTaille, enLigne = false, gauche, echelle = 1, derniereRangee = false }: Proprietes) {
  chargerPoliceArchivoBlack();
  chargerPoliceInter();
  const cadre = useRef<HTMLDivElement>(null);
  // Le cadre coupe ce qui dépasse (`overflow: hidden`) : le rendu échoue plutôt que de couper le texte.
  useControleDebordement(cadre, carte.titre, "la carte", [carte.titre, carte.corps, carte.mini]);
  const Mini = carte.mini ? COMPOSANTS_MINI[carte.mini] : null;
  const miniature = Mini && (
    <div style={{ flexShrink: 0, width: miniTaille, height: miniTaille }}>
      <Mini taille={miniTaille} rang={rang} />
    </div>
  );
  const largeurs = largeursTexteCarte({ gauche, miniTaille, enLigne, avecMini: !!Mini, derniereRangee });
  const titre = <div style={{ maxWidth: largeurs.titre, fontFamily: POLICE_TITRE, fontSize: Math.round(TAILLES.carteTitre * echelle * (enLigne ? 1 : FACTEUR_TITRE_COLONNE)), lineHeight: 1.1, color: COULEURS.encre }}>{carte.titre}</div>;
  const corps = <div style={{ maxWidth: largeurs.corps, fontFamily: POLICE_CORPS, fontWeight: 600, fontSize: Math.round(TAILLES.corps * echelle), lineHeight: 1.3, color: COULEURS.encre }}>{carte.corps}</div>;
  return (
    <div
      ref={cadre}
      style={{
        boxSizing: "border-box",
        height: "100%",
        padding: REMPLISSAGE_CARTE,
        borderRadius: 28,
        ...styleCarte(rang),
        border: `${BORDURE_CARTE}px solid ${COULEURS.encre}`,
        display: "flex",
        flexDirection: enLigne ? "row" : "column",
        alignItems: enLigne ? "center" : undefined,
        justifyContent: enLigne ? undefined : "center",
        gap: enLigne ? ECART_MINI_LIGNE : 14,
        overflow: "hidden",
      }}
    >
      {enLigne ? (
        <>
          {miniature}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {titre}
            {corps}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: ECART_MINI_TITRE }}>
            {miniature}
            {titre}
          </div>
          {corps}
        </>
      )}
    </div>
  );
}
