/** Vue de la planche : 12 illustrations à 3 tailles (560 / 224 / 120) puis les 40 icônes à 120, 48 et 24 px. Aucun texte. */
import { ICONES, ILLUSTRATIONS } from "../../src/briques/visuels/registre-illustrations";
import { COULEURS } from "../compositions/visuels/commun/constantes";
import { Icone2Tons } from "../compositions/visuels/icones/Icone2Tons";
import type { NomLucide } from "../compositions/visuels/icones/lucide";
import { COMPOSANTS_ILLUSTRATIONS } from "../compositions/visuels/illustrations";
import { BLANC_CARTE } from "../compositions/visuels/illustrations/palette";

const COLONNES_ILLUSTRATIONS = 2;
const CELLULE = { l: 920, h: 640 };
const MARGE = 40;
const COLONNES_ICONES = 10;
const ICONE = 120;
const PETITES = [48, 24];
const BLOC_ICONES = Math.ceil(ICONES.length / COLONNES_ICONES) * (ICONE + 40) + PETITES.reduce((t, n) => t + 2 * (n + 24), 0) + 2 * MARGE;

export const LARGEUR_PLANCHE = COLONNES_ILLUSTRATIONS * CELLULE.l + 2 * MARGE;
const LIGNES = Math.ceil(ILLUSTRATIONS.length / COLONNES_ILLUSTRATIONS);
export const HAUTEUR_PLANCHE = LIGNES * CELLULE.h + 2 * MARGE + BLOC_ICONES;

export function PlancheIllustrations() {
  return (
    <div style={{ width: LARGEUR_PLANCHE, height: HAUTEUR_PLANCHE, background: COULEURS.creme, padding: MARGE, boxSizing: "border-box" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLONNES_ILLUSTRATIONS}, ${CELLULE.l}px)`, gridAutoRows: CELLULE.h }}>
        {ILLUSTRATIONS.map((d) => {
          const Dessin = COMPOSANTS_ILLUSTRATIONS[d.id as keyof typeof COMPOSANTS_ILLUSTRATIONS];
          return (
            <div key={d.id} style={{ display: "flex", gap: 40, alignItems: "flex-start", padding: 20 }}>
              <div style={{ background: BLANC_CARTE, borderRadius: 24, padding: 10 }}><Dessin taille={560} /></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ background: COULEURS.pale, borderRadius: 16, padding: 8 }}><Dessin taille={224} /></div>
                <div style={{ background: BLANC_CARTE, borderRadius: 12, padding: 6, alignSelf: "flex-start" }}><Dessin taille={120} /></div>
                <div style={{ background: COULEURS.orange, borderRadius: 12, padding: 6, alignSelf: "flex-start" }}><Dessin taille={120} /></div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLONNES_ICONES}, 1fr)`, gap: 40, marginTop: MARGE, justifyItems: "center" }}>
        {ICONES.map((d) => (
          <Icone2Tons key={d.id} nom={d.nom as NomLucide} taille={ICONE} />
        ))}
      </div>
      {PETITES.map((n) => (
        <div key={n} style={{ display: "grid", gridTemplateColumns: `repeat(${ICONES.length / 2}, 1fr)`, rowGap: 24, marginTop: 24, justifyItems: "center" }}>
          {ICONES.map((d) => (
            <Icone2Tons key={d.id} nom={d.nom as NomLucide} taille={n} />
          ))}
        </div>
      ))}
    </div>
  );
}
