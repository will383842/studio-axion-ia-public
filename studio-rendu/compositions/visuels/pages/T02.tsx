import { Carte } from "../commun/Carte";
import { PageBase } from "../commun/PageBase";
import { OMBRE_DECALAGE } from "../commun/constantes";
import { ECART_GRILLE as ECART, echelleCartes, gaucheCarte } from "../commun/mise-en-page";
import type { CarteSpec } from "../commun/types";

interface Proprietes {
  titre: string;
  cartes: CarteSpec[];
  index: number;
  total: number;
}

/** Nombre de colonnes selon le nombre de cartes : 1 à 3 cartes en colonne unique, 4 à 6 sur deux colonnes. */
export function colonnesCartes(n: number): number {
  return n <= 3 ? 1 : 2;
}

/** T02 — page dense : titre sur deux lignes au plus, trait, grille de 2 à 6 cartes (cartes larges en ligne sur une colonne, 2 à 3 cartes), repère de défilement. */
export function T02({ titre, cartes, index, total }: Proprietes) {
  const colonnes = colonnesCartes(cartes.length);
  const echelle = echelleCartes(cartes);
  const lignes = Math.ceil(cartes.length / colonnes);
  return (
    <PageBase titre={titre} index={index} total={total} type="T02">
      <div style={{ flex: 1, minHeight: 0, paddingRight: OMBRE_DECALAGE, paddingBottom: OMBRE_DECALAGE, display: "grid", gridTemplateColumns: `repeat(${colonnes}, 1fr)`, gridTemplateRows: `repeat(${lignes}, 1fr)`, gap: ECART }}>
        {cartes.map((carte, i) => (
          <Carte key={i} carte={carte} rang={i + 1} miniTaille={Math.round((colonnes === 1 ? 132 : 64) * echelle)} enLigne={colonnes === 1} gauche={gaucheCarte(i, colonnes)} echelle={echelle} derniereRangee={i >= cartes.length - colonnes} />
        ))}
      </div>
    </PageBase>
  );
}
