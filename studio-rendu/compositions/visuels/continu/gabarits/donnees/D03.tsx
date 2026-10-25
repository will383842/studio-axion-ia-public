/** D03 « Trois barres » : trois barres sur une ligne de base, hauteurs d'après `variante` (illustratif, aucun chiffre). */
import { CHARTE_CONTINU as C, alpha, degrade } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Etiquette, police, POLICE_TITRE, Titre, Tuile } from "../../commun/Primitives";
import { MARGE_SURE } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";
import { TEXTES_DONNEES } from "./textes-fixes";

/** Hauteurs (px) des trois barres et rang de la barre en vedette, par profil. */
const PROFILS: Record<string, { hauteurs: [number, number, number]; vedette: number }> = {
  descendant: { hauteurs: [430, 320, 200], vedette: 2 },
  montant: { hauteurs: [200, 320, 430], vedette: 2 },
  pic: { hauteurs: [300, 430, 220], vedette: 1 },
};
const ICONES: NomIconeContinu[] = ["doc", "mail", "target"];

export function D03({ page, hauteur }: ProprietesPlaquette) {
  const profil = PROFILS[String(page.variante)] ?? PROFILS.descendant;
  const libelles = (page.libelles as string[]) ?? [];
  return (
    <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 22, display: "flex" }}>
        <Etiquette>{TEXTES_DONNEES.d03Etiquette}</Etiquette>
      </div>
      <Titre taille={100} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 30 }} />
      <div style={{ flex: 1, display: "flex", gap: 26, alignItems: "flex-end", borderBottom: `3px solid ${alpha(C.encre, 0.18)}`, minHeight: 0 }}>
        {profil.hauteurs.map((h, i) => {
          const vedette = i === profil.vedette;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 16, alignItems: "center" }}>
              <Tuile icone={ICONES[i]} taille={112} variante={vedette ? "o" : "w"} />
              <div style={{ width: "100%", height: h, borderRadius: "34px 34px 0 0", background: vedette ? degrade(180, [C.orangeLumiere, C.orange]) : degrade(180, [C.brun, C.encre]) }} />
              <b style={{ ...police(800, 36, 1.2, POLICE_TITRE), letterSpacing: "-0.04em", color: C.encre }}>{libelles[i]}</b>
            </div>
          );
        })}
      </div>
    </div>
  );
}
