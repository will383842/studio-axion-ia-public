/** L07 · Grille d'icônes : trois colonnes de tuiles en relief, un libellé sous chacune (six ou neuf cases). */
import type { NomIconeContinu } from "../../commun/icones-continu";
import { police, POLICE_TEXTE, Titre, Tuile, type VarianteTuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { ZoneListe } from "./commun";

/** Variante de la maquette : la 5e en orange, une sur quatre (à partir de la 2e) sombre, une sur trois (à partir de la 3e) pêche, le reste blanc. */
function variante(i: number): VarianteTuile {
  return i === 4 ? "o" : i % 4 === 1 ? "k" : i % 3 === 2 ? "p" : "w";
}

export function L07({ page, hauteur }: ProprietesPlaquette) {
  const items = page.items as { icone: NomIconeContinu; label: string }[];
  // Les libellés de la dernière rangée restent hors du coin réservé (200 px du bas) : 80 px de plus en bas.
  return (
    <ZoneListe hauteur={hauteur} basReserve={80}>
      <Titre taille={100} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 30 }} />
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", alignContent: items.length > 6 ? "space-between" : "space-around", gap: "20px 10px" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <Tuile icone={it.icone} taille={items.length > 6 ? 176 : 190} variante={variante(i)} />
            <b style={{ ...police(700, 31, 1.1, POLICE_TEXTE), textAlign: "center" }}>{it.label}</b>
          </div>
        ))}
      </div>
    </ZoneListe>
  );
}
