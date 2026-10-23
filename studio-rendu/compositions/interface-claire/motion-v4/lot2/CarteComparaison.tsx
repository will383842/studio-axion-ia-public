import React from "react";
/**
 * Élément 15 `CarteComparaison` (lot 2) : deux colonnes face à face. Colonne gauche GRIS qui se construit (lignes de 4 i), rond ENCRE « VS » qui
 * CLAQUE, colonne droite qui s'allume d'un coup sur le mot (ACCENT_1) avec « 1 HEURE » et 3 coches en cascade.
 * `decl` = [colonne gauche, « VS », colonne droite allumée].
 */
import { useCurrentFrame } from "remotion";
import { accents, Case, CoqueCarte, COULEURS, courbe, Ico, LISERE, melange, PastilleEntete, Plaque, pulsation, ressort, secousse, Sons, styleInter, styleMontserrat, TRAIT, vieEntre } from "./commun-lot2";
import type { Palette } from "./commun-lot2";

const { ENCRE, BLANC, GRIS, IVOIRE_CLAIR } = COULEURS;

export type PropsCarteComparaison = {
  palette: Palette;
  duree: number;
  decl: number[];
  gauche?: string;
  droite?: string;
  lignes?: string[];
  resultat?: string;
  /** En-tête (mot DIT) ; absent : « AGENCE OU AGENTS ». */
  titre?: string;
  /** Pastille d'en-tête ; "" : aucune ; absent : « COMPARAISON ». */
  pastille?: string;
  avecSons?: boolean;
};

export function evenementsComparaison(decl: number[], duree: number): number[] {
  const [g, v, d] = decl;
  return [0, g, g + 4, g + 9, g + 14, v, v + 3, d, d + 4, d + 10, d + 16, duree - 3];
}

export function CarteComparaison({ palette, duree, decl, gauche = "UNE AGENCE", droite = "VOS AGENTS", lignes = ["MOIS 1", "MOIS 2", "MOIS 3"], resultat = "1 HEURE", avecSons = true, titre = "AGENCE OU AGENTS", pastille = "COMPARAISON" }: PropsCarteComparaison) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const [iG, iV, iD] = decl;
  const largeurCol = 392;
  const xDroite = 914 - 38 - largeurCol;
  const allume = courbe(i, iD, 3);
  const rond = ressort("CLAQUE", i - iV);
  const vie = vieEntre(evenementsComparaison(decl, duree), duree);
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9], [iV, "drop_002", 0.3], [iD, "ding-4", 0.2]];
  lignes.forEach((_, k) => sons.push([iG + 4 + 5 * k, "tick_001", 0.18]));
  [0, 1, 2].forEach((k) => sons.push([iD + 4 + 6 * k, "tick_004", 0.24]));
  return (
    <>
      <CoqueCarte palette={palette} titre={titre} i={i} duree={duree} vie={vie} pastille={pastille ? <PastilleEntete>{pastille}</PastilleEntete> : undefined}>
        {/* colonne gauche */}
        {i >= iG && (
          <div style={{ position: "absolute", left: 38, top: 20, width: largeurCol, height: 406, boxSizing: "border-box", background: IVOIRE_CLAIR, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 14, padding: 16, transform: `scale(${0.85 + 0.15 * ressort("POP", i - iG)})` }}>
            <div style={{ boxSizing: "border-box", height: 62, display: "flex", alignItems: "center", justifyContent: "center", background: GRIS, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 10, ...styleMontserrat(32, { letterSpacing: "0.03em" }) }}>{gauche}</div>
            {lignes.map((l, k) => {
              const d = iG + 4 + 5 * k;
              return (
                <div key={k} style={{ height: 80 * courbe(i, d, 4), overflow: "hidden" }}>
                  <div style={{ boxSizing: "border-box", marginTop: 14, height: 66, display: "flex", alignItems: "center", gap: 14, padding: "0 18px", background: BLANC, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 10, ...styleInter(34, 800) }}>
                    <Ico nom="horloge" taille={44} />
                    {l}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {/* colonne droite */}
        {i >= iV && (
          <div style={{ position: "absolute", left: xDroite, top: 20, width: largeurCol, height: 406, boxSizing: "border-box", background: melange(IVOIRE_CLAIR, ACCENT_1, allume), border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 14, padding: 16, transform: `scale(${0.85 + 0.15 * ressort("POP", i - iV)})` }}>
            <div style={{ boxSizing: "border-box", height: 62, display: "flex", alignItems: "center", justifyContent: "center", background: melange(GRIS, BLANC, allume), border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 10, ...styleMontserrat(32, { letterSpacing: "0.03em" }) }}>{droite}</div>
            {i >= iD && (
              <>
                <div style={{ marginTop: 18, display: "flex", justifyContent: "center", transform: `scale(${(1.2 - 0.2 * ressort("CLAQUE", i - iD)) * pulsation(i, vie, 0.07)})` }}>
                  <Plaque fond={BLANC} corps={58} texte={resultat} />
                </div>
                {[0, 1, 2].map((k) => {
                  const d = iD + 4 + 6 * k;
                  return (
                    <div key={k} style={{ marginTop: 14, height: 56, display: "flex", alignItems: "center", gap: 18, opacity: i >= d ? 1 : 0 }}>
                      <Case i={i} i0={d} taille={50} fond={BLANC} />
                      <div style={{ flex: 1, height: 16, background: ENCRE, borderRadius: 8, transform: `scaleX(${courbe(i, d, 3)})`, transformOrigin: "0% 50%", opacity: 0.9 }} />
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
        {/* rond VS */}
        {i >= iV && (
          <div style={{ position: "absolute", left: 457 + secousse(i - iV - 4, 9), top: 223, width: 112, height: 112, transform: `translate(-50%, -50%) scale(${0.3 + 0.7 * rond + (i - iV < 5 ? 0.25 * (1 - (i - iV) / 5) : 0)})`, boxSizing: "border-box", borderRadius: "50%", background: ENCRE, color: ACCENT_1, display: "flex", alignItems: "center", justifyContent: "center", border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxShadow: `${LISERE}, 5px 6px 0 0 ${ENCRE}`, ...styleMontserrat(44) }}><svg width={64} height={64} viewBox="0 0 64 64" style={{ display: "block" }}><path d="M36 4 L12 36 H30 L26 60 L52 26 H34 Z" fill={ACCENT_1} stroke={ACCENT_1} strokeWidth={4} strokeLinejoin="round" /></svg></div>
        )}
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
