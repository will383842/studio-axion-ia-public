import React from "react";
/**
 * Axe 10 · Intensité des sous-titres, sur la même phrase (« Et là, deux chemins. ») et le même écran (« Deux chemins »,
 * matière d'aujourd'hui). Inter Bold seulement (charte), dans la bande 1 152 → 1 286 px.
 * SOU-A calme : la phrase entière, simple, sans couleur ni trait. SOU-B (aujourd'hui) : le vrai témoin (mot orange +
 * trait). SOU-C appuyé : groupe court en capitales, plus grand, le mot dit posé sur un pavé orange vif qui vient de claquer.
 */
import { a, C, INTER, SousTitre } from "./objets";
import { DeuxChemins, DeuxCheminsV2 } from "./matiere";

export function SouA1() {
  return (
    <>
      <DeuxChemins mat="A" temoin={false} />
      <div style={{ position: "absolute", left: 60, width: 960, top: 1152, height: 134, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...INTER, fontSize: 58, color: C.encre }}>Et là, deux chemins.</div>
      </div>
    </>
  );
}

export function SouB1() {
  return (
    <>
      <DeuxChemins mat="A" temoin={false} />
      <SousTitre texte="Et là, *deux* chemins." fond="ivoire" />
    </>
  );
}

/** SOU-C (v2) : écran « Deux chemins » recomposé (matière d'aujourd'hui), voix « Il trie tout. » qui ne répète plus le
 * titre. Sous-titre appuyé à sa vraie place (bande 1152 → 1286) : capitales, plus grand, le mot dit (« TRIE ») posé sur
 * un pavé encre (texte ivoire, rapport 16,5) qui vient de claquer. Pas d'orange dans le sous-titre : le seul « mot »
 * orange de l'écran est la pastille 80 %. */
export function SouC1() {
  return (
    <>
      <DeuxCheminsV2 mat="A" temoin={null} />
      <div style={{ position: "absolute", left: 60, width: 960, top: 1152, height: 134, display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
        <div style={{ ...INTER, fontSize: 84, lineHeight: 1, textTransform: "uppercase", color: C.encre }}>Il</div>
        <div style={{ position: "relative", transform: "rotate(-3deg)" }}>
          {/* trace du claquement (le pavé vient d'arriver en grossissant) */}
          <div style={{ position: "absolute", inset: -8, borderRadius: 20, border: `4px solid ${a(C.encre, 0.3)}` }} />
          <div style={{ ...INTER, fontSize: 84, lineHeight: 1, textTransform: "uppercase", background: C.encre, color: C.ivoire, padding: "14px 22px 12px", borderRadius: 14 }}>Trie</div>
        </div>
        <div style={{ ...INTER, fontSize: 84, lineHeight: 1, textTransform: "uppercase", color: C.encre }}>tout</div>
      </div>
    </>
  );
}
