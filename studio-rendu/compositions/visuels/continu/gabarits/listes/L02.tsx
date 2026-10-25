/** L02 · Liste à gros chiffres : une carte par ligne, numéro posé par le code, tuile à droite. */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, Titre, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { bf, Sm, ZoneListe } from "./commun";

interface Item {
  icone: NomIconeContinu;
  titre: string;
  sous: string;
}

export function L02({ page, hauteur }: ProprietesPlaquette) {
  const items = page.items as Item[];
  return (
    <ZoneListe hauteur={hauteur}>
      <Titre taille={100} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 34 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {items.map((it, i) => (
          <Carte key={i} style={{ display: "flex", gap: 28, alignItems: "center", padding: "22px 30px", borderRadius: 40 }}>
            <span style={{ ...bf(96, 0.9), width: 92, color: i === 0 ? C.orange : C.encre }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ ...bf(48), display: "block" }}>{it.titre}</b>
              <Sm style={{ marginTop: 6, fontSize: 29 }}>{it.sous}</Sm>
            </div>
            <Tuile icone={it.icone} taille={104} variante={i === 0 ? "o" : "p"} />
          </Carte>
        ))}
      </div>
    </ZoneListe>
  );
}
