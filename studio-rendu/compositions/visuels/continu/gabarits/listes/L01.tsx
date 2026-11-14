/** L01 · Bento illustré : une grande carte orange à gauche (sur deux rangées), deux cartes à droite. */
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, Titre, Tuile, type VarianteCarte, type VarianteTuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { bf, Sm, ZoneListe } from "./commun";

interface Item {
  icone: NomIconeContinu;
  titre: string;
  sous: string;
}

const CASES: { carte: VarianteCarte; tuile: VarianteTuile; plein: boolean }[] = [
  { carte: "o", tuile: "k", plein: true },
  { carte: "", tuile: "o", plein: false },
  { carte: "k", tuile: "o", plein: false },
];

export function L01({ page, hauteur }: ProprietesPlaquette) {
  const items = page.items as Item[];
  return (
    <ZoneListe hauteur={hauteur}>
      <Titre taille={100} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 40 }} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1.2fr 1fr", gap: 22 }}>
        {items.map((it, i) => (
          <Carte key={i} variante={CASES[i].carte} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 34, minHeight: 0, gridRow: CASES[i].plein ? "span 2" : undefined }}>
            <Tuile icone={it.icone} taille={124} variante={CASES[i].tuile} />
            <div>
              <b style={{ ...bf(50), display: "block" }}>{it.titre}</b>
              <Sm style={{ marginTop: 10 }}>{it.sous}</Sm>
            </div>
          </Carte>
        ))}
      </div>
    </ZoneListe>
  );
}
