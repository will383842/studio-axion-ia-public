/** L04 · Chronologie (cas concret) : étiquette « Scénario type » posée par le code, jalons reliés par un pointillé orange. */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { TEXTES_FIXES_L9 } from "../../../../../../src/briques/visuels/textes-fixes";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Etiquette, Libelle, Titre, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { bf, LIBELLE_CLAIR, ZoneListe } from "./commun";

interface Etape {
  icone: NomIconeContinu;
  jour: string;
  texte: string;
}

export function L04({ page, hauteur }: ProprietesPlaquette) {
  const etapes = page.etapes as Etape[];
  return (
    <ZoneListe hauteur={hauteur}>
      <div style={{ marginBottom: 24, display: "flex" }}>
        <Etiquette>{TEXTES_FIXES_L9.t26Etiquette}</Etiquette>
      </div>
      <Titre taille={104} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 50 }} />
      {etapes.map((e, i) => {
        const derniere = i === etapes.length - 1;
        return (
          <div key={i} style={{ display: "flex", gap: 36, position: "relative", paddingBottom: derniere ? 0 : 46 }}>
            <div style={{ width: 120, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Tuile icone={e.icone} taille={120} variante={derniere ? "o" : "k"} />
              {derniere ? null : <span style={{ flex: 1, width: 8, marginTop: 10, borderRadius: 4, background: `repeating-linear-gradient(${C.orange} 0 14px, transparent 14px 26px)` }} />}
            </div>
            <div style={{ paddingTop: 10, flex: 1, minWidth: 0 }}>
              <Libelle style={{ color: LIBELLE_CLAIR, display: "block" }}>{e.jour}</Libelle>
              <b style={{ ...bf(50, 1.02), display: "block", marginTop: 12 }}>{e.texte}</b>
            </div>
          </div>
        );
      })}
    </ZoneListe>
  );
}
