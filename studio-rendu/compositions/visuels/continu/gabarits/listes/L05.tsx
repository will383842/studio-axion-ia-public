/** L05 · Checklist : une carte par ligne, tuile à gauche, interrupteur dessiné à droite ; une ligne non cochée est barrée et estompée. */
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, Interrupteur, police, POLICE_TEXTE, Titre, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { ZoneListe } from "./commun";

interface Ligne {
  icone: NomIconeContinu;
  texte: string;
  coche: boolean;
}

export function L05({ page, hauteur }: ProprietesPlaquette) {
  const lignes = page.lignes as Ligne[];
  return (
    <ZoneListe hauteur={hauteur}>
      <Titre taille={100} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 36 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {lignes.map((l, i) => (
          <Carte key={i} style={{ display: "flex", alignItems: "center", gap: 26, padding: "20px 30px", borderRadius: 40, opacity: l.coche ? 1 : 0.6 }}>
            <Tuile icone={l.icone} taille={90} variante={l.coche ? "o" : "p"} />
            <span style={{ ...police(600, 38, 1.12, POLICE_TEXTE), flex: 1, minWidth: 0, textDecoration: l.coche ? "none" : "line-through" }}>{l.texte}</span>
            <Interrupteur allume={l.coche} />
          </Carte>
        ))}
      </div>
    </ZoneListe>
  );
}
